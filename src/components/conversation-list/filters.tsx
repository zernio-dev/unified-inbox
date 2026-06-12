'use client';

import { Check, ChevronDown } from 'lucide-react';
import { PLATFORM_LABELS, PlatformIcon } from '@/components/platform-icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MESSAGE_PLATFORMS } from '@/lib/capabilities';
import { cn } from '@/lib/utils';
import type { InboxFilters } from '@/hooks/useUrlFilters';
import type { Platform } from '@/lib/types';

const SORT_OPTIONS: { value: InboxFilters['sort']; label: string }[] = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'unanswered', label: 'Unanswered first' },
];

const PILL_CLASS =
  'inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border border-[var(--chat-border)] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--chat-hover)] hover:text-foreground data-[state=open]:bg-[var(--chat-hover)] data-[state=open]:text-foreground';

function ItemCheck({ active }: { active: boolean }) {
  return <Check className={cn('ml-auto size-3.5', !active && 'opacity-0')} />;
}

/** Compact pill selects for platform and sort order, driving the URL filters. */
export function FilterRow({
  filters,
  setFilter,
}: {
  filters: InboxFilters;
  setFilter: <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => void;
}) {
  // filters.platform is a plain string (URL-sourced); narrow before indexing labels.
  const platform: Platform | null = (MESSAGE_PLATFORMS as readonly string[]).includes(
    filters.platform,
  )
    ? (filters.platform as Platform)
    : null;
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? SORT_OPTIONS[0].label;

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Filter by platform"
          className={cn(PILL_CLASS, platform && 'text-foreground')}
        >
          {platform && <PlatformIcon platform={platform} className="size-3.5" />}
          <span className="truncate">{platform ? PLATFORM_LABELS[platform] : 'All platforms'}</span>
          <ChevronDown className="size-3 flex-none opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onSelect={() => setFilter('platform', 'all')}>
            All platforms
            <ItemCheck active={!platform} />
          </DropdownMenuItem>
          {MESSAGE_PLATFORMS.map((p) => (
            <DropdownMenuItem key={p} onSelect={() => setFilter('platform', p)}>
              <PlatformIcon platform={p} className="size-4" />
              {PLATFORM_LABELS[p]}
              <ItemCheck active={platform === p} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Sort conversations" className={PILL_CLASS}>
          <span className="truncate">{sortLabel}</span>
          <ChevronDown className="size-3 flex-none opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.value} onSelect={() => setFilter('sort', o.value)}>
              {o.label}
              <ItemCheck active={filters.sort === o.value} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
