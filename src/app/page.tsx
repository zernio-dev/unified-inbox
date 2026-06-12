'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { ConversationListPane } from '@/components/conversation-list';
import {
  classifyApiError,
  InboxAddonScreen,
  RateLimitBanner,
  SetupScreen,
} from '@/components/error-screens';
import { ThreadPane } from '@/components/thread/thread-pane';
import { Button } from '@/components/ui/button';
import { useAccounts } from '@/hooks/useAccounts';
import { useUrlFilters } from '@/hooks/useUrlFilters';
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

  // First run: accounts exist but none tracked yet, send the user to settings.
  useEffect(() => {
    if (isLoading || error) return;
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      router.push('/settings');
    }
  }, [isLoading, error, accounts.length, selectedAccountIds.length, router]);

  const errorScreen = classifyApiError(error);
  if (errorScreen === 'setup') return <SetupScreen />;
  if (errorScreen === 'addon') return <InboxAddonScreen trialAvailable={error?.trialAvailable} />;

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
          />
          <ThreadPane
            selected={hydrated ? selected : null}
            conversation={conversation}
            account={account}
            onBack={() => setFilter('conversation', '')}
          />
        </div>
      )}
      {/* New-message dialog mounts here in a later task (Task 9). */}
      {newMessageOpen && null}
    </div>
  );
}
