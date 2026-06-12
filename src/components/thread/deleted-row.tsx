'use client';

import { Ban } from 'lucide-react';
import type { Message } from '@/lib/types';

function formatHm(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Tombstone replacing the bubble when msg.isDeleted. Preserves left/right
 * alignment so the thread's flow stays intact.
 *
 * Hard invariant: never reads msg.message or msg.attachments — the API keeps
 * the pre-delete content for consumers, but the UI must not leak it.
 */
export function DeletedRow({ direction, createdAt }: Pick<Message, 'direction' | 'createdAt'>) {
  const time = formatHm(createdAt);
  return (
    <div className={`flex ${direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs italic text-muted-foreground">
        <Ban className="size-3.5 shrink-0" aria-hidden />
        <span>This message was deleted</span>
        {time && <span className="opacity-60">· {time}</span>}
      </div>
    </div>
  );
}
