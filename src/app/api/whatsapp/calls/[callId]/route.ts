import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ callId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { callId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/calls/${encodeURIComponent(callId)}`,
    query: ['accountId'],
  });
}
