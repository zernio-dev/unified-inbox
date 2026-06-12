import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from '../media';

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
