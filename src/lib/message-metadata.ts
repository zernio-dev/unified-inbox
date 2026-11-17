import type { Attachment, Message, MessageReaction } from './types';

/**
 * Type-safe readers for Message.metadata (a Record<string, unknown> over the
 * wire). Every accessor validates shape at runtime so the renderers never
 * cast; malformed payloads degrade to undefined / a tolerant fallback.
 */

type Meta = Record<string, unknown> | undefined;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function metaString(meta: Meta, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Normalize message objects from Zernio / WhatsApp APIs so attachments and reactions are guaranteed. */
export function normalizeMessage(m: Message): Message {
  if (!m) return m;
  const norm = { ...m };
  const meta = norm.metadata || {};

  // 1. Normalize attachments if missing or empty, OR sanitize existing attachments
  if (!norm.attachments || norm.attachments.length === 0) {
    const extractedAttachments: Attachment[] = [];

    const directUrl =
      (typeof (norm as unknown as Record<string, unknown>).mediaUrl === 'string' && (norm as unknown as Record<string, unknown>).mediaUrl as string) ||
      (typeof (norm as unknown as Record<string, unknown>).url === 'string' && (norm as unknown as Record<string, unknown>).url as string) ||
      (typeof (norm as unknown as Record<string, unknown>).fileUrl === 'string' && (norm as unknown as Record<string, unknown>).fileUrl as string) ||
      metaString(meta, 'mediaUrl') ||
      metaString(meta, 'media_url') ||
      metaString(meta, 'url') ||
      metaString(meta, 'fileUrl') ||
      metaString(meta, 'file_url') ||
      metaString(meta, 'link');

    const audioObj = isRecord(meta.audio)
      ? meta.audio
      : isRecord(meta.voice)
      ? meta.voice
      : isRecord(meta.ptt)
      ? meta.ptt
      : isRecord(meta.audioMessage)
      ? meta.audioMessage
      : isRecord(meta.voiceNote)
      ? meta.voiceNote
      : isRecord(meta.voice_note)
      ? meta.voice_note
      : isRecord(meta.voicenote)
      ? meta.voicenote
      : isRecord(meta.voice_message)
      ? meta.voice_message
      : undefined;

    const imageObj = isRecord(meta.image) ? meta.image : isRecord(meta.photo) ? meta.photo : undefined;
    const videoObj = isRecord(meta.video) ? meta.video : isRecord(meta.reel) ? meta.reel : undefined;
    const docObj = isRecord(meta.document) ? meta.document : isRecord(meta.file) ? meta.file : undefined;
    const stickerObj = isRecord(meta.sticker) ? meta.sticker : undefined;

    const audioUrl =
      metaString(audioObj, 'url') ||
      metaString(audioObj, 'mediaUrl') ||
      metaString(audioObj, 'media_url') ||
      metaString(audioObj, 'fileUrl') ||
      metaString(audioObj, 'link');

    const imageUrl = metaString(imageObj, 'url') || metaString(imageObj, 'mediaUrl');
    const videoUrl = metaString(videoObj, 'url') || metaString(videoObj, 'mediaUrl');
    const docUrl = metaString(docObj, 'url') || metaString(docObj, 'mediaUrl');
    const stickerUrl = metaString(stickerObj, 'url') || metaString(stickerObj, 'mediaUrl');

    const msgType = (metaString(meta, 'messageType') || metaString(meta, 'type') || '').toLowerCase();

    if (
      audioUrl ||
      msgType.includes('audio') ||
      msgType.includes('voice') ||
      msgType.includes('ptt') ||
      msgType.includes('recording')
    ) {
      const url = audioUrl || directUrl;
      if (url) extractedAttachments.push({ type: 'audio', url });
    } else if (imageUrl || msgType.includes('image')) {
      const url = imageUrl || directUrl;
      if (url) extractedAttachments.push({ type: 'image', url });
    } else if (videoUrl || msgType.includes('video')) {
      const url = videoUrl || directUrl;
      if (url) extractedAttachments.push({ type: 'video', url });
    } else if (stickerUrl || msgType.includes('sticker')) {
      const url = stickerUrl || directUrl;
      if (url) extractedAttachments.push({ type: 'sticker', url });
    } else if (docUrl || msgType.includes('document') || msgType.includes('file')) {
      const url = docUrl || directUrl;
      if (url) extractedAttachments.push({ type: 'file', url });
    } else if (directUrl) {
      extractedAttachments.push({ type: 'file', url: directUrl });
    }

    if (extractedAttachments.length > 0) {
      norm.attachments = extractedAttachments;
    }
  } else {
    // Sanitize pre-existing attachments array
    norm.attachments = norm.attachments.map((att) => {
      const copy = { ...att };
      const rawUrl =
        copy.url ||
        (copy as unknown as Record<string, unknown>).mediaUrl as string ||
        (copy as unknown as Record<string, unknown>).fileUrl as string ||
        (copy as unknown as Record<string, unknown>).link as string;
      if (!copy.url && rawUrl) {
        copy.url = rawUrl;
      }
      const typeLower = (copy.type || '').toLowerCase();
      if (
        typeLower.includes('audio') ||
        typeLower.includes('voice') ||
        typeLower.includes('ptt') ||
        typeLower.includes('recording')
      ) {
        copy.type = 'audio';
      }
      return copy;
    });
  }

  // 2. Normalize reactions if missing
  if (!norm.reactions || norm.reactions.length === 0) {
    const rawReaction = meta.reaction || meta.reactions;
    if (isRecord(rawReaction) && typeof rawReaction.emoji === 'string') {
      norm.reactions = [
        {
          emoji: rawReaction.emoji,
          fromMe: Boolean(rawReaction.fromMe),
        },
      ];
    } else if (Array.isArray(rawReaction)) {
      const list = rawReaction.flatMap((r): MessageReaction[] =>
        isRecord(r) && typeof r.emoji === 'string'
          ? [{ emoji: r.emoji, fromMe: Boolean(r.fromMe) }]
          : [],
      );
      if (list.length > 0) {
        norm.reactions = list;
      }
    }
  }

  return norm;
}

/** Call-event rows (WhatsApp call.received / call.ended) render as a system pill, not a bubble. */
export function isCallEvent(meta: Meta): boolean {
  return metaString(meta, 'kind') === 'call';
}

/** platformMessageId of the message this one quotes (WhatsApp context / Telegram reply). */
export function getQuotedMessageId(meta: Meta): string | undefined {
  return metaString(meta, 'quotedMessageId');
}

/**
 * Label for the quick-reply / postback / callback badge, or undefined when the
 * message carries none. Presence is keyed on the payload fields; the visible
 * text prefers the human-readable postback title.
 */
export function getQuickReplyBadge(meta: Meta): string | undefined {
  const quickReply = metaString(meta, 'quickReplyPayload');
  const postback = metaString(meta, 'postbackPayload');
  const callback = metaString(meta, 'callbackData');
  if (!quickReply && !postback && !callback) return undefined;
  return metaString(meta, 'postbackTitle') || quickReply || callback || postback;
}

// ── WhatsApp interactive (metadata.waInteractive) ───────────────────────────
// Compact mirror of what the recipient sees (buttons / list / CTA / flow /
// location request / call button). Shapes match the dashboard's
// whatsapp-interactive-meta; anything unrecognized parses to { kind: 'unknown' }
// so the bubble still shows a generic "Interactive message" chip.

export type WaInteractive =
  | { kind: 'buttons'; buttons: string[] }
  | { kind: 'list'; button: string; rows: { title: string; description?: string }[] }
  | { kind: 'cta_url'; label: string; url: string }
  | { kind: 'flow'; label: string }
  | { kind: 'location_request' }
  | { kind: 'voice_call'; label: string }
  | { kind: 'unknown' };

export function getWaInteractive(meta: Meta): WaInteractive | undefined {
  const raw = meta?.['waInteractive'];
  if (!isRecord(raw)) return undefined;

  const { kind } = raw;
  if (kind === 'buttons' && Array.isArray(raw.buttons)) {
    const buttons = raw.buttons.filter((b): b is string => typeof b === 'string');
    if (buttons.length > 0) return { kind: 'buttons', buttons };
  }
  if (kind === 'list' && typeof raw.button === 'string') {
    const rows = Array.isArray(raw.rows)
      ? raw.rows.flatMap((r) =>
          isRecord(r) && typeof r.title === 'string'
            ? [
                {
                  title: r.title,
                  ...(typeof r.description === 'string' ? { description: r.description } : {}),
                },
              ]
            : [],
        )
      : [];
    return { kind: 'list', button: raw.button, rows };
  }
  if (kind === 'cta_url' && typeof raw.label === 'string' && typeof raw.url === 'string') {
    return { kind: 'cta_url', label: raw.label, url: raw.url };
  }
  if (kind === 'flow' && typeof raw.label === 'string') {
    return { kind: 'flow', label: raw.label };
  }
  if (kind === 'location_request') {
    return { kind: 'location_request' };
  }
  if (kind === 'voice_call') {
    return { kind: 'voice_call', label: typeof raw.label === 'string' ? raw.label : 'Call Now' };
  }
  return { kind: 'unknown' };
}

// ── Location pin (metadata.location) ────────────────────────────────────────

export interface MessageLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export function getLocation(meta: Meta): MessageLocation | undefined {
  const raw = meta?.['location'];
  if (!isRecord(raw)) return undefined;
  if (typeof raw.latitude !== 'number' || typeof raw.longitude !== 'number') return undefined;
  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
    ...(typeof raw.address === 'string' ? { address: raw.address } : {}),
  };
}

// ── Contact cards (metadata.contacts) ───────────────────────────────────────

export interface MessageContact {
  formattedName: string;
  phone?: string;
}

export function getContacts(meta: Meta): MessageContact[] {
  const raw = meta?.['contacts'];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c): MessageContact[] => {
    if (!isRecord(c)) return [];
    const formattedName =
      isRecord(c.name) && typeof c.name.formatted_name === 'string'
        ? c.name.formatted_name
        : 'Contact';
    const phone = Array.isArray(c.phones)
      ? c.phones
          .map((p) => (isRecord(p) && typeof p.phone === 'string' ? p.phone : undefined))
          .find((p): p is string => !!p)
      : undefined;
    return [{ formattedName, ...(phone ? { phone } : {}) }];
  });
}
