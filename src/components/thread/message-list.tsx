'use client';

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { dateSeparatorLabel } from '@/lib/format';
import { isCallEvent } from '@/lib/message-metadata';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/lib/types';
import { DeletedRow } from './deleted-row';
import { MessageBubble, type MessageBubbleProps } from './message-bubble';

function SystemPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Badge
        variant="secondary"
        className="rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground"
      >
        {children}
      </Badge>
    </div>
  );
}

export interface MessageListProps {
  /** Identity of the open thread; changing it resets the scroll engine. */
  threadKey: string;
  conversation: Conversation;
  /** Chronological, oldest-top. */
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  loadOlder: () => Promise<boolean>;
  messageById: Map<string, Message>;
  highlightedMessageId: string | null;
  /** Flash-highlight a message (thread-pane owns the 2s timer). */
  onHighlight: (id: string) => void;
  /**
   * Hands the list's imperative bits up so out-of-list flows (in-thread
   * search) reuse the exact quote-click scroll + highlight path and the
   * position-preserving load-older. Mirrors registerListApi.
   */
  registerApi?: (api: MessageListApi) => void;
  bubbleHandlers: Pick<MessageBubbleProps, 'onReact' | 'onReply' | 'onEdit' | 'onDelete'>;
}

export interface MessageListApi {
  /** Smooth-scroll to a message and flash the 2s highlight ring. */
  scrollToMessage: (id: string) => void;
  /** loadOlder with the reading-position restore (same path as the in-list button). */
  loadOlder: () => Promise<void>;
}

export function MessageList({
  threadKey,
  conversation,
  messages,
  isLoading,
  hasMore,
  loadingOlder,
  loadOlder,
  messageById,
  highlightedMessageId,
  onHighlight,
  registerApi,
  bubbleHandlers,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // prevLastIdRef tracks the last message id so auto-scroll only fires on new
  // messages at the end, not when older messages are prepended (which would
  // yank the user away from the history they were reading). null means "thread
  // just opened" and triggers the instant bottom jump.
  const prevLastIdRef = useRef<string | null>(null);
  // prevScrollHeightRef snapshots scrollHeight before a load-older fetch so we
  // can restore the reading position after React renders the prepended rows.
  const prevScrollHeightRef = useRef(0);

  // Thread switch: reset the scroll engine before the effect below runs.
  // Render-time ref mutation keeps this in lockstep with the messages render.
  const threadKeyRef = useRef(threadKey);
  if (threadKeyRef.current !== threadKey) {
    threadKeyRef.current = threadKey;
    prevLastIdRef.current = null;
    prevScrollHeightRef.current = 0;
  }

  // Single owner of the scroll position after any `messages` change. The cases
  // are mutually exclusive per render; one layout effect avoids two effects
  // fighting over scrollTop. We move the container directly, never
  // scrollIntoView for pinning — that bubbles up and scrolls every ancestor.
  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const lastId = messages[messages.length - 1]?.id ?? null;

    // Case 1 — load-older prepend: the newest message is unchanged but rows
    // were inserted above the viewport. Restore by the height added.
    if (prevScrollHeightRef.current && lastId === prevLastIdRef.current) {
      c.scrollTop = c.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
      return;
    }
    // Any other render invalidates a pending snapshot (e.g. thread switched
    // mid-load), so drop it rather than misapplying it below.
    prevScrollHeightRef.current = 0;

    // Case 2 — the newest message changed: stick to the bottom. A null ref
    // means "first messages for this freshly-opened thread" → jump instantly.
    // Afterwards only follow when already near the bottom, so a polled-in
    // message never yanks the user off history they're reading.
    if (!lastId) {
      // Empty list (thread just reset): re-arm the instant jump. One render of
      // the previous thread's messages can slip in before the parent's reset
      // effect clears them; without this the null marker would be consumed on
      // that stale content.
      prevLastIdRef.current = null;
      return;
    }
    if (prevLastIdRef.current === null) {
      c.scrollTop = c.scrollHeight;
    } else if (lastId !== prevLastIdRef.current) {
      const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 200;
      if (nearBottom) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
    }
    prevLastIdRef.current = lastId;
  }, [messages]);

  // Snapshot scrollHeight BEFORE the fetch so the layout effect can restore
  // the reading position. The in-flight guard prevents a rapid double-click
  // from clobbering the snapshot with a post-first-prepend value.
  const handleLoadOlder = useCallback(async () => {
    if (loadingOlder) return;
    prevScrollHeightRef.current = containerRef.current?.scrollHeight ?? 0;
    await loadOlder();
  }, [loadingOlder, loadOlder]);

  // Jump to a message (user action, so scrollIntoView is fine here). Shared
  // by quote clicks and, via registerApi, the in-thread search.
  const scrollToMessage = useCallback(
    (id: string) => {
      const el = containerRef.current?.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        onHighlight(id);
      }
    },
    [onHighlight],
  );

  useEffect(() => {
    registerApi?.({ scrollToMessage, loadOlder: handleLoadOlder });
  }, [registerApi, scrollToMessage, handleLoadOlder]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[900px] space-y-3 px-4 py-4">
        {isLoading ? (
          [56, 40, 72, 48, 64].map((width, i) => (
            <div key={i} className={cn('flex', i % 2 === 1 ? 'justify-end' : 'justify-start')}>
              <Skeleton
                className="h-10 rounded-2xl"
                style={{ width: `${width * 0.25}rem`, maxWidth: '70%' }}
              />
            </div>
          ))
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages in this conversation
          </p>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-1 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                  className="text-xs text-muted-foreground"
                >
                  {loadingOlder && <Loader2 className="size-3.5 animate-spin" />}
                  {loadingOlder ? 'Loading...' : 'Load older messages'}
                </Button>
              </div>
            )}
            {messages.map((msg, i) => {
              const msgDate = new Date(msg.createdAt);
              const prev = i > 0 ? messages[i - 1] : null;
              const showDaySeparator =
                !prev || msgDate.toDateString() !== new Date(prev.createdAt).toDateString();

              return (
                <Fragment key={msg.id}>
                  {showDaySeparator && (
                    <SystemPill className="my-3">{dateSeparatorLabel(msgDate)}</SystemPill>
                  )}
                  {msg.isDeleted ? (
                    // Tombstone — never renders the pre-delete text/attachments.
                    <DeletedRow direction={msg.direction} createdAt={msg.createdAt} />
                  ) : isCallEvent(msg.metadata) ? (
                    // Call-event row (WhatsApp call.received / call.ended):
                    // a centered system pill, not a chat bubble.
                    <SystemPill className="my-2">{msg.message || '📞 Call'}</SystemPill>
                  ) : (
                    <MessageBubble
                      msg={msg}
                      conversation={conversation}
                      messageById={messageById}
                      highlighted={highlightedMessageId === msg.id}
                      onQuoteClick={scrollToMessage}
                      {...bubbleHandlers}
                    />
                  )}
                </Fragment>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
