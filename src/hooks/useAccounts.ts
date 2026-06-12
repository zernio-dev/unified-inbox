'use client';

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, toApiError, type ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { Account, Profile } from '@/lib/types';

interface AccountsResponse {
  accounts?: Account[];
  profiles?: Profile[];
  selectedAccountIds?: string[];
}

export function useAccounts(): {
  accounts: Account[];
  profiles: Profile[];
  selectedAccountIds: string[];
  isLoading: boolean;
  error: ApiError | null;
  isFetching: boolean;
  refetch: (opts?: { refresh?: boolean }) => void;
} {
  // One-shot flag: the next queryFn run bypasses the server-side accounts cache.
  const forceRefreshRef = useRef(false);
  const query = useQuery({
    queryKey: queryKeys.accounts,
    staleTime: 60_000,
    queryFn: () => {
      const refresh = forceRefreshRef.current;
      forceRefreshRef.current = false;
      return apiFetch<AccountsResponse>(refresh ? '/api/accounts?refresh=true' : '/api/accounts');
    },
  });

  return {
    accounts: query.data?.accounts ?? [],
    profiles: query.data?.profiles ?? [],
    selectedAccountIds: query.data?.selectedAccountIds ?? [],
    isLoading: query.isLoading,
    error: toApiError(query.error),
    isFetching: query.isFetching,
    refetch: (opts?: { refresh?: boolean }) => {
      if (opts?.refresh) forceRefreshRef.current = true;
      void query.refetch();
    },
  };
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (selectedAccountIds: string[]) =>
      apiFetch<{ selectedAccountIds: string[] }>('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedAccountIds }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      // Prefix match: every conversations head query, regardless of filters.
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
