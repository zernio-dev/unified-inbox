import { hasApiKey, missingKeyResponse, zernioFetch } from '@/lib/server/zernio';

const TELEGRAM_FILE_URL = /^https:\/\/api\.telegram\.org\/file\//;

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();

  let urlParam = new URL(req.url).searchParams.get('url') ?? '';
  for (let i = 0; i < 3; i++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(urlParam);
    } catch {
      break;
    }
    if (decoded === urlParam) break;
    urlParam = decoded;
  }

  if (!urlParam || urlParam.includes('..')) {
    return Response.json({ error: 'Invalid URL', code: 'invalid_field_value' }, { status: 400 });
  }

  let upstream: Response = new Response(null, { status: 500 });

  // If urlParam is an absolute URL to an external server (Telegram, S3, Supabase Storage, Meta CDN, etc.)
  // fetch it directly instead of proxying through Zernio API
  const isAbsoluteUrl = urlParam.startsWith('http://') || urlParam.startsWith('https://');
  const isTelegram = TELEGRAM_FILE_URL.test(urlParam);
  
  // Zernio base check
  const zernioBaseUrl = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_ZERNIO_URL ||
    process.env.ZERNIO_API_URL ||
    process.env.ZERNIO_URL ||
    'https://zernio.com/api'
  ).replace(/\/$/, '');

  const isZernioDomain = isAbsoluteUrl && urlParam.startsWith(zernioBaseUrl);

  if (isTelegram || (isAbsoluteUrl && !isZernioDomain)) {
    try {
      upstream = await fetch(urlParam, { cache: 'no-store' });
    } catch {
      return Response.json({ error: 'Failed to fetch media from upstream', code: 'upstream_error' }, { status: 502 });
    }
  } else {
    let cleanPath = urlParam;
    if (isZernioDomain) {
      try {
        const parsed = new URL(cleanPath);
        cleanPath = parsed.pathname + parsed.search;
      } catch {
        // use as is
      }
    }

    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.slice(4);
    }

    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    const reqHeaders = new Headers();
    const range = req.headers.get('range');
    if (range) {
      reqHeaders.set('range', range);
    }

    let attempts = 0;
    while (attempts < 4) {
      attempts++;
      upstream = await zernioFetch(cleanPath, { headers: reqHeaders });
      if (upstream.status !== 429) break;
      if (attempts < 4) {
        const jitter = Math.floor(Math.random() * 500) + 200;
        const backoff = Math.pow(2, attempts) * 150 + jitter;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const cacheControl = upstream.ok
    ? 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
    : upstream.headers.get('cache-control') ?? 'no-store';
  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  const acceptRanges = upstream.headers.get('accept-ranges');

  responseHeaders.set('Content-Type', contentType);
  responseHeaders.set('Cache-Control', cacheControl);
  if (contentLength) responseHeaders.set('Content-Length', contentLength);
  if (contentRange) responseHeaders.set('Content-Range', contentRange);
  if (acceptRanges) responseHeaders.set('Accept-Ranges', acceptRanges);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

