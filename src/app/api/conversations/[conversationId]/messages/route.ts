import {
  forwardMultipart,
  hasApiKey,
  missingKeyResponse,
  passthrough,
  proxy,
} from '@/lib/server/zernio';

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { conversationId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
    query: ['accountId', 'limit', 'cursor', 'sortOrder'],
  });
}

export async function POST(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { conversationId } = await ctx.params;
  const path = `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return passthrough(await forwardMultipart({ req, path }));
  }
  return proxy({ req, path, method: 'POST', jsonBody: true });
}
