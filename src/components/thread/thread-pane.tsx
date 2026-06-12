'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Composer } from '@/components/composer/composer';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { apiFetch, ApiError } from '@/lib/api-client';
import { toggleReaction } from '@/lib/reactions';
import { cn } from '@/lib/utils';
import type { Account, Conversation, Message, Selection } from '@/lib/types';
import { MessageList } from './message-list';
import { ThreadHeader } from './thread-header';

export interface ThreadPaneProps {
  selected: Selection | null;
  conversation: Conversation | null;
  account: Account | null;
  onBack: () => void;
}

const HIGHLIGHT_MS = 2_000;

function errorToast(err: unknown, fallback: string) {
  toast.error(err instanceof ApiError ? err.message : fallback);
}

export function ThreadPane({ selected, conversation, account, onBack }: ThreadPaneProps) {
  const threadKey = selected ? `${selected.accountId}:${selected.conversationId}` : 'none';

  const {
    messages,
    isLoading,
    hasMore,
    loadOlder,
    loadingOlder,
    addOptimistic,
    removeOptimistic,
    patchMessage,
    clearPatch,
    refreshHead,
    resetThread,
  } = useConversationMessages({
    conversationId: selected?.conversationId ?? null,
    accountId: selected?.accountId ?? null,
  });

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset all thread-local state when the selected conversation changes.
  // useLayoutEffect so stale older/pending pages from the previous thread are
  // cleared before paint (the head query key already switched).
  useLayoutEffect(() => {
    resetThread();
    setReplyingTo(null);
    setHighlightedMessageId(null);
    setEditing(null);
  }, [threadKey, resetThread]);

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightMessage = useCallback((id: string) => {
    setHighlightedMessageId(id);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), HIGHLIGHT_MS);
  }, []);
  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    [],
  );

  // Fast lookup for rendering a reply's quoted block.
  const messageById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Optimistic reaction toggle, reconciled by the head poll (the hook drops
  // the patch once a fresh head includes this message id).
  const handleReact = useCallback(
    async (msg: Message, emoji: string) => {
      if (!selected) return;
      const { next, removed } = toggleReaction({ reactions: msg.reactions, emoji });
      patchMessage(msg.id, { reactions: next });
      const base = `/api/conversations/${encodeURIComponent(selected.conversationId)}/messages/${encodeURIComponent(msg.id)}/reactions`;
      try {
        if (removed) {
          await apiFetch(`${base}?accountId=${encodeURIComponent(selected.accountId)}`, {
            method: 'DELETE',
          });
        } else {
          await apiFetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: selected.accountId, emoji }),
          });
        }
      } catch (err) {
        clearPatch(msg.id);
        errorToast(err, 'Failed to react');
      }
    },
    [selected, patchMessage, clearPatch],
  );

  const handleReply = useCallback((msg: Message) => setReplyingTo(msg), []);

  const handleEdit = useCallback((msg: Message) => {
    setEditing(msg);
    setEditText(msg.message);
  }, []);

  const saveEdit = async () => {
    if (!selected || !editing || savingEdit) return;
    const text = editText.trim();
    if (!text) return;
    setSavingEdit(true);
    try {
      await apiFetch(
        `/api/conversations/${encodeURIComponent(selected.conversationId)}/messages/${encodeURIComponent(editing.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: selected.accountId, text }),
        },
      );
      setEditing(null);
      await refreshHead();
      toast.success('Message updated');
    } catch (err) {
      errorToast(err, 'Failed to edit message');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = useCallback(
    async (msg: Message) => {
      if (!selected) return;
      if (!confirm('Delete this message?')) return;
      try {
        await apiFetch(
          `/api/conversations/${encodeURIComponent(selected.conversationId)}/messages/${encodeURIComponent(msg.id)}?accountId=${encodeURIComponent(selected.accountId)}`,
          { method: 'DELETE' },
        );
        await refreshHead();
      } catch (err) {
        errorToast(err, 'Failed to delete message');
      }
    },
    [selected, refreshHead],
  );

  if (!selected || !conversation) {
    return (
      <main
        className={cn(
          'h-full flex-1 flex-col items-center justify-center gap-3 bg-[var(--chat-canvas)]',
          // Without a selection the list owns the mobile viewport; with a
          // selection but no resolved conversation yet, stay visible.
          selected ? 'flex' : 'hidden md:flex',
        )}
      >
        <MessageSquare className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Select a conversation</p>
      </main>
    );
  }

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-[var(--chat-canvas)]">
      <ThreadHeader conversation={conversation} onBack={onBack} />
      <MessageList
        threadKey={threadKey}
        conversation={conversation}
        messages={messages}
        isLoading={isLoading}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        loadOlder={loadOlder}
        messageById={messageById}
        highlightedMessageId={highlightedMessageId}
        onHighlight={highlightMessage}
        bubbleHandlers={{
          onReact: handleReact,
          onReply: handleReply,
          onEdit: handleEdit,
          onDelete: handleDelete,
        }}
      />
      {/* Keyed by thread so drafts/sending state never bleed across threads. */}
      <Composer
        key={threadKey}
        conversation={conversation}
        account={account}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        addOptimistic={addOptimistic}
        removeOptimistic={removeOptimistic}
        refreshHead={refreshHead}
        messages={messages}
        messagesLoading={isLoading}
      />

      {/* Telegram message edit */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            aria-label="Edited message text"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={savingEdit || !editText.trim()}>
              {savingEdit && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
