'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Check, CheckCheck, Clock, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Message } from '@/lib/types';

const ICON = 'inline-block size-3.5 shrink-0';

function WithTooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}

/**
 * WhatsApp-style delivery ticks inline with the outgoing-message timestamp.
 * Renders nothing when the platform never reported a status (legacy rows stay
 * clean). Optimistic stubs show a pending clock until the server echo lands.
 */
export function DeliveryStatusIcon({
  status,
  error,
  optimistic,
}: {
  status: Message['deliveryStatus'];
  error?: Message['deliveryError'];
  optimistic?: boolean;
}) {
  if (optimistic) {
    return (
      <WithTooltip content="Sending">
        <Clock className={`${ICON} opacity-60`} aria-label="Sending" />
      </WithTooltip>
    );
  }
  if (!status) return null;

  if (status === 'sent') {
    return (
      <WithTooltip content="Sent">
        <Check className={`${ICON} opacity-60`} aria-label="Sent" />
      </WithTooltip>
    );
  }
  if (status === 'delivered') {
    return (
      <WithTooltip content="Delivered">
        <CheckCheck className={`${ICON} opacity-60`} aria-label="Delivered" />
      </WithTooltip>
    );
  }
  if (status === 'read') {
    return (
      <WithTooltip content="Read">
        <CheckCheck className={`${ICON} text-[var(--chat-check)]`} aria-label="Read" />
      </WithTooltip>
    );
  }
  if (status === 'failed') {
    const { title, message } = error ?? {};
    const tooltip =
      title && message
        ? title === message
          ? title
          : `${title}: ${message}`
        : title || message || 'Failed to send';
    return (
      <WithTooltip content={tooltip}>
        <AlertCircle className={`${ICON} text-destructive`} aria-label={`Failed: ${tooltip}`} />
      </WithTooltip>
    );
  }
  // deleted
  return (
    <WithTooltip content="Deleted by sender">
      <Trash2 className={`${ICON} opacity-60`} aria-label="Deleted" />
    </WithTooltip>
  );
}
