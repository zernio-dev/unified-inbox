import { describe, expect, it } from 'vitest';
import { resolveMediaUrl, safeHref } from '../media';

describe('resolveMediaUrl', () => {
  it('returns undefined when the attachment has no url', () => {
    expect(resolveMediaUrl({ type: 'image' })).toBeUndefined();
  });

  it('proxies WhatsApp media paths', () => {
    expect(resolveMediaUrl({ type: 'image', url: '/api/v1/whatsapp/media/abc123' })).toBe(
      `/api/media?url=${encodeURIComponent('/api/v1/whatsapp/media/abc123')}`,
    );
  });

  it('proxies Telegram file CDN urls', () => {
    const url = 'https://api.telegram.org/file/bot123/photos/p.jpg';
    expect(resolveMediaUrl({ type: 'image', url })).toBe(
      `/api/media?url=${encodeURIComponent(url)}`,
    );
  });

  it('passes any other url through untouched', () => {
    expect(resolveMediaUrl({ type: 'image', url: 'https://cdn.example.com/a.jpg' })).toBe(
      'https://cdn.example.com/a.jpg',
    );
  });
});

describe('safeHref', () => {
  it('allows http and https urls', () => {
    expect(safeHref('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(safeHref('http://example.com/a.jpg')).toBe('http://example.com/a.jpg');
  });

  it('allows relative paths (resolve to the page scheme)', () => {
    expect(safeHref('/api/media?url=x')).toBe('/api/media?url=x');
  });

  it('blocks non-http(s) schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>1</script>')).toBeUndefined();
    expect(safeHref('vbscript:msgbox')).toBeUndefined();
    expect(safeHref('blob:https://example.com/uuid')).toBeUndefined();
  });

  it('blocks scheme smuggling with whitespace/control prefixes', () => {
    expect(safeHref(' \tjavascript:alert(1)')).toBeUndefined();
  });

  it('returns undefined for empty / missing input', () => {
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
  });
});
