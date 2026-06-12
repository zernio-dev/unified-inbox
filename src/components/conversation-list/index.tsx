'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { InboxFilters } from '@/hooks/useUrlFilters';
import type { Account, Conversation, Selection } from '@/lib/types';

export interface ConversationListPaneProps {
  filters: InboxFilters;
  setFilter: <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => void;
  selected: Selection | null;
  onSelect: (s: Selection, conv: Conversation) => void;
  accounts: Account[];
}

// Placeholder shell: header + loading skeleton. Task 6 replaces the internals;
// the props contract above is stable.
export function ConversationListPane({ selected }: ConversationListPaneProps) {
  return (
    <aside
      className={cn(
        'h-full w-full flex-col border-[var(--chat-border)] bg-[var(--chat-surface)] md:flex md:w-[24rem] md:flex-none md:border-r',
        selected ? 'hidden' : 'flex',
      )}
    >
      <header className="flex h-14 flex-none items-center justify-between border-b border-[var(--chat-border)] px-4">
        <h1 className="text-base font-semibold tracking-tight">Inbox</h1>
        <Button variant="ghost" size="icon" asChild aria-label="Settings">
          <Link href="/settings">
            <Settings className="size-4" />
          </Link>
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <ul>
          {Array.from({ length: 9 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-11 flex-none rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
