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
import { resolveOrProvisionContact } from '@/lib/server/contactResolver';

export async function GET(req: Request) {
  if (!hasApiKey(req)) return missingKeyResponse();

  const qs = forwardQuery(req, ['platform', 'accountId', 'status', 'sortOrder', 'limit', 'cursor']);
  const upstream = await zernioFetch(`/v1/inbox/conversations${qs}`, undefined, req);
  if (!upstream.ok) return passthrough(upstream);

  const url = new URL(req.url);
  const explicitAccount = url.searchParams.has('accountId');

  const body = (await upstream.json()) as { data?: Array<Record<string, unknown>> };
  let data = body.data ?? [];

  if (!explicitAccount) {
    const result = await fetchMessageAccounts({ req });
    if (result instanceof Response) return result;
    const { selectedAccountIds } = readSettings({
      accounts: result.accounts,
      cookieHeader: req.headers.get('cookie'),
    });
    const selected = new Set(selectedAccountIds);
    data = data.filter((c) => typeof c.accountId === 'string' && selected.has(c.accountId));
  }

  // Trigger background contact auto-provisioning for Zernio conversations
  if (Array.isArray(data) && data.length > 0) {
    Promise.allSettled(
      data.map((c) => {
        const rawPhone = c.phoneNumber || c.phone || c.recipientPhone || c.customerPhone || c.externalId || (typeof c.id === 'string' && c.id.includes('@') ? c.id.split('@')[0] : null);
        const rawName = typeof c.name === 'string' ? c.name : typeof c.contactName === 'string' ? c.contactName : typeof c.profileName === 'string' ? c.profileName : typeof c.pushName === 'string' ? c.pushName : undefined;
        const avatarUrl = typeof c.avatarUrl === 'string' ? c.avatarUrl : typeof c.profilePicUrl === 'string' ? c.profilePicUrl : undefined;
        if (rawPhone) {
          return resolveOrProvisionContact({ phone: String(rawPhone), name: rawName, avatarUrl });
        }
        return Promise.resolve(null);
      })
    ).catch(() => {});
  }

  return jsonWithUpstreamHeaders({ ...body, data }, upstream);
}

export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/inbox/conversations', method: 'POST', jsonBody: true });
}

