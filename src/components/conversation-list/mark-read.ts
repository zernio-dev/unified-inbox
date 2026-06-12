import { apiFetch } from '@/lib/api-client';
import type { Conversation } from '@/lib/types';

/**
 * Optimistically clear the unread badge and tell the server a human opened
 * the thread (on WhatsApp this is what sends blue ticks). Fire and forget:
 * a failed read receipt must never block opening the conversation.
 */
export function markConversationRead({
  conversation,
  patchConversation,
}: {
  conversation: Conversation;
  patchConversation: (id: string, patch: Partial<Conversation>) => void;
}): void {
  if (conversation.unreadCount) {
    patchConversation(conversation.id, { unreadCount: 0 });
  }
  void apiFetch(`/api/conversations/${encodeURIComponent(conversation.id)}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: conversation.accountId }),
  }).catch(() => {
    // Best-effort; the head poll reconciles unread state eventually.
  });
}
