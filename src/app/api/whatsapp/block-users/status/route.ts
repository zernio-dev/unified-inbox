import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/whatsapp/block-users/status', query: ['accountId', 'user'] });
}
