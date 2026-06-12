'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useIsFetching } from '@tanstack/react-query';
import { Inbox, Loader2, RotateCw, Search, SearchX, Settings, SquarePen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConversations } from '@/hooks/useConversations';
import { conversationKey } from '@/lib/merge';
import { cn } from '@/lib/utils';
import type { InboxFilters } from '@/hooks/useUrlFilters';
import type { Account, Conversation, Selection } from '@/lib/types';
import { FilterRow } from './filters';
import { markConversationRead } from './mark-read';
import { ConversationRow } from './row';

export interface ConversationListPaneProps {
  filters: InboxFilters;
  setFilter: <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => void;
  selected: Selection | null;
  onSelect: (s: Selection, conv: Conversation) => void;
  accounts: Account[];
  onNewMessage?: () => void;
  /**
   * Hands the list's imperative API up to the page so out-of-pane flows (the
   * new-message dialog) can insert an optimistic conversation without
   * restructuring where the list hook lives.
   */
  registerListApi?: (api: ConversationListApi) => void;
}

export interface ConversationListApi {
  addConversation: (c: Conversation) => void;
  refresh: () => void;
}

function ListSkeleton() {
  return (
    <ul aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li
          key={i}
          className="flex min-h-[68px] items-center gap-3 border-b border-[var(--chat-border)] px-3 py-2.5"
        >
          <Skeleton className="size-11 flex-none rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  const Icon = searching ? SearchX : Inbox;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Icon className="size-7 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        {searching ? 'No conversations match your search' : 'No conversations yet'}
      </p>
      {!searching && (
        <p className="text-xs text-muted-foreground/70">
          New messages to your connected accounts will show up here.
        </p>
      )}
    </div>
  );
}

export function ConversationListPane({
  filters,
  setFilter,
  selected,
  onSelect,
  onNewMessage,
  registerListApi,
}: ConversationListPaneProps) {
  const {
    conversations,
    isLoading,
    error,
    hasMore,
    loadMore,
    loadingMore,
    refresh,
    patchConversation,
    addConversation,
    failedAccounts,
  } = useConversations({
    platform: filters.platform,
    accountId: filters.account,
    sortKey: filters.sort,
    search: filters.q,
  });

  useEffect(() => {
    registerListApi?.({ addConversation, refresh });
  }, [registerListApi, addConversation, refresh]);

  // "Auto-updating" affordance: the dot pulses while a background refetch of
  // any conversations page is in flight.
  const refetching = useIsFetching({ queryKey: ['conversations'] }) > 0;

  const handleSelect = (conv: Conversation) => {
    markConversationRead({ conversation: conv, patchConversation });
    onSelect({ conversationId: conv.id, accountId: conv.accountId }, conv);
  };

  return (
    <aside
      className={cn(
        'h-full w-full flex-col border-[var(--chat-border)] bg-[var(--chat-surface)] md:flex md:w-[24rem] md:flex-none md:border-r',
        selected ? 'hidden' : 'flex',
      )}
    >
      <header className="flex h-14 flex-none items-center border-b border-[var(--chat-border)] px-4">
        <h1 className="text-base font-semibold tracking-tight">Inbox</h1>
        <div className="ml-auto flex items-center gap-0.5">
          {onNewMessage && (
            <Button variant="ghost" size="icon" onClick={onNewMessage} aria-label="New message">
              <SquarePen className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" asChild aria-label="Settings">
            <Link href="/settings">
              <Settings className="size-4" />
            </Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label="Auto-updating"
                className="ml-1 flex size-3 items-center justify-center"
              >
                <span
                  className={cn(
                    'size-2 rounded-full bg-[var(--chat-presence)]',
                    refetching ? 'animate-pulse' : 'opacity-70',
                  )}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Auto-updating, new messages appear as they arrive
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex-none space-y-2 border-b border-[var(--chat-border)] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-8 rounded-full border-transparent bg-[var(--chat-input)] pr-8 pl-8 shadow-none dark:bg-[var(--chat-input)]"
          />
          {filters.q !== '' && (
            <button
              type="button"
              onClick={() => setFilter('q', '')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <FilterRow filters={filters} setFilter={setFilter} />
      </div>

      {failedAccounts.length > 0 && (
        <div className="flex-none border-b border-[var(--chat-border)] bg-[var(--chat-warning-bg)] px-3 py-1.5 text-xs text-[var(--chat-warning-fg)]">
          Some accounts failed to load: {failedAccounts.map((u) => `@${u}`).join(', ')}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : error && conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load conversations.</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RotateCw className="size-3.5" />
              Retry
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState searching={filters.q.trim() !== ''} />
        ) : (
          <>
            <ul>
              {conversations.map((conv) => (
                <li key={conversationKey(conv)}>
                  <ConversationRow
                    conversation={conv}
                    isSelected={
                      selected?.conversationId === conv.id && selected.accountId === conv.accountId
                    }
                    allAccountsMode={filters.account === ''}
                    onSelect={handleSelect}
                  />
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="flex justify-center py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
