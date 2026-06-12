'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { ConversationListPane, type ConversationListApi } from '@/components/conversation-list';
import {
  classifyApiError,
  InboxAddonScreen,
  RateLimitBanner,
  SetupScreen,
} from '@/components/error-screens';
import { NewMessageDialog } from '@/components/new-message-dialog';
import { ThreadPane } from '@/components/thread/thread-pane';
import { Button } from '@/components/ui/button';
import { useAccounts } from '@/hooks/useAccounts';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import type { ApiError } from '@/lib/api-client';
import type { Conversation, Selection } from '@/lib/types';

/** URL param format: `${accountId}:${conversationId}` (account ids never contain ':'). */
function parseSelection(param: string): Selection | null {
  const sep = param.indexOf(':');
  if (sep <= 0 || sep === param.length - 1) return null;
  return { accountId: param.slice(0, sep), conversationId: param.slice(sep + 1) };
}

function NoAccountsScreen() {
  return (
    <div className="flex flex-1 items-center justify-center bg-[var(--chat-canvas)] p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-8 text-center shadow-sm">
        <Inbox className="mx-auto size-8 text-muted-foreground/50" />
        <h1 className="mt-4 text-lg font-semibold tracking-tight">
          No messaging accounts connected
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect accounts in your Zernio dashboard first, then come back here.
        </p>
        <Button asChild className="mt-6">
          <a href="https://zernio.com" target="_blank" rel="noreferrer">
            Open Zernio dashboard
          </a>
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { accounts, selectedAccountIds, isLoading, error } = useAccounts();
  const { filters, setFilter, hydrated } = useUrlFilters();

  // Selection lives in the URL (filters.conversation); the Conversation object
  // is only known after the user clicks a list row (or task 6's list resolves it).
  const selected = useMemo(() => parseSelection(filters.conversation), [filters.conversation]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  // Conversations-list error that classifies to a full-screen state (the
  // accounts call can succeed while the inbox add-on gate fires on the list).
  const [listError, setListError] = useState<ApiError | null>(null);

  // Deep link / refresh: the list resolves the URL selection to its
  // Conversation object once loaded; never clobber an already-resolved one.
  const handleResolveSelected = useCallback((conv: Conversation) => {
    setSelectedConversation((prev) =>
      prev === null || prev.id !== conv.id || prev.accountId !== conv.accountId ? conv : prev,
    );
  }, []);

  // The conversation list hook lives inside ConversationListPane; it hands its
  // imperative API up here so the new-message dialog can insert the freshly
  // created thread optimistically.
  const listApiRef = useRef<ConversationListApi | null>(null);
  const registerListApi = useCallback((api: ConversationListApi) => {
    listApiRef.current = api;
  }, []);

  // First run: accounts exist but none tracked yet, send the user to settings.
  useEffect(() => {
    if (isLoading || error) return;
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      router.push('/settings');
    }
  }, [isLoading, error, accounts.length, selectedAccountIds.length, router]);

  // Full-screen states from either the accounts fetch or a reported list error.
  const screenError = classifyApiError(error) ? error : classifyApiError(listError) ? listError : null;
  const errorScreen = classifyApiError(screenError);
  if (errorScreen === 'setup') return <SetupScreen />;
  if (errorScreen === 'addon') {
    return <InboxAddonScreen trialAvailable={screenError?.trialAvailable} />;
  }

  const account = selected ? (accounts.find((a) => a._id === selected.accountId) ?? null) : null;
  const conversation =
    selectedConversation && selected && selectedConversation.id === selected.conversationId
      ? selectedConversation
      : null;

  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <RateLimitBanner />
      {!isLoading && !error && accounts.length === 0 ? (
        <NoAccountsScreen />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ConversationListPane
            filters={filters}
            setFilter={setFilter}
            selected={hydrated ? selected : null}
            onSelect={(s, conv) => {
              setSelectedConversation(conv);
              setFilter('conversation', `${s.accountId}:${s.conversationId}`);
            }}
            accounts={accounts}
            onNewMessage={() => setNewMessageOpen(true)}
            registerListApi={registerListApi}
            onResolveSelected={handleResolveSelected}
            onClassifiedError={setListError}
          />
          <ThreadPane
            selected={hydrated ? selected : null}
            conversation={conversation}
            account={account}
            onBack={() => setFilter('conversation', '')}
            patchConversation={(id, patch) => listApiRef.current?.patchConversation(id, patch)}
          />
        </div>
      )}
      <NewMessageDialog
        open={newMessageOpen}
        onOpenChange={setNewMessageOpen}
        accounts={accounts}
        onCreated={({ conversation }) => {
          // The optimistic message is intentionally not injected into the
          // thread: selecting the conversation loads messages from the server
          // shortly (eventual consistency).
          listApiRef.current?.addConversation(conversation);
          setSelectedConversation(conversation);
          setFilter('conversation', `${conversation.accountId}:${conversation.id}`);
        }}
      />
    </div>
  );
}
