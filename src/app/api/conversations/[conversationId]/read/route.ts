import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ conversationId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { conversationId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/read`,
    method: 'POST',
    jsonBody: true,
  });
}
