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
