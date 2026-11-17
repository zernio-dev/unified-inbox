'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, ImageIcon } from 'lucide-react';
import { PLATFORM_LABELS } from '@/components/platform-icon';
import { resolveMediaUrl, safeHref } from '@/lib/media';
import type { Attachment, Platform } from '@/lib/types';

const AUDIO_TYPES = [
  'audio',
  'voice',
  'ptt',
  'audiomessage',
  'voice_note',
  'voicenote',
  'voice_message',
  'voicemessage',
  'recording',
];
const IMAGE_TYPES = ['image', 'photo', 'picture'];
const VIDEO_TYPES = ['video', 'ig_reel', 'reel'];
const FILE_TYPES = ['file', 'document'];
// Shared posts/stories: legacy DB records pre-dating webhook normalization
// (which now maps them all to 'share') still carry the original Meta types.
const SHARE_TYPES = ['ig_post', 'share', 'ig_story', 'story_mention', 'post'];

const LINK_ROW =
  'flex items-center gap-2 rounded-lg bg-foreground/5 p-2 transition-colors hover:bg-foreground/10';

function payloadTitle(att: Attachment): string | undefined {
  return typeof att.payload?.title === 'string' && att.payload.title ? att.payload.title : undefined;
}

export function AttachmentView({ att, platform }: { att: Attachment; platform: Platform }) {
  const [loadError, setLoadError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const url = resolveMediaUrl(att);
  // Message-derived hrefs go through the scheme allowlist; src attributes
  // (img/video/audio) keep `url` as-is.
  const linkHref = safeHref(url);
  const rawHref = safeHref(att.url);
  const mediaUrl = retryNonce > 0 && url ? `${url}${url.includes('?') ? '&' : '?'}retry=${retryNonce}` : url;

  const attTypeLower = (att.type || '').toLowerCase();
  const isAudio =
    AUDIO_TYPES.includes(attTypeLower) ||
    attTypeLower.includes('audio') ||
    attTypeLower.includes('voice') ||
    attTypeLower.includes('ptt') ||
    attTypeLower.includes('recording');

  // Media the platform won't let us hotlink inline (e.g. X DM photos need
  // OAuth 1.0a) gets an open-on-platform row instead.
  if (att.requiresExternalView && rawHref) {
    return (
      <a href={rawHref} target="_blank" rel="nofollow noopener noreferrer" className={LINK_ROW}>
        <ImageIcon className="size-5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{att.name || `View on ${PLATFORM_LABELS[platform]}`}</span>
        <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </a>
    );
  }

  if (IMAGE_TYPES.includes(att.type) && mediaUrl) {
    return (
      <a href={linkHref} target="_blank" rel="nofollow noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt={att.name || 'Image attachment'}
          loading="lazy"
          className="max-h-48 max-w-full cursor-pointer rounded transition-opacity hover:opacity-90"
          onError={() => setLoadError(true)}
        />
      </a>
    );
  }

  if (VIDEO_TYPES.includes(att.type) && mediaUrl) {
    return (
      <video
        src={mediaUrl}
        controls
        preload="metadata"
        poster={att.previewUrl}
        className="max-h-48 max-w-full rounded"
      />
    );
  }

  if (isAudio && mediaUrl) {
    if (loadError) {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-foreground/5 p-2 text-xs text-muted-foreground">
          <span>🎤 Áudio indisponível</span>
          <button
            type="button"
            onClick={() => {
              setLoadError(false);
              setRetryNonce((prev) => prev + 1);
            }}
            className="ml-auto rounded bg-primary/20 px-2 py-0.5 font-medium text-foreground hover:bg-primary/30"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return (
      <div className="my-1 w-full min-w-[220px] max-w-xs rounded-xl bg-foreground/5 p-1.5">
        <audio
          key={mediaUrl}
          src={mediaUrl}
          controls
          preload="metadata"
          className="h-10 w-full rounded-lg"
          onError={() => setLoadError(true)}
        />
      </div>
    );
  }

  if (FILE_TYPES.includes(att.type) && linkHref) {
    return (
      <a href={linkHref} target="_blank" rel="nofollow noopener noreferrer" className={LINK_ROW}>
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

  if (SHARE_TYPES.includes(att.type) && rawHref) {
    return (
      <a href={rawHref} target="_blank" rel="nofollow noopener noreferrer" className={LINK_ROW}>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{payloadTitle(att) || 'Shared content'}</span>
      </a>
    );
  }

  // Catch-all for unknown platform types (template, fallback, ephemeral, ...)
  // so message bubbles are never completely empty.
  if (rawHref) {
    return (
      <a href={rawHref} target="_blank" rel="nofollow noopener noreferrer" className={LINK_ROW}>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{payloadTitle(att) || 'Shared content'}</span>
      </a>
    );
  }
  return <span className="text-xs italic text-muted-foreground">{payloadTitle(att) || '[Shared content]'}</span>;
}
