'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useIsFetching } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Inbox,
  Loader2,
  RotateCw,
  Search,
  SearchX,
  Settings,
  SquarePen,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { classifyApiError } from '@/components/error-screens';
import { useConversations } from '@/hooks/useConversations';
import type { ApiError } from '@/lib/api-client';
import { conversationDisplayName } from '@/lib/format';
import { conversationKey } from '@/lib/merge';
import {
  buildSnapshot,
  diffForNotifications,
  getNotificationPref,
  getSoundPref,
  playChime,
  setNotificationPref,
  setSoundPref,
  type ConversationSnapshot,
} from '@/lib/notifications';
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
   * new-message dialog, the composer's sidebar bump) can mutate the list
   * without restructuring where the list hook lives.
   */
  registerListApi?: (api: ConversationListApi) => void;
  /**
   * Deep link / refresh restore: when `selected` points at a conversation the
   * parent has no object for yet, this reports the matching row once the
   * merged list contains it.
   */
  onResolveSelected?: (conv: Conversation) => void;
  /** Reports a conversations-fetch error that classifies to a full-screen state. */
  onClassifiedError?: (e: ApiError) => void;
}

export interface ConversationListApi {
  addConversation: (c: Conversation) => void;
  refresh: () => void;
  patchConversation: (id: string, patch: Partial<Conversation>) => void;
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

// At most this many desktop notifications per poll; a backlog burst (e.g.
// waking a laptop) should never flood the OS notification center.
const NOTIFY_CAP_PER_POLL = 3;
const NOTIFY_BODY_MAX = 120;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function NotificationBell({
  pref,
  soundOn,
  onEnable,
  onDisable,
  onSoundChange,
}: {
  pref: 'on' | 'off';
  soundOn: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onSoundChange: (on: boolean) => void;
}) {
  if (pref === 'off') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onEnable} aria-label="Enable notifications">
            <BellOff className="size-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Enable notifications</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notification settings">
          <Bell className="size-4 text-primary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDisable}>
          <BellOff className="size-4" />
          Disable notifications
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked={soundOn} onCheckedChange={onSoundChange}>
          Sound
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  onResolveSelected,
  onClassifiedError,
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
    registerListApi?.({ addConversation, refresh, patchConversation });
  }, [registerListApi, addConversation, refresh, patchConversation]);

  // Deep link / refresh: the URL selection exists before any row click, so the
  // parent has no Conversation object. Hand the matching row up once loaded.
  useEffect(() => {
    if (!selected || !onResolveSelected) return;
    const match = conversations.find(
      (c) =>
        conversationKey(c) ===
        conversationKey({ id: selected.conversationId, accountId: selected.accountId }),
    );
    if (match) onResolveSelected(match);
  }, [selected, conversations, onResolveSelected]);

  // A list error that classifies to a full-screen state (addon/setup) must
  // take over the whole app, which only the parent can render.
  useEffect(() => {
    if (!error || !onClassifiedError) return;
    if (classifyApiError(error)) onClassifiedError(error);
  }, [error, onClassifiedError]);

  // "Auto-updating" affordance: the dot pulses while a background refetch of
  // any conversations page is in flight.
  const refetching = useIsFetching({ queryKey: ['conversations'] }) > 0;

  // --- Browser notifications ---
  // Prefs are read in an effect (not at render) so SSR and the first client
  // render agree; until then the bell stays hidden/off.
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPref, setNotifPrefState] = useState<'on' | 'off'>('off');
  const [soundOn, setSoundOnState] = useState(true);
  useEffect(() => {
    setNotifSupported('Notification' in window);
    setNotifPrefState(getNotificationPref());
    setSoundOnState(getSoundPref());
  }, []);

  const enableNotifications = useCallback(async () => {
    if (Notification.permission === 'denied') {
      toast.error('Notifications are blocked in your browser settings');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationPref('on');
      setNotifPrefState('on');
      toast.success('Notifications enabled');
    }
  }, []);

  const disableNotifications = useCallback(() => {
    setNotificationPref('off');
    setNotifPrefState('off');
  }, []);

  const handleSoundChange = useCallback((on: boolean) => {
    setSoundPref(on);
    setSoundOnState(on);
  }, []);

  // Previous poll's snapshot. null means "re-initialize silently on the next
  // poll": set on mount and whenever the filter scope changes, so cross-filter
  // membership differences never read as a storm of new conversations.
  const snapshotRef = useRef<Map<string, ConversationSnapshot> | null>(null);
  const notifFilterKey = `${filters.platform}|${filters.account}`;
  useEffect(() => {
    snapshotRef.current = null;
  }, [notifFilterKey]);

  useEffect(() => {
    // While the head page for the current filter loads, the merged list is
    // empty; baselining on it would make every conversation look brand new.
    if (isLoading) return;
    const toNotify = diffForNotifications({
      prev: snapshotRef.current,
      conversations,
      selectedKey: selected
        ? conversationKey({ id: selected.conversationId, accountId: selected.accountId })
        : null,
      pageVisible: document.visibilityState === 'visible',
    });
    snapshotRef.current = buildSnapshot(conversations);
    if (notifPref !== 'on') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    let shown = 0;
    for (const conv of toNotify.slice(0, NOTIFY_CAP_PER_POLL)) {
      try {
        const n = new Notification(conversationDisplayName(conv), {
          body: truncate(conv.lastMessage ?? '', NOTIFY_BODY_MAX),
          // Tag dedupes: a second message in the same thread replaces the
          // earlier notification instead of stacking.
          tag: `unified-inbox:${conversationKey(conv)}`,
          silent: true, // we play our own (optional) chime instead
        });
        n.onclick = () => {
          window.focus();
          onSelect({ conversationId: conv.id, accountId: conv.accountId }, conv);
        };
        shown++;
      } catch {
        // The constructor can throw (e.g. Android Chrome requires a service
        // worker); skip rather than break the poll loop.
      }
    }
    if (shown > 0 && getSoundPref()) playChime();
  }, [conversations, isLoading, selected, notifPref, onSelect]);

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
          {notifSupported && (
            <NotificationBell
              pref={notifPref}
              soundOn={soundOn}
              onEnable={() => void enableNotifications()}
              onDisable={disableNotifications}
              onSoundChange={handleSoundChange}
            />
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
