'use client';

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
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: queryKeys.accounts,
    staleTime: 60_000,
    queryFn: () => apiFetch<AccountsResponse>('/api/accounts'),
  });

  return {
    accounts: query.data?.accounts ?? [],
    profiles: query.data?.profiles ?? [],
    selectedAccountIds: query.data?.selectedAccountIds ?? [],
    isLoading: query.isLoading,
    error: toApiError(query.error),
    refetch: () => {
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
