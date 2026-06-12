import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ conversationId: string; messageId: string }> };

async function reactionsPath(ctx: Ctx): Promise<string> {
  const { conversationId, messageId } = await ctx.params;
  return `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions`;
}

export async function POST(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: await reactionsPath(ctx), method: 'POST', jsonBody: true });
}

// Upstream takes accountId as a QUERY param on DELETE (no body).
export async function DELETE(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: await reactionsPath(ctx), method: 'DELETE', query: ['accountId'] });
}
