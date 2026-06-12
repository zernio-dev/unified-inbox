import { MESSAGE_PLATFORMS } from '@/lib/capabilities';
import type { Account, Profile } from '@/lib/types';
import { passthrough, zernioFetch } from './zernio';

export const SETTINGS_COOKIE_NAME = 'unified-inbox-settings';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const ACCOUNTS_CACHE_TTL_MS = 60 * 1000;
let cache: {
  data: { accounts: Account[]; profiles: Profile[] };
  expiresAt: number;
} | null = null;

/**
 * Fetch connected accounts (filtered to messaging platforms) + profiles.
 * On upstream failure returns the passthrough Response so 401/403 envelopes
 * reach the client intact; callers must check `instanceof Response`.
 *
 * Successful results are cached in-memory for 60s (this runs on every
 * conversations poll, every 10s, and would otherwise burn rate-limit budget
 * upstream). Error Responses are never cached. Pass `forceRefresh: true` to
 * bypass the cache (settings page data paths, where staleness is user-visible).
 */
export async function fetchMessageAccounts(opts?: {
  forceRefresh?: boolean;
}): Promise<{ accounts: Account[]; profiles: Profile[] } | Response> {
  if (!opts?.forceRefresh && cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const [accountsRes, profilesRes] = await Promise.all([
    zernioFetch('/v1/accounts'),
    zernioFetch('/v1/profiles'),
  ]);
  if (!accountsRes.ok) return passthrough(accountsRes);
  if (!profilesRes.ok) return passthrough(profilesRes);

  const accountsBody = (await accountsRes.json()) as { accounts?: Account[] };
  const profilesBody = (await profilesRes.json()) as { profiles?: Profile[] };

  const accounts = (accountsBody.accounts ?? []).filter(
    (a) =>
      MESSAGE_PLATFORMS.includes(a.platform) && a.isActive !== false && a.enabled !== false,
  );
  const data = { accounts, profiles: profilesBody.profiles ?? [] };
  cache = { data, expiresAt: Date.now() + ACCOUNTS_CACHE_TTL_MS };
  return data;
}

export function hasSettingsCookie(cookieHeader: string | null): boolean {
  return parseSettingsCookie(cookieHeader) !== null;
}

export function readSettings(opts: {
  accounts: Account[];
  cookieHeader: string | null;
}): { selectedAccountIds: string[] } {
  const liveIds = opts.accounts.map((a) => a._id);
  const stored = parseSettingsCookie(opts.cookieHeader);
  if (stored) {
    const live = new Set(liveIds);
    const sanitized = [...new Set(stored)].filter((id) => live.has(id));
    if (sanitized.length > 0) return { selectedAccountIds: sanitized };
  }
  // No cookie (or it references no live accounts): default to all live accounts.
  return { selectedAccountIds: liveIds };
}

export function serializeSettingsCookie(selectedAccountIds: string[]): string {
  const value = encodeURIComponent(JSON.stringify({ selectedAccountIds }));
  const attrs = [
    `${SETTINGS_COOKIE_NAME}=${value}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs.join('; ');
}

function parseSettingsCookie(cookieHeader: string | null): string[] | null {
  if (!cookieHeader) return null;
  const pair = cookieHeader
    .split(/;\s*/)
    .find((c) => c.startsWith(`${SETTINGS_COOKIE_NAME}=`));
  if (!pair) return null;
  try {
    const raw = decodeURIComponent(pair.slice(SETTINGS_COOKIE_NAME.length + 1));
    const parsed = JSON.parse(raw) as { selectedAccountIds?: unknown };
    if (Array.isArray(parsed.selectedAccountIds)) {
      return parsed.selectedAccountIds.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // Malformed cookie: treat as absent.
  }
  return null;
}
