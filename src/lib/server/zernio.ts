const BASE = (process.env.ZERNIO_API_URL || 'https://zernio.com/api').replace(/\/$/, '');

// fetch() supports half-duplex streaming bodies but RequestInit doesn't declare `duplex` yet.
interface DuplexRequestInit extends RequestInit {
  duplex: 'half';
}

const FORWARDED_HEADERS = [
  'content-type',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'retry-after',
];

export function zernioBase(): string {
  return BASE;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY);
}

export function missingKeyResponse(): Response {
  return Response.json(
    {
      error: 'ZERNIO_API_KEY is not set. Add it to your environment and restart.',
      code: 'missing_api_key',
    },
    { status: 500 },
  );
}

export function zernioFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${process.env.ZERNIO_API_KEY}`);
  return fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store' });
}

function pickForwardHeaders(from: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = from.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

/** Forward an upstream response unchanged: body stream, status, and rate-limit headers. */
export function passthrough(upstream: Response): Response {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: pickForwardHeaders(upstream.headers),
  });
}

/** JSON response that still carries the upstream status + rate-limit headers (for post-filtered bodies). */
export function jsonWithUpstreamHeaders(body: unknown, upstream: Response): Response {
  const headers = pickForwardHeaders(upstream.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status: upstream.status, headers });
}

export function forwardQuery(req: Request, allowed: string[]): string {
  const incoming = new URL(req.url).searchParams;
  const out = new URLSearchParams();
  for (const key of allowed) {
    const value = incoming.get(key);
    if (value !== null) out.set(key, value);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}

/** One-shot proxy: forward allowed query params and (optionally) the JSON body, return passthrough. */
export async function proxy(opts: {
  req: Request;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: string[];
  jsonBody?: boolean;
}): Promise<Response> {
  const { req, path, method = 'GET', query = [], jsonBody = false } = opts;
  const init: RequestInit = { method };
  if (jsonBody) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON body', code: 'invalid_field_value' },
        { status: 400 },
      );
    }
    init.body = JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  const upstream = await zernioFetch(`${path}${forwardQuery(req, query)}`, init);
  return passthrough(upstream);
}

/** Stream a multipart request body to upstream without buffering it. */
export function forwardMultipart(opts: { req: Request; path: string }): Promise<Response> {
  const init: DuplexRequestInit = {
    method: 'POST',
    body: opts.req.body,
    headers: {
      'content-type': opts.req.headers.get('content-type') ?? 'multipart/form-data',
    },
    duplex: 'half',
  };
  return zernioFetch(opts.path, init);
}
