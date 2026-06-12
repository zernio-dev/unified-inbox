import {
  fetchMessageAccounts,
  hasSettingsCookie,
  readSettings,
  serializeSettingsCookie,
} from '@/lib/server/settings';
import { hasApiKey, missingKeyResponse } from '@/lib/server/zernio';

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();

  const result = await fetchMessageAccounts();
  if (result instanceof Response) return result;

  const cookieHeader = req.headers.get('cookie');
  const { selectedAccountIds } = readSettings({ accounts: result.accounts, cookieHeader });
  return Response.json({ selectedAccountIds, hasCookie: hasSettingsCookie(cookieHeader) });
}

export async function PUT(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();

  const body: unknown = await req.json().catch(() => null);
  const ids = extractSelectedAccountIds(body);
  if (ids === null) {
    return Response.json(
      { error: 'selectedAccountIds must be an array of strings', code: 'invalid_field_value' },
      { status: 400 },
    );
  }

  const result = await fetchMessageAccounts();
  if (result instanceof Response) return result;

  const live = new Set(result.accounts.map((a) => a._id));
  const sanitized = [...new Set(ids)].filter((id) => live.has(id));
  return Response.json(
    { selectedAccountIds: sanitized },
    { headers: { 'Set-Cookie': serializeSettingsCookie(sanitized) } },
  );
}

function extractSelectedAccountIds(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const ids = (body as Record<string, unknown>).selectedAccountIds;
  if (!Array.isArray(ids) || !ids.every((v) => typeof v === 'string')) return null;
  return ids.filter((v): v is string => typeof v === 'string');
}
