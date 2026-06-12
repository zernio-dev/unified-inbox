'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiFetch,
  pollInterval,
  toApiError,
  useRateLimitState,
  type ApiError,
} from '@/lib/api-client';
import { mergeMessages } from '@/lib/merge';
import { queryKeys } from '@/lib/query-keys';
import type { Message } from '@/lib/types';

// Open-thread poll: one DB-backed read per tick on the server side.
const MESSAGES_POLL_INTERVAL_MS = 5_000;
const PAGE_LIMIT = 100;

interface MessagesResponse {
  messages?: Message[];
  pagination?: { hasMore?: boolean; nextCursor?: string | null };
}

interface MessagesPage {
  /** Chronological (oldest-top), reversed from the API's newest-first order. */
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
}

async function fetchMessagesPage({
  conversationId,
  accountId,
  cursor,
}: {
  conversationId: string;
  accountId: string;
  cursor?: string;
}): Promise<MessagesPage> {
  const params = new URLSearchParams({ accountId, sortOrder: 'desc', limit: String(PAGE_LIMIT) });
  if (cursor) params.set('cursor', cursor);
  const body = await apiFetch<MessagesResponse>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages?${params}`,
  );
  return {
    messages: [...(body.messages ?? [])].reverse(),
    hasMore: body.pagination?.hasMore ?? false,
    nextCursor: body.pagination?.nextCursor ?? null,
  };
}

/**
 * Live message thread for the selected conversation.
 *
 * Split of concerns:
 *  - React Query owns the newest page ("head") and polls it for near-real-time
 *    updates (incoming messages, delivery/edit/reaction changes).
 *  - Older pages and optimistic-but-unconfirmed sends are client state merged
 *    onto the server head at render. Keeping optimistic data out of the query
 *    cache is what lets polling and optimistic updates coexist without flicker.
 *
 * The returned `messages` is chronological (oldest-top, newest-bottom).
 */
export function useConversationMessages({
  conversationId,
  accountId,
}: {
  conversationId: string | null;
  accountId: string | null;
}): {
  messages: Message[];
  isLoading: boolean;
  error: ApiError | null;
  hasMore: boolean;
  loadOlder: () => Promise<boolean>;
  loadingOlder: boolean;
  addOptimistic: (m: Message) => void;
  removeOptimistic: (id: string) => void;
  patchMessage: (id: string, patch: Partial<Message>) => void;
  clearPatch: (id: string) => void;
  refreshHead: () => Promise<void>;
  resetThread: () => void;
} {
  const queryClient = useQueryClient();
  const enabled = !!conversationId && !!accountId;
  const headKey = queryKeys.messages(conversationId ?? '', accountId ?? '');

  // Subscribe to the rate-limit latch so refetchInterval re-evaluates (and
  // polling resumes) the moment the pause expires. See useConversations.
  useRateLimitState();

  // Cursor for the first loadOlder, written by the head queryFn. A ref (not
  // state): a head poll re-running must not re-render or clobber paging state.
  const headCursorRef = useRef<string | null>(null);

  const headQuery = useQuery({
    queryKey: headKey,
    enabled,
    refetchInterval: () => pollInterval(MESSAGES_POLL_INTERVAL_MS),
    queryFn: async () => {
      const page = await fetchMessagesPage({
        conversationId: conversationId!,
        accountId: accountId!,
      });
      headCursorRef.current = page.nextCursor;
      return page;
    },
  });

  // Older pages (load-older), chronological and prepended. Never polled.
  const [older, setOlder] = useState<Message[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [olderHasMore, setOlderHasMore] = useState(false);
  const [olderInit, setOlderInit] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Optimistic outgoing messages not yet confirmed by the server.
  const [pending, setPending] = useState<Message[]>([]);
  // Per-message optimistic field overrides (e.g. a reaction toggle).
  const [patches, setPatches] = useState<Record<string, Partial<Message>>>({});

  // Drop patches once a fresh head reflects the same message; the poll is then
  // the single source of truth for it. Pending stays: suppression handles it.
  useEffect(() => {
    const head = headQuery.data?.messages;
    if (!head) return;
    setPatches((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      const headIds = new Set(head.map((m) => m.id));
      const next = { ...prev };
      let changed = false;
      for (const id of ids) {
        if (headIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [headQuery.data]);

  // Clear all thread-local state. Called by the pane when switching threads.
  const resetThread = useCallback(() => {
    headCursorRef.current = null;
    setOlder([]);
    setOlderCursor(null);
    setOlderHasMore(false);
    setOlderInit(false);
    setPending([]);
    setPatches({});
  }, []);

  const refreshHead = useCallback(async () => {
    const key = queryKeys.messages(conversationId ?? '', accountId ?? '');
    await queryClient.invalidateQueries({ queryKey: key });
    await queryClient.refetchQueries({ queryKey: key });
  }, [queryClient, conversationId, accountId]);

  const loadOlder = useCallback(async (): Promise<boolean> => {
    if (loadingOlder || !conversationId || !accountId) return false;
    const cursor = olderInit ? olderCursor : headCursorRef.current;
    if (!cursor) return false;
    setLoadingOlder(true);
    try {
      const page = await fetchMessagesPage({ conversationId, accountId, cursor });
      let prepended = 0;
      setOlder((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = page.messages.filter((m) => !seen.has(m.id));
        prepended = fresh.length;
        return [...fresh, ...prev];
      });
      setOlderCursor(page.nextCursor);
      setOlderHasMore(page.hasMore);
      setOlderInit(true);
      return prepended > 0;
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, conversationId, accountId, olderInit, olderCursor]);

  const addOptimistic = useCallback((m: Message) => {
    setPending((prev) => [...prev, m]);
  }, []);

  const removeOptimistic = useCallback((id: string) => {
    setPending((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const patchMessage = useCallback((id: string, patch: Partial<Message>) => {
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const clearPatch = useCallback((id: string) => {
    setPatches((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const messages = useMemo(
    () =>
      mergeMessages({
        head: headQuery.data?.messages ?? [],
        older,
        pending,
        patches,
      }),
    [headQuery.data, older, pending, patches],
  );

  return {
    messages,
    isLoading: enabled && headQuery.isLoading,
    error: toApiError(headQuery.error),
    hasMore: olderInit ? olderHasMore : (headQuery.data?.hasMore ?? false),
    loadOlder,
    loadingOlder,
    addOptimistic,
    removeOptimistic,
    patchMessage,
    clearPatch,
    refreshHead,
    resetThread,
  };
}
