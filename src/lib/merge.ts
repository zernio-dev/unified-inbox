import { suppressDeliveredStubs } from './optimistic';
import type { Conversation, Message } from './types';

export type ConversationSortKey = 'date-desc' | 'date-asc' | 'unanswered';

/**
 * Conversation ids are only unique per account (two accounts can both have a
 * thread id "123"), so all dedupe keys are account-scoped.
 */
export function conversationKey(c: Pick<Conversation, 'id' | 'accountId'>): string {
  return `${c.accountId || 'default'}-${c.id}`;
}

/**
 * Cursor for the next load-older/load-more page: once older paging has
 * started, only the older chain's cursor is valid; before that, start from the
 * head page's cursor. Centralized so a head poll can never clobber an
 * in-progress paging chain (both list and thread hooks use this).
 */
export function resolveLoadMoreCursor({
  olderInit,
  olderCursor,
  headCursor,
}: {
  olderInit: boolean;
  olderCursor: string | null;
  headCursor: string | null;
}): string | null {
  return olderInit ? olderCursor : headCursor;
}

/**
 * Drop optimistic patches only once the server head row REFLECTS them: every
 * patched field must deep-equal the patch's value on the head row. A head row
 * merely containing the id is not enough (a poll racing a mutation would
 * otherwise revert the optimistic state). Returns the same reference when
 * nothing changed so setState bails.
 */
export function reconcilePatches<T extends { id: string }>({
  patches,
  head,
}: {
  patches: Record<string, Partial<T>>;
  head: T[];
}): Record<string, Partial<T>> {
  const ids = Object.keys(patches);
  if (ids.length === 0) return patches;
  const headById = new Map(head.map((row) => [row.id, row]));
  const next = { ...patches };
  let changed = false;
  for (const id of ids) {
    const row = headById.get(id);
    if (!row) continue;
    const patch = patches[id] as Record<string, unknown>;
    const reflected = Object.keys(patch).every(
      (key) => JSON.stringify((row as Record<string, unknown>)[key]) === JSON.stringify(patch[key]),
    );
    if (reflected) {
      delete next[id];
      changed = true;
    }
  }
  return changed ? next : patches;
}

const updatedAt = (c: Conversation) => new Date(c.updatedTime).getTime();
const byNewest = (a: Conversation, b: Conversation) => updatedAt(b) - updatedAt(a);

/**
 * Render-time merge for the conversation list: server pages (head wins over
 * older on dupes), then optimistic pending threads the server hasn't surfaced
 * yet, with patches applied, search-filtered and client-sorted.
 */
export function mergeConversations({
  head,
  older,
  pending,
  patches,
  filters,
}: {
  head: Conversation[];
  older: Conversation[];
  pending: Conversation[];
  patches: Record<string, Partial<Conversation>>;
  filters: { search: string; sortKey: ConversationSortKey };
}): Conversation[] {
  const seen = new Set<string>();
  const out: Conversation[] = [];
  for (const c of [...head, ...older, ...pending]) {
    const key = conversationKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(patches[c.id] ? { ...c, ...patches[c.id] } : c);
  }

  const query = filters.search.trim().toLowerCase();
  const filtered = query
    ? out.filter((c) =>
        [c.participantName, c.participantUsername, c.lastMessage, c.participantId].some(
          (field) => typeof field === 'string' && field.toLowerCase().includes(query),
        ),
      )
    : out;

  if (filters.sortKey === 'unanswered') {
    return filtered.sort((a, b) => {
      const unreadDelta = (b.unreadCount ? 1 : 0) - (a.unreadCount ? 1 : 0);
      return unreadDelta !== 0 ? unreadDelta : byNewest(a, b);
    });
  }
  if (filters.sortKey === 'date-asc') {
    return filtered.sort((a, b) => byNewest(b, a));
  }
  return filtered.sort(byNewest);
}

/**
 * Render-time merge for a message thread, chronological (oldest-top):
 * older pages, then the polled head, then optimistic sends the server hasn't
 * confirmed yet (delivered stubs suppressed), with patches applied.
 */
export function mergeMessages({
  head,
  older,
  pending,
  patches,
}: {
  head: Message[];
  older: Message[];
  pending: Message[];
  patches: Record<string, Partial<Message>>;
}): Message[] {
  const seen = new Set<string>();
  const server: Message[] = [];
  for (const m of [...older, ...head]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    server.push(m);
  }

  const livePending = suppressDeliveredStubs(pending, server).filter((p) => !seen.has(p.id));

  return [...server, ...livePending].map((m) => (patches[m.id] ? { ...m, ...patches[m.id] } : m));
}
