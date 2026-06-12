'use client';

import { useCallback, useEffect, useState } from 'react';
import { MESSAGE_PLATFORMS } from '@/lib/capabilities';

export interface InboxFilters {
  platform: string;
  account: string;
  sort: 'date-desc' | 'date-asc' | 'unanswered';
  conversation: string;
  q: string;
}

const DEFAULTS: InboxFilters = {
  platform: 'all',
  account: '',
  sort: 'date-desc',
  conversation: '',
  q: '',
};

const FILTER_KEYS = Object.keys(DEFAULTS) as (keyof InboxFilters)[];
const SORT_VALUES: readonly InboxFilters['sort'][] = ['date-desc', 'date-asc', 'unanswered'];
const PLATFORM_VALUES: readonly string[] = ['all', ...MESSAGE_PLATFORMS];

function isValidSort(value: string): value is InboxFilters['sort'] {
  return (SORT_VALUES as readonly string[]).includes(value);
}

/**
 * URL-persisted inbox filter state.
 *
 * Starts with defaults (SSR-safe), hydrates from `window.location.search` on
 * mount, then mirrors changes back via `history.replaceState`. Only
 * non-default values are written so the URL stays clean; params not managed
 * by this hook are preserved.
 */
export function useUrlFilters(): {
  filters: InboxFilters;
  setFilter: <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => void;
  hydrated: boolean;
} {
  const [filters, setFilters] = useState<InboxFilters>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from URL on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Partial<InboxFilters> = {};

    const platform = params.get('platform');
    if (platform !== null && PLATFORM_VALUES.includes(platform)) fromUrl.platform = platform;
    const account = params.get('account');
    if (account !== null) fromUrl.account = account;
    const sort = params.get('sort');
    if (sort !== null && isValidSort(sort)) fromUrl.sort = sort;
    const conversation = params.get('conversation');
    if (conversation !== null) fromUrl.conversation = conversation;
    const q = params.get('q');
    if (q !== null) fromUrl.q = q;

    if (Object.keys(fromUrl).length > 0) {
      setFilters((prev) => ({ ...prev, ...fromUrl }));
    }
    setHydrated(true);
  }, []);

  // Persist to URL on change (skip before hydration so defaults don't wipe params).
  useEffect(() => {
    if (!hydrated) return;

    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams();

    // Keep params this hook doesn't manage.
    current.forEach((value, key) => {
      if (!(FILTER_KEYS as string[]).includes(key)) next.set(key, value);
    });

    for (const key of FILTER_KEYS) {
      if (filters[key] !== DEFAULTS[key]) next.set(key, filters[key]);
    }

    const qs = next.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [filters, hydrated]);

  const setFilter = useCallback(
    <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { filters, setFilter, hydrated };
}
