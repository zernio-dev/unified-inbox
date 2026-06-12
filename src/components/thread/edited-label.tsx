'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Message } from '@/lib/types';

function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HistoryEntry({
  label,
  text,
  highlight,
}: {
  label: string;
  text?: string | null;
  highlight?: boolean;
}) {
  return (
    <div className={`border-l-2 pl-2 ${highlight ? 'border-primary' : 'border-border'}`}>
      <div className="mb-0.5 text-[10px] text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap break-words text-foreground">
        {text || <span className="italic text-muted-foreground">(empty)</span>}
      </div>
    </div>
  );
}

/**
 * Inline "edited" affordance next to the timestamp; clicking opens the full
 * edit history (oldest first, current version last). Renders nothing when the
 * message carries neither an edit count nor history.
 */
export function EditedLabel({ msg }: { msg: Message }) {
  const history = msg.editHistory ?? [];
  if (history.length === 0 && !msg.editCount) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer underline decoration-dotted underline-offset-2 opacity-70 hover:opacity-100"
        >
          edited
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 text-xs">
        <div className="font-medium text-foreground">
          Edit history
          {msg.editCount ? (
            <span className="ml-1 text-muted-foreground">
              ({msg.editCount} {msg.editCount === 1 ? 'edit' : 'edits'})
            </span>
          ) : null}
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {history.map((entry, idx) => (
            <HistoryEntry
              key={idx}
              label={`v${idx + 1} · ${formatTime(entry.editedAt)}`}
              text={entry.text}
            />
          ))}
          {/* Current version always shown last so the full progression reads top-down. */}
          <HistoryEntry label={`current · ${formatTime(msg.editedAt)}`} text={msg.message} highlight />
        </div>
      </PopoverContent>
    </Popover>
  );
}
