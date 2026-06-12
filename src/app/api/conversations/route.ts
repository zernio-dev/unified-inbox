import { fetchMessageAccounts, readSettings } from '@/lib/server/settings';
import {
  forwardQuery,
  hasApiKey,
  jsonWithUpstreamHeaders,
  missingKeyResponse,
  passthrough,
  proxy,
  zernioFetch,
} from '@/lib/server/zernio';

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();

  const qs = forwardQuery(req, ['platform', 'accountId', 'status', 'sortOrder', 'limit', 'cursor']);
  const upstream = await zernioFetch(`/v1/inbox/conversations${qs}`);
  if (!upstream.ok) return passthrough(upstream);

  // With an explicit accountId the caller already scoped the result; otherwise
  // apply the cookie-selected account set server-side.
  if (new URL(req.url).searchParams.has('accountId')) return passthrough(upstream);

  const result = await fetchMessageAccounts();
  if (result instanceof Response) return result;
  const { selectedAccountIds } = readSettings({
    accounts: result.accounts,
    cookieHeader: req.headers.get('cookie'),
  });
  const selected = new Set(selectedAccountIds);

  const body = (await upstream.json()) as { data?: { accountId?: string }[] };
  const data = (body.data ?? []).filter(
    (c) => typeof c.accountId === 'string' && selected.has(c.accountId),
  );
  // Spread preserves pagination and meta (incl. meta.failedAccounts) as-is.
  return jsonWithUpstreamHeaders({ ...body, data }, upstream);
}

export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/inbox/conversations', method: 'POST', jsonBody: true });
}
