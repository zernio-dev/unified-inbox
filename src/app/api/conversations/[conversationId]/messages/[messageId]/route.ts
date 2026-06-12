import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ conversationId: string; messageId: string }> };

async function messagePath(ctx: Ctx): Promise<string> {
  const { conversationId, messageId } = await ctx.params;
  return `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`;
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: await messagePath(ctx), method: 'PATCH', jsonBody: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: await messagePath(ctx), method: 'DELETE', query: ['accountId'] });
}
