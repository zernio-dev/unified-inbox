'use client';

import { Download, ExternalLink, FileText, ImageIcon } from 'lucide-react';
import { PLATFORM_LABELS } from '@/components/platform-icon';
import { resolveMediaUrl } from '@/lib/media';
import type { Attachment, Platform } from '@/lib/types';

const VIDEO_TYPES = ['video', 'ig_reel', 'reel'];
// Shared posts/stories: legacy DB records pre-dating webhook normalization
// (which now maps them all to 'share') still carry the original Meta types.
const SHARE_TYPES = ['ig_post', 'share', 'ig_story', 'story_mention', 'post'];

const LINK_ROW =
  'flex items-center gap-2 rounded-lg bg-foreground/5 p-2 transition-colors hover:bg-foreground/10';

function payloadTitle(att: Attachment): string | undefined {
  return typeof att.payload?.title === 'string' && att.payload.title ? att.payload.title : undefined;
}

export function AttachmentView({ att, platform }: { att: Attachment; platform: Platform }) {
  const url = resolveMediaUrl(att);

  // Media the platform won't let us hotlink inline (e.g. X DM photos need
  // OAuth 1.0a) gets an open-on-platform row instead.
  if (att.requiresExternalView && att.url) {
    return (
      <a href={att.url} target="_blank" rel="nofollow noopener noreferrer" className={LINK_ROW}>
        <ImageIcon className="size-5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{att.name || `View on ${PLATFORM_LABELS[platform]}`}</span>
        <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </a>
    );
  }

  if (att.type === 'image' && url) {
    return (
      <a href={url} target="_blank" rel="nofollow noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={att.name || 'Image attachment'}
          loading="lazy"
          className="max-h-48 max-w-full cursor-pointer rounded transition-opacity hover:opacity-90"
        />
      </a>
    );
  }

  if (VIDEO_TYPES.includes(att.type) && url) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        poster={att.previewUrl}
        className="max-h-48 max-w-full rounded"
      />
    );
  }

  if (att.type === 'audio' && url) {
    return <audio src={url} controls className="w-full max-w-full" />;
  }

  if (att.type === 'file' && url) {
    return (
      <a href={url} target="_blank" rel="nofollow noopener noreferrer" className={LINK_ROW}>
        <FileText className="size-5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{att.name || 'Download file'}</span>
        <Download className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </a>
    );
  }

  if (att.type === 'sticker' && url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Sticker" loading="lazy" className="max-h-[120px] max-w-[120px] rounded" />;
  }

  if (SHARE_TYPES.includes(att.type) && att.url) {
    return (
      <a href={att.url} target="_blank" rel="nofollow noopener noreferrer" className={LINK_ROW}>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{payloadTitle(att) || 'Shared content'}</span>
      </a>
    );
  }

  // Catch-all for unknown platform types (template, fallback, ephemeral, ...)
  // so message bubbles are never completely empty.
  if (att.url) {
    return (
      <a href={att.url} target="_blank" rel="nofollow noopener noreferrer" className={LINK_ROW}>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{payloadTitle(att) || 'Shared content'}</span>
      </a>
    );
  }
  return <span className="text-xs italic text-muted-foreground">{payloadTitle(att) || '[Shared content]'}</span>;
}
