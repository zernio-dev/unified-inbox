import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

const PATH = '/v1/whatsapp/block-users';

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: PATH, query: ['accountId', 'limit', 'after'] });
}

export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: PATH, method: 'POST', jsonBody: true });
}

export async function DELETE(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: PATH, method: 'DELETE', jsonBody: true });
}
