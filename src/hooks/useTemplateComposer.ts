'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  buildTemplatePayload,
  extractTemplateVariableTokens,
  renderTemplatePreview,
  templateBodyText,
} from '@/lib/whatsapp/template-utils';
import type { ZernioTemplate } from '@/lib/types';

export interface TemplatePayload {
  name: string;
  language: string;
  components: { type: string; parameters: { type: string; text: string }[] }[];
}

export interface TemplateComposer {
  templates: ZernioTemplate[];
  loading: boolean;
  templateName: string;
  setTemplateName: (name: string) => void;
  selected: ZernioTemplate | undefined;
  /** Canonical `{{token}}` list for the selected template, in fill order. */
  tokens: string[];
  params: string[];
  setParam: (index: number, value: string) => void;
  previewBody: string;
  canSend: boolean;
  buildPayload: () => TemplatePayload | null;
  reset: () => void;
}

/**
 * "Pick an approved template + fill its variables" composer state. WhatsApp
 * only delivers free-form messages inside the 24h customer-care window;
 * outside it the composer swaps to this template flow, so the hook owns
 * loading approved templates, the selection, variable values, the live
 * preview, and the send payload.
 */
export function useTemplateComposer({
  accountId,
  enabled,
}: {
  accountId: string;
  enabled: boolean;
}): TemplateComposer {
  const query = useQuery({
    queryKey: queryKeys.templates(accountId),
    enabled: enabled && !!accountId,
    staleTime: 300_000,
    queryFn: () =>
      apiFetch<{ templates?: ZernioTemplate[]; data?: ZernioTemplate[] }>(
        `/api/whatsapp/templates?accountId=${encodeURIComponent(accountId)}`,
      ),
  });

  const templates = useMemo(
    () => (query.data?.templates ?? query.data?.data ?? []).filter((t) => t.status === 'APPROVED'),
    [query.data],
  );

  const [templateName, setTemplateName] = useState('');
  const [params, setParams] = useState<string[]>([]);

  const selected = templates.find((t) => t.name === templateName);
  const tokens = useMemo(() => extractTemplateVariableTokens(selected?.components ?? []), [selected]);

  // Reset the value array whenever the variable count or template changes.
  useEffect(() => {
    setParams(Array(tokens.length).fill(''));
  }, [tokens.length, templateName]);

  const setParam = (index: number, value: string) =>
    setParams((prev) => prev.map((p, i) => (i === index ? value : p)));

  const previewBody = useMemo(
    () => renderTemplatePreview(templateBodyText(selected?.components ?? []), tokens, params),
    [selected, tokens, params],
  );

  // WhatsApp rejects sends with empty body parameters, so gate here rather
  // than letting the API bounce it back.
  const canSend = !!selected && params.every((p) => p.trim().length > 0);

  const buildPayload = (): TemplatePayload | null =>
    selected
      ? buildTemplatePayload({ name: selected.name, language: selected.language, params })
      : null;

  const reset = () => {
    setTemplateName('');
    setParams([]);
  };

  return {
    templates,
    loading: query.isLoading,
    templateName,
    setTemplateName,
    selected,
    tokens,
    params,
    setParam,
    previewBody,
    canSend,
    buildPayload,
    reset,
  };
}
