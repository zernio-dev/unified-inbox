const BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_ZERNIO_URL ||
  process.env.ZERNIO_API_URL ||
  process.env.ZERNIO_URL ||
  'https://zernio.com/api'
).replace(/\/$/, '');

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

import { getSupabaseServerClient } from './supabase';

export function zernioBase(): string {
  return BASE;
}

export async function resolveApiKey(req?: Request): Promise<string> {
  const headerKey = req?.headers.get('x-zernio-key');
  if (headerKey) return headerKey.trim();

  let cookieHeader = req?.headers.get('cookie') || '';
  let tenantId = req?.headers.get('x-tenant-id') || null;

  // Fallback to next/headers se req foi omitido ou não traz headers
  if (!cookieHeader || !tenantId) {
    try {
      const { cookies, headers } = await import('next/headers');
      if (!cookieHeader) {
        const cStore = await cookies();
        cookieHeader = cStore.toString();
      }
      if (!tenantId) {
        const hStore = await headers();
        tenantId = hStore.get('x-tenant-id');
      }
    } catch {}
  }

  const keyCookieMatch = cookieHeader.match(/zernio_api_key=([^;]+)/);
  if (keyCookieMatch) {
    try {
      const decoded = decodeURIComponent(keyCookieMatch[1]).trim();
      if (decoded) return decoded;
    } catch {}
  }

  // Tenta extrair tenant_id de cabeçalhos, URL ou cookies
  if (!tenantId && req?.headers) {
    tenantId = req.headers.get('x-tenant-id');
  }

  if (!tenantId && req?.url) {
    try {
      const url = new URL(req.url);
      tenantId = url.searchParams.get('tenant_id');
    } catch {}
  }

  if (!tenantId) {
    const tenantCookieMatch = cookieHeader.match(/(?:^|;\s*)(?:inbox_)?tenant_id=([^;]+)/);
    if (tenantCookieMatch) {
      tenantId = decodeURIComponent(tenantCookieMatch[1]);
    }
  }

  if (tenantId) {
    try {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        // 1. Tenta carregar via RPC segura SECURITY DEFINER (funciona com Anon Key ou Service Role)
        try {
          const { data: rpcKey, error: rpcErr } = await supabase.rpc('get_tenant_zernio_key', {
            p_tenant_id: tenantId,
          });
          if (!rpcErr && rpcKey && typeof rpcKey === 'string' && rpcKey.trim()) {
            return rpcKey.trim();
          }
        } catch {}

        // 2. Tenta carregar do cofre protegido tenant_secrets diretamente (quando Service Role estiver presente)
        const { data: secretData } = await supabase
          .from('tenant_secrets')
          .select('secret_value')
          .eq('tenant_id', tenantId)
          .eq('secret_key', 'zernio_api_key')
          .maybeSingle();

        if (secretData?.secret_value && typeof secretData.secret_value === 'string' && secretData.secret_value.trim()) {
          return secretData.secret_value.trim();
        }

        // 3. Fallback legado: se ainda estiver no JSON de tenants.settings
        const { data } = await supabase
          .from('tenants')
          .select('settings')
          .eq('id', tenantId)
          .maybeSingle();

        const s = (data?.settings as Record<string, any>) || {};
        if (s.zernio_api_key && typeof s.zernio_api_key === 'string' && s.zernio_api_key.trim()) {
          return s.zernio_api_key.trim();
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar zernio_api_key por tenant_id:', e);
    }
  }

  return (process.env.ZERNIO_API_KEY || '').trim();
}

export function hasApiKey(_req?: Request): boolean {
  return true;
}

export function missingKeyResponse(): Response {
  return Response.json(
    {
      error: 'ZERNIO_API_KEY não configurada. Defina a Chave da Zernio em Configurações > Caixa de Entrada & Zernio ou nas configurações do Inbox.',
      code: 'missing_api_key',
    },
    { status: 500 },
  );
}

export async function zernioFetch(path: string, init?: RequestInit, req?: Request): Promise<Response> {
  const apiKey = await resolveApiKey(req);
  if (!apiKey) {
    return missingKeyResponse();
  }
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
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
  const upstream = await zernioFetch(`${path}${forwardQuery(req, query)}`, init, req);
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
  return zernioFetch(opts.path, init, opts.req);
}
