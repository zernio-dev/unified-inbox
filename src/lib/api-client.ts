import { useSyncExternalStore } from 'react';

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;
  trialAvailable?: boolean;

  constructor({
    message,
    status,
    code,
    retryAfter,
    trialAvailable,
  }: {
    message: string;
    status: number;
    code?: string;
    retryAfter?: number;
    trialAvailable?: boolean;
  }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.trialAvailable = trialAvailable;
  }
}

/** Normalize any thrown value (network TypeError, etc.) into ApiError | null for hook return types. */
export function toApiError(err: unknown): ApiError | null {
  if (!err) return null;
  if (err instanceof ApiError) return err;
  return new ApiError({
    message: err instanceof Error ? err.message : String(err),
    status: 0,
  });
}

function parseRetryAfter(res: Response): number | undefined {
  const retryAfter = res.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds);
  }
  const reset = res.headers.get('X-RateLimit-Reset');
  if (reset) {
    const value = Number(reset);
    if (Number.isFinite(value)) {
      // Header may carry epoch seconds or epoch milliseconds.
      const resetMs = value > 1e12 ? value : value * 1000;
      return Math.max(0, Math.round((resetMs - Date.now()) / 1000));
    }
  }
  return undefined;
}

function getClientTenantId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const fromUrl = searchParams.get('tenant_id');
    if (fromUrl) {
      try {
        localStorage.setItem('inbox_tenant_id', fromUrl);
      } catch {}
      return fromUrl;
    }
  } catch {}
  try {
    const fromStorage = localStorage.getItem('inbox_tenant_id');
    if (fromStorage) return fromStorage;
  } catch {}
  const match = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)(?:inbox_)?tenant_id=([^;]+)/) : null;
  return match ? decodeURIComponent(match[1]) : '';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let targetPath = path;
  const tenantId = getClientTenantId();

  const headers = new Headers(init?.headers || {});
  if (tenantId) {
    if (!headers.has('x-tenant-id')) {
      headers.set('x-tenant-id', tenantId);
    }
    if (!targetPath.includes('tenant_id=')) {
      const sep = targetPath.includes('?') ? '&' : '?';
      targetPath = `${targetPath}${sep}tenant_id=${encodeURIComponent(tenantId)}`;
    }
  }

  const res = await fetch(targetPath, { cache: 'no-store', ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      trialAvailable?: boolean;
    };
    const retryAfter = parseRetryAfter(res);
    const isMediaRoute = path.includes('/api/media') || path.includes('/media/');
    if (res.status === 429 && !isMediaRoute) {
      notifyRateLimited(retryAfter ?? 30);
    }
    throw new ApiError({
      message: body.error || res.statusText || 'Request failed',
      status: res.status,
      code: body.code,
      retryAfter,
      trialAvailable: body.trialAvailable,
    });
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Rate-limit latch: a 429 anywhere pauses all polling until the window passes.
// Module-scope store consumed via useSyncExternalStore so every poller and the
// UI banner share one source of truth without a provider.
// ---------------------------------------------------------------------------

let pausedUntil = 0;
const listeners = new Set<() => void>();
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyRateLimited(retryAfterSeconds: number): void {
  const clampedSeconds = Math.min(Math.max(retryAfterSeconds, 5), 120);
  const until = Date.now() + clampedSeconds * 1000;
  if (until <= pausedUntil) return; // already paused at least this long
  pausedUntil = until;
  emit();
  // Re-notify at expiry so subscribers recompute `paused` without polling.
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => {
    expiryTimer = null;
    emit();
  }, clampedSeconds * 1000 + 50);
}

/** Test-only: clear the latch (module state otherwise leaks across fake-timer tests). */
export function resetRateLimitLatch(): void {
  pausedUntil = 0;
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  emit();
}

export function isRatePaused(): boolean {
  return Date.now() < pausedUntil;
}

export function useRateLimitState(): { pausedUntil: number; paused: boolean } {
  const until = useSyncExternalStore(
    subscribe,
    () => pausedUntil,
    () => 0,
  );
  return { pausedUntil: until, paused: until > Date.now() };
}

/** For refetchInterval callbacks: suspend polling while rate-limit-paused or tab in background. */
export function pollInterval(ms: number): number | false {
  if (typeof document !== 'undefined' && document.hidden) return false;
  return isRatePaused() ? false : ms;
}
