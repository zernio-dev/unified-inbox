'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiFetch,
  pollInterval,
  toApiError,
  useRateLimitState,
  type ApiError,
} from '@/lib/api-client';
import { conversationKey, mergeConversations, type ConversationSortKey } from '@/lib/merge';
import { queryKeys } from '@/lib/query-keys';
import type { Conversation } from '@/lib/types';

// Sidebar poll, slower than the open thread (5s): lower-signal, larger page.
const CONVERSATIONS_POLL_INTERVAL_MS = 10_000;
const PAGE_LIMIT = 100;

export interface ConversationFilters {
  platform: string; // 'all' | Platform
  accountId: string; // '' = all
  sortKey: ConversationSortKey;
  search: string;
}

interface ConversationsResponse {
  data?: Conversation[];
  pagination?: { hasMore?: boolean; nextCursor?: string | null };
  meta?: { failedAccounts?: { accountId?: string; username?: string; error?: string }[] };
}

interface ConversationsPage {
  conversations: Conversation[];
  hasMore: boolean;
  nextCursor: string | null;
  failedAccounts: string[];
}

async function fetchConversationsPage({
  platform,
  accountId,
  sortOrder,
  cursor,
}: {
  platform: string;
  accountId: string;
  sortOrder: 'asc' | 'desc';
  cursor?: string;
}): Promise<ConversationsPage> {
  const params = new URLSearchParams({ sortOrder, limit: String(PAGE_LIMIT) });
  if (platform !== 'all') params.set('platform', platform);
  if (accountId) params.set('accountId', accountId);
  if (cursor) params.set('cursor', cursor);
  const body = await apiFetch<ConversationsResponse>(`/api/conversations?${params}`);
  return {
    conversations: body.data ?? [],
    hasMore: body.pagination?.hasMore ?? false,
    nextCursor: body.pagination?.nextCursor ?? null,
    failedAccounts: (body.meta?.failedAccounts ?? []).map(
      (f) => f.username || f.accountId || f.error || 'unknown',
    ),
  };
}

/**
 * Live conversation list. React Query owns only the newest page ("head") and
 * polls it; older (load-more) pages, optimistic inserts and per-id field
 * overrides are plain client state merged at render. Keeping optimistic data
 * out of the query cache lets polling and optimistic updates coexist without
 * flicker.
 */
export function useConversations(filters: ConversationFilters): {
  conversations: Conversation[];
  isLoading: boolean;
  error: ApiError | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
  refresh: () => void;
  patchConversation: (id: string, patch: Partial<Conversation>) => void;
  addConversation: (c: Conversation) => void;
  failedAccounts: string[];
} {
  const queryClient = useQueryClient();
  const { platform, accountId } = filters;
  const sortOrder: 'asc' | 'desc' = filters.sortKey === 'date-asc' ? 'asc' : 'desc';
  const headKey = queryKeys.conversations(platform, accountId, sortOrder);

  // Subscribe to the rate-limit latch: refetchInterval callbacks only
  // re-evaluate on re-render, so without this polling would stay off after the
  // pause expires until something else happened to re-render us.
  useRateLimitState();

  const headQuery = useQuery({
    queryKey: headKey,
    refetchInterval: () => pollInterval(CONVERSATIONS_POLL_INTERVAL_MS),
    queryFn: () => fetchConversationsPage({ platform, accountId, sortOrder }),
  });

  // Older pages (load-more), never polled.
  const [older, setOlder] = useState<Conversation[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [olderHasMore, setOlderHasMore] = useState(false);
  const [olderInit, setOlderInit] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Optimistic threads not yet surfaced by the server (just-created DMs).
  const [pending, setPending] = useState<Conversation[]>([]);
  // Per-conversation optimistic field overrides (unread clear, send bump).
  const [patches, setPatches] = useState<Record<string, Partial<Conversation>>>({});

  // Reset list-local state when the filter set changes; the head query
  // refetches on its own for the new key. Search is client-side only, so it
  // doesn't participate.
  const filterKey = `${platform}|${accountId}|${sortOrder}`;
  useEffect(() => {
    setOlder([]);
    setOlderCursor(null);
    setOlderHasMore(false);
    setOlderInit(false);
    setPending([]);
    setPatches({});
  }, [filterKey]);

  // Once a fresh head reflects a conversation, the server is authoritative for
  // it: drop its patch and any pending copy.
  useEffect(() => {
    const head = headQuery.data?.conversations;
    if (!head) return;
    setPatches((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      const headIds = new Set(head.map((c) => c.id));
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
    setPending((prev) => {
      if (prev.length === 0) return prev;
      const headKeys = new Set(head.map(conversationKey));
      const next = prev.filter((p) => !headKeys.has(conversationKey(p)));
      return next.length === prev.length ? prev : next;
    });
  }, [headQuery.data]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.conversations(platform, accountId, sortOrder),
    });
  }, [queryClient, platform, accountId, sortOrder]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const cursor = olderInit ? olderCursor : (headQuery.data?.nextCursor ?? null);
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchConversationsPage({ platform, accountId, sortOrder, cursor });
      setOlder((prev) => {
        const seen = new Set(prev.map(conversationKey));
        return [...prev, ...page.conversations.filter((c) => !seen.has(conversationKey(c)))];
      });
      setOlderCursor(page.nextCursor);
      setOlderHasMore(page.hasMore);
      setOlderInit(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, olderInit, olderCursor, headQuery.data?.nextCursor, platform, accountId, sortOrder]);

  const patchConversation = useCallback((id: string, patch: Partial<Conversation>) => {
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const addConversation = useCallback((c: Conversation) => {
    setPending((prev) => [c, ...prev.filter((p) => conversationKey(p) !== conversationKey(c))]);
  }, []);

  const conversations = useMemo(
    () =>
      mergeConversations({
        head: headQuery.data?.conversations ?? [],
        older,
        pending,
        patches,
        filters: { search: filters.search, sortKey: filters.sortKey },
      }),
    [headQuery.data, older, pending, patches, filters.search, filters.sortKey],
  );

  return {
    conversations,
    isLoading: headQuery.isLoading,
    error: toApiError(headQuery.error),
    hasMore: olderInit ? olderHasMore : (headQuery.data?.hasMore ?? false),
    loadMore,
    loadingMore,
    refresh,
    patchConversation,
    addConversation,
    failedAccounts: headQuery.data?.failedAccounts ?? [],
  };
}
