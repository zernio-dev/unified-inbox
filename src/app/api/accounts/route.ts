import { fetchMessageAccounts, readSettings } from '@/lib/server/settings';
import { hasApiKey, missingKeyResponse } from '@/lib/server/zernio';

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();

  const result = await fetchMessageAccounts();
  if (result instanceof Response) return result;

  const { selectedAccountIds } = readSettings({
    accounts: result.accounts,
    cookieHeader: req.headers.get('cookie'),
  });
  return Response.json({
    accounts: result.accounts,
    profiles: result.profiles,
    selectedAccountIds,
  });
}
