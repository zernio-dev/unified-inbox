'use client';

import { MapPin, Pencil, Reply, Trash2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QUICK_REACTIONS, supportsDelete, supportsEdit, supportsReactions, supportsReply } from '@/lib/capabilities';
import { messagePreviewText } from '@/lib/format';
import {
  getContacts,
  getLocation,
  getQuickReplyBadge,
  getQuotedMessageId,
  getWaInteractive,
} from '@/lib/message-metadata';
import { safeHref } from '@/lib/media';
import { isOptimisticId } from '@/lib/optimistic';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/lib/types';
import { AttachmentView } from './attachment';
import { DeliveryStatusIcon } from './delivery-status-icon';
import { EditedLabel } from './edited-label';
import { InteractivePreview } from './interactive-preview';

export interface MessageBubbleProps {
  msg: Message;
  conversation: Conversation;
  /** Resolve metadata.quotedMessageId to the quoted message (when loaded). */
  messageById: Map<string, Message>;
  highlighted: boolean;
  onQuoteClick: (id: string) => void;
  onReact: (msg: Message, emoji: string) => void;
  onReply: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onDelete: (msg: Message) => void;
}

export function MessageBubble({
  msg,
  conversation,
  messageById,
  highlighted,
  onQuoteClick,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const outgoing = msg.direction === 'outgoing';
  const platform = conversation.platform;
  const optimistic = isOptimisticId(msg.id);

  const quotedId = getQuotedMessageId(msg.metadata);
  const quoted = quotedId ? messageById.get(quotedId) : undefined;
  const badgeLabel = getQuickReplyBadge(msg.metadata);
  const waInteractive = getWaInteractive(msg.metadata);
  const location = getLocation(msg.metadata);
  const contacts = getContacts(msg.metadata);

  const canReact = supportsReactions(platform);
  const canReply = supportsReply(platform);
  const canEdit = outgoing && supportsEdit(platform);
  const canDelete = outgoing && supportsDelete(platform);
  // No toolbar on optimistic stubs: they have no server id to act on yet.
  const hasToolbar = !optimistic && (canReact || canReply || canEdit || canDelete);

  return (
    <div className={cn('group flex items-center gap-1', outgoing ? 'justify-end' : 'justify-start')}>
      {/* Hover toolbar flanks the bubble: left of outgoing, right of incoming.
          Always visible on touch (no hover), revealed on hover from sm up. */}
      {hasToolbar && (
        <div
          className={cn(
            'flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
            outgoing ? 'order-first' : 'order-last',
          )}
        >
          {canReact &&
            QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(msg, emoji)}
                title={`React ${emoji}`}
                aria-label={`React ${emoji}`}
                className="px-0.5 text-base leading-none transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          {canReply && (
            <button
              type="button"
              onClick={() => onReply(msg)}
              title="Reply"
              aria-label="Reply"
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <Reply className="size-4" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(msg)}
              title="Edit"
              aria-label="Edit message"
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(msg)}
              title="Delete"
              aria-label="Delete message"
              className="p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}

      <div
        data-message-id={msg.id}
        className={cn(
          'max-w-[70%] rounded-2xl px-3 py-2 transition-shadow',
          outgoing ? 'bg-[var(--chat-bubble-outgoing)]' : 'bg-[var(--chat-bubble-incoming)]',
          highlighted && 'ring-2 ring-primary/70',
        )}
      >
        {/* Quoted message this one replies to (WhatsApp context / Telegram reply). */}
        {quotedId && (
          <button
            type="button"
            onClick={() => onQuoteClick(quotedId)}
            className="mb-1.5 block w-full rounded border-l-2 border-primary/60 bg-foreground/5 px-2 py-1 text-left text-xs"
          >
            <span className="block truncate font-medium opacity-90">
              {quoted
                ? quoted.direction === 'outgoing'
                  ? 'You'
                  : conversation.participantName || quoted.senderName || 'Message'
                : 'Message'}
            </span>
            <span className="block truncate opacity-70">
              {quoted ? messagePreviewText(quoted) : 'Original message'}
            </span>
          </button>
        )}

        {badgeLabel && (
          <Badge variant="secondary" className="mb-1 rounded-full">
            {badgeLabel}
          </Badge>
        )}

        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {msg.attachments.map((att, i) => (
              <AttachmentView key={att.id ?? i} att={att} platform={platform} />
            ))}
          </div>
        )}

        {msg.message && (
          <p className="whitespace-pre-wrap break-words text-sm">{msg.message}</p>
        )}

        {waInteractive && <InteractivePreview meta={waInteractive} />}

        {/* Location pin card (opens Google Maps). */}
        {location && (
          <a
            href={safeHref(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`,
            )}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="mt-1 flex items-center gap-2 rounded-lg border border-foreground/15 bg-foreground/5 p-2 text-sm hover:opacity-90"
          >
            <MapPin className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{location.name || 'Location'}</span>
              {location.address && (
                <span className="block truncate text-xs opacity-70">{location.address}</span>
              )}
            </span>
          </a>
        )}

        {contacts.map((contact, i) => (
          <div
            key={i}
            className="mt-1 flex items-center gap-2 rounded-lg border border-foreground/15 bg-foreground/5 p-2 text-sm"
          >
            <User className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{contact.formattedName}</span>
              {contact.phone && <span className="block truncate text-xs opacity-70">{contact.phone}</span>}
            </span>
          </div>
        ))}

        {msg.reactions && msg.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {msg.reactions.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs"
                title={r.fromMe ? 'You reacted' : 'They reacted'}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px]">
          <span className="opacity-60">
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {msg.isEdited && (
            <>
              <span className="opacity-60">·</span>
              <EditedLabel msg={msg} />
            </>
          )}
          {outgoing && (
            <DeliveryStatusIcon
              status={msg.deliveryStatus}
              error={msg.deliveryError}
              optimistic={optimistic}
            />
          )}
        </div>
      </div>
    </div>
  );
}
