import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

const PATH = '/v1/whatsapp/calls';

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({
    req,
    path: PATH,
    query: ['accountId', 'status', 'direction', 'since', 'until', 'before', 'limit'],
  });
}

export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: PATH, method: 'POST', jsonBody: true });
}
