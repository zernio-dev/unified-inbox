import type { Attachment } from './types';



function extractUrl(att: Attachment): string | undefined {
  if (att.url) return att.url;
  const rawObj = att as unknown as Record<string, unknown>;
  if (typeof rawObj.mediaUrl === 'string') return rawObj.mediaUrl;
  if (typeof rawObj.fileUrl === 'string') return rawObj.fileUrl;
  if (typeof rawObj.link === 'string') return rawObj.link;
  if (att.payload && typeof att.payload.url === 'string') return att.payload.url;
  return undefined;
}

export function resolveMediaUrl(att: Attachment): string | undefined {
  const rawUrl = extractUrl(att);
  if (!rawUrl) return undefined;
  if (rawUrl.startsWith('/api/media')) return rawUrl;

  const needsProxy =
    rawUrl.startsWith('/') ||
    rawUrl.includes('/v1/') ||
    rawUrl.includes('/whatsapp/media') ||
    rawUrl.includes('/inbox/media') ||
    rawUrl.includes('api.telegram.org/file/');

  if (needsProxy) {
    return `/api/media?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
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
