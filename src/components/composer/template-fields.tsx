'use client';

import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { TemplateComposer } from '@/hooks/useTemplateComposer';

/**
 * Presentational fields for the WhatsApp approved-template composer: template
 * picker, a live preview of the rendered body, and one input per {{token}}.
 * All state lives in useTemplateComposer, which the parent owns so it can also
 * drive the send button + payload.
 */
export function TemplateFields({ composer }: { composer: TemplateComposer }) {
  const { templates, loading, setTemplateName, selected, tokens, params, setParam, previewBody } =
    composer;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading templates...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No approved templates for this WhatsApp account yet
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Template</Label>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Select template"
            className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[var(--chat-border)] bg-[var(--chat-surface)] px-3 text-sm hover:bg-[var(--chat-hover)]"
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{selected.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{selected.language}</span>
                {selected.category && (
                  <Badge variant="secondary" className="shrink-0">
                    {selected.category}
                  </Badge>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Select an approved template...</span>
            )}
            <ChevronDown className="size-4 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
            {templates.map((t) => (
              <DropdownMenuItem key={t.id || t.name} onSelect={() => setTemplateName(t.name)}>
                <span className="truncate">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.language}</span>
                {t.category && (
                  <Badge variant="secondary" className="ml-auto">
                    {t.category}
                  </Badge>
                )}
                <Check className={cn('size-3.5', selected?.name !== t.name && 'opacity-0')} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Live preview: the actual template body with variables substituted. */}
      {selected && (
        <div className="rounded-md border border-[var(--chat-border)] bg-[var(--chat-surface)] p-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Message preview</p>
          <p className="text-sm whitespace-pre-wrap">{previewBody || '(empty template body)'}</p>
        </div>
      )}

      {tokens.map((token, i) => (
        <div key={token} className="space-y-1">
          <Label className="text-xs">{token}</Label>
          <Input
            value={params[i] ?? ''}
            onChange={(e) => setParam(i, e.target.value)}
            placeholder={`Value for ${token}`}
            className="bg-[var(--chat-surface)]"
          />
        </div>
      ))}
    </div>
  );
}
