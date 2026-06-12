import { hasApiKey, missingKeyResponse, zernioFetch } from '@/lib/server/zernio';

const WHATSAPP_MEDIA_PATH = /^\/api\/v1\/whatsapp\/media\/[^?]+/;
const TELEGRAM_FILE_URL = /^https:\/\/api\.telegram\.org\/file\//;

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();

  // searchParams already decoded once; collapse any remaining encoded layers
  // (stable point, max 3) so %2E%2E / double-encoding can't smuggle a
  // traversal past the '..' check below. The decoded form is also what gets
  // fetched, so check and fetch can't disagree.
  let url = new URL(req.url).searchParams.get('url') ?? '';
  for (let i = 0; i < 3; i++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      break; // malformed escape: keep the last good form
    }
    if (decoded === url) break;
    url = decoded;
  }

  let upstream: Response;
  if (WHATSAPP_MEDIA_PATH.test(url) && !url.includes('..')) {
    // BASE already ends in /api, so strip the local /api prefix. Auth required upstream.
    upstream = await zernioFetch(url.replace(/^\/api/, ''));
  } else if (TELEGRAM_FILE_URL.test(url)) {
    // Public Telegram file CDN: never send our Authorization header to it.
    upstream = await fetch(url, { cache: 'no-store' });
  } else {
    return Response.json({ error: 'URL not allowed', code: 'invalid_field_value' }, { status: 400 });
  }

  // Stream the body through; never buffer media.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
