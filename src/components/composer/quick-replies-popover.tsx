'use client';

import { Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuickReply } from '@/app/api/quick-replies/route';

interface QuickRepliesPopoverProps {
  quickReplies: QuickReply[];
  filterQuery: string;
  onSelect: (reply: QuickReply) => void;
  onOpenManage: () => void;
  onClose?: () => void;
}

export function QuickRepliesPopover({
  quickReplies,
  filterQuery,
  onSelect,
  onOpenManage,
}: QuickRepliesPopoverProps) {

  const cleanFilter = filterQuery.toLowerCase().replace(/^\//, '');

  const filtered = quickReplies.filter(
    (r) =>
      r.shortcut.toLowerCase().includes(cleanFilter) ||
      r.title.toLowerCase().includes(cleanFilter) ||
      r.content.toLowerCase().includes(cleanFilter)
  );

  return (
    <div className="absolute bottom-full left-0 mb-2 z-30 w-80 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] shadow-lg overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2">
      <div className="flex items-center justify-between border-b border-[var(--chat-border)] bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
        <div className="flex items-center gap-1.5 text-primary">
          <Zap className="size-3.5 fill-primary/20" />
          <span>Respostas Rápidas</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenManage}
          className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3" />
          <span>Gerenciar</span>
        </Button>
      </div>

      <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            Nenhuma resposta rápida para &quot;{cleanFilter}&quot;
          </div>
        ) : (
          filtered.map((reply) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => onSelect(reply)}
              className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-muted/80 transition-colors group flex flex-col gap-0.5"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-xs font-semibold text-primary group-hover:underline">
                  {reply.shortcut}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {reply.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {reply.content}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
