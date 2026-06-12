import type { Message, Platform } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const STUB_MATCH_WINDOW_MS = 120_000;

/**
 * WhatsApp Cloud API only allows free-form replies within 24h of the last
 * customer (incoming) message; outside that window only approved templates
 * can be sent, so the composer must swap to the template picker.
 */
export function isWhatsAppOutside24h({
  platform,
  messages,
  messagesLoading,
  now = Date.now(),
}: {
  platform: Platform | undefined;
  messages: Message[];
  messagesLoading: boolean;
  now?: number;
}): boolean {
  if (platform !== 'whatsapp') return false;
  if (messagesLoading) return false; // don't flash the template picker while the thread loads
  const lastIncoming = [...messages].reverse().find((m) => m.direction === 'incoming');
  if (!lastIncoming) return true;
  return now - new Date(lastIncoming.createdAt).getTime() > DAY_MS;
}

/**
 * Drop optimistic pending stubs once the server copy of the same outgoing
 * message (same trimmed text, sent within 2 minutes) shows up in the thread.
 */
export function suppressDeliveredStubs(pending: Message[], server: Message[]): Message[] {
  const serverOutgoing = server.filter((s) => s.direction === 'outgoing');
  return pending.filter(
    (p) =>
      !serverOutgoing.some(
        (s) =>
          Math.abs(new Date(s.createdAt).getTime() - new Date(p.createdAt).getTime()) <
            STUB_MATCH_WINDOW_MS && (s.message ?? '').trim() === (p.message ?? '').trim()
      )
  );
}

export const isOptimisticId = (id: string) => id.startsWith('temp-') || id.startsWith('new_');
