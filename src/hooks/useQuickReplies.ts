'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { QuickReply } from '@/app/api/quick-replies/route';

interface QuickRepliesResponse {
  quickReplies?: QuickReply[];
  error?: string;
}

export function useQuickReplies(profileId: string = 'default') {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.quickReplies(profileId),
    staleTime: 30_000,
    queryFn: () => apiFetch<QuickRepliesResponse>(`/api/quick-replies?profileId=${profileId}`),
  });

  const addMutation = useMutation({
    mutationFn: (data: {
      profileId?: string;
      shortcut: string;
      title: string;
      content: string;
      mediaUrl?: string;
      category?: string;
    }) =>
      apiFetch<{ quickReply: QuickReply }>('/api/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, profileId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quickReplies(profileId) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      shortcut?: string;
      title?: string;
      content?: string;
      mediaUrl?: string;
      category?: string;
    }) =>
      apiFetch<{ quickReply: QuickReply }>('/api/quick-replies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quickReplies(profileId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/quick-replies?id=${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.quickReplies(profileId) });
    },
  });

  return {
    quickReplies: query.data?.quickReplies ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    addQuickReply: addMutation.mutateAsync,
    updateQuickReply: updateMutation.mutateAsync,
    deleteQuickReply: deleteMutation.mutateAsync,
    isSaving: addMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
