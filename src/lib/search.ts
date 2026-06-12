import { isOptimisticId } from './optimistic';
import type { Message } from './types';

const MIN_QUERY_LENGTH = 2;

/**
 * In-thread search: ids of the loaded messages matching `query`, in the same
 * chronological (oldest-first) order as the input. Case-insensitive substring
 * over the message text and attachment names. Deleted messages (tombstones
 * render no text) and optimistic stubs (no stable server id to scroll back to)
 * are skipped.
 */
export function searchMessageIds({
  messages,
  query,
}: {
  messages: Message[];
  query: string;
}): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) return [];
  const out: string[] = [];
  for (const m of messages) {
    if (m.isDeleted || isOptimisticId(m.id)) continue;
    const inText = (m.message ?? '').toLowerCase().includes(q);
    const inAttachments = (m.attachments ?? []).some((a) =>
      (a.name ?? '').toLowerCase().includes(q),
    );
    if (inText || inAttachments) out.push(m.id);
  }
  return out;
}
