import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { conversationId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/inbox/conversations/${encodeURIComponent(conversationId)}`,
    query: ['accountId'],
  });
}

// Upstream archive/update is PUT (PATCH would 405).
export async function PUT(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { conversationId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/inbox/conversations/${encodeURIComponent(conversationId)}`,
    method: 'PUT',
    jsonBody: true,
  });
}
