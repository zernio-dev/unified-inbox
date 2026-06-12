'use client';

import { useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, ApiError } from '@/lib/api-client';
import { supportsReply } from '@/lib/capabilities';
import { messagePreviewText } from '@/lib/format';
import { makeOptimisticMessage } from '@/lib/optimistic';
import type { Account, Conversation, Message } from '@/lib/types';

/**
 * Stable composer contract. Task 8 expands the internals (attachments, voice,
 * WhatsApp templates / interactive, typing) behind these same props; the
 * thread-pane wiring doesn't change.
 */
export interface ComposerProps {
  conversation: Conversation;
  account: Account | null;
  replyingTo: Message | null;
  onCancelReply: () => void;
  addOptimistic: (m: Message) => void;
  removeOptimistic: (id: string) => void;
  refreshHead: () => Promise<void>;
  patchConversation?: (id: string, patch: Partial<Conversation>) => void;
  messages: Message[];
  messagesLoading: boolean;
}

const MAX_TEXTAREA_HEIGHT_PX = 144; // ~6 lines, then scroll

export function Composer({
  conversation,
  replyingTo,
  onCancelReply,
  addOptimistic,
  removeOptimistic,
  refreshHead,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;

    const replyToId = supportsReply(conversation.platform) ? replyingTo?.id : undefined;
    const stub = makeOptimisticMessage({
      conversation,
      overrides: {
        message,
        ...(replyToId ? { metadata: { quotedMessageId: replyToId } } : {}),
      },
    });

    setText('');
    resetHeight();
    onCancelReply();
    addOptimistic(stub);
    setSending(true);
    try {
      await apiFetch(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: conversation.accountId,
          message,
          ...(replyToId ? { replyTo: replyToId } : {}),
        }),
      });
      // Pull the persisted message into the head; the optimistic stub is
      // matched and dropped on merge. The conversation list's own poll picks
      // up the new lastMessage/ordering.
      await refreshHead();
    } catch (err) {
      removeOptimistic(stub.id);
      setText(message);
      toast.error(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <footer className="flex-none space-y-2 border-t border-[var(--chat-border)] bg-[var(--chat-surface)] p-3">
      {replyingTo && (
        <div className="flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">
              Replying to{' '}
              {replyingTo.direction === 'outgoing'
                ? 'yourself'
                : conversation.participantName || replyingTo.senderName || 'them'}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {messagePreviewText(replyingTo)}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            title="Cancel reply"
            aria-label="Cancel reply"
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-2 py-1.5">
        <Textarea
          ref={textareaRef}
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value);
            // Auto-grow up to the cap, then scroll.
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
          }}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline (textarea default).
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type a message..."
          aria-label="Message"
          className="max-h-36 min-h-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-base shadow-none field-sizing-fixed focus-visible:ring-0 sm:text-sm"
        />
        <Button
          size="icon"
          onClick={() => void send()}
          disabled={!text.trim() || sending}
          aria-label="Send message"
          className="size-8 shrink-0 rounded-lg"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </footer>
  );
}
