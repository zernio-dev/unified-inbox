import type { Attachment } from './types';

// Attachment URLs that require auth (WhatsApp media behind our API key) or
// that browsers can't hotlink reliably (Telegram file CDN) are routed through
// the server-side /api/media proxy. Everything else is loaded directly.
const PROXIED_PREFIXES = ['/api/v1/whatsapp/media/', 'https://api.telegram.org/file/'];

export function resolveMediaUrl(att: Attachment): string | undefined {
  if (!att.url) return undefined;
  if (PROXIED_PREFIXES.some((prefix) => att.url!.startsWith(prefix))) {
    return `/api/media?url=${encodeURIComponent(att.url)}`;
  }
  return att.url;
}

/**
 * Scheme allowlist for message-derived hrefs: only http(s) (including
 * relative paths, which resolve to the page's scheme) may become a link.
 * Blocks javascript:/data:/etc. smuggled in platform payloads.
 */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    // The base only matters for relative urls; absolute urls keep their own
    // protocol. '.invalid' is reserved so it can never collide with a real host.
    const { protocol } = new URL(url, 'https://relative.invalid');
    return protocol === 'http:' || protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}
