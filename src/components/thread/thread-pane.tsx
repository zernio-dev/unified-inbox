'use client';

import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Account, Conversation, Selection } from '@/lib/types';

export interface ThreadPaneProps {
  selected: Selection | null;
  conversation: Conversation | null;
  account: Account | null;
  onBack: () => void;
}

// Placeholder shell: header + bubble skeletons + composer bar. Task 7 replaces
// the internals; the props contract above is stable.
export function ThreadPane({ selected, conversation, onBack }: ThreadPaneProps) {
  if (!selected) {
    return (
      <main className="hidden h-full flex-1 flex-col items-center justify-center gap-3 bg-[var(--chat-canvas)] md:flex">
        <MessageSquare className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Select a conversation to get started</p>
      </main>
    );
  }

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-[var(--chat-canvas)]">
      <header className="flex h-14 flex-none items-center gap-2 border-b border-[var(--chat-border)] bg-[var(--chat-surface)] px-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Skeleton className="size-9 flex-none rounded-full" />
        {conversation?.participantName ? (
          <span className="truncate text-sm font-medium">{conversation.participantName}</span>
        ) : (
          <Skeleton className="h-3.5 w-32" />
        )}
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {[56, 40, 72, 48, 64].map((width, i) => (
          <div key={i} className={cn('flex', i % 2 === 1 ? 'justify-end' : 'justify-start')}>
            <Skeleton
              className="h-10 rounded-2xl"
              style={{ width: `${width * 0.25}rem`, maxWidth: '70%' }}
            />
          </div>
        ))}
      </div>
      <footer className="flex-none border-t border-[var(--chat-border)] bg-[var(--chat-surface)] p-3">
        <Skeleton className="h-10 w-full rounded-full" />
      </footer>
    </main>
  );
}
