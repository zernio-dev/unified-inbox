'use client';

import { PlatformIcon } from '@/components/platform-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  conversationDisplayName,
  formatPhonePretty,
  formatRelativeTime,
  initials,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/lib/types';
import { isVerifiedType, XVerifiedBadge } from './verified-badge';

export function ConversationRow({
  conversation,
  isSelected,
  allAccountsMode,
  onSelect,
}: {
  conversation: Conversation;
  isSelected: boolean;
  /** No account filter active: show the platform badge + "via account" chip. */
  allAccountsMode: boolean;
  onSelect: (conv: Conversation) => void;
}) {
  const name = conversationDisplayName(conversation);
  const unread = Boolean(conversation.unreadCount);

  // CONTACT id (their phone or handle): useful when names are ambiguous or
  // are just the verified business name. Hidden when it would repeat the name.
  const contactId =
    conversation.platform === 'whatsapp'
      ? conversation.participantId && conversation.participantId !== conversation.participantName
        ? formatPhonePretty(`+${conversation.participantId}`)
        : null
      : conversation.participantUsername &&
          conversation.participantUsername !== conversation.participantName
        ? `@${conversation.participantUsername}`
        : null;

  // MY account ("via ..."): answers "which of my inboxes is this?" when the
  // list spans all accounts. accountUsername is the display phone number for
  // WhatsApp, the handle for everything else.
  const viaAccount =
    allAccountsMode && conversation.accountUsername
      ? conversation.platform === 'whatsapp'
        ? formatPhonePretty(conversation.accountUsername)
        : `@${conversation.accountUsername}`
      : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      className={cn(
        'flex min-h-[68px] w-full items-center gap-3 border-b border-[var(--chat-border)] px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-[var(--chat-hover)]'
          : 'hover:bg-[color-mix(in_oklab,var(--chat-hover)_60%,transparent)]',
      )}
    >
      <div className="relative flex-none">
        <Avatar className="size-11">
          {conversation.participantPicture && (
            <AvatarImage src={conversation.participantPicture} alt="" />
          )}
          <AvatarFallback className="text-sm text-muted-foreground">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        {allAccountsMode && (
          <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border border-[var(--chat-border)] bg-[var(--chat-surface)]">
            <PlatformIcon platform={conversation.platform} className="size-2.5" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{name}</span>
          {isVerifiedType(conversation.participantVerifiedType) && (
            <XVerifiedBadge type={conversation.participantVerifiedType} />
          )}
          <span className="ml-auto flex-none text-[11px] text-muted-foreground/70">
            {formatRelativeTime(conversation.updatedTime)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className={cn(
              'truncate text-xs',
              unread ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {conversation.lastMessage}
          </span>
          {unread && <span className="ml-auto size-2 flex-none rounded-full bg-primary" />}
        </div>
        {(contactId || viaAccount) && (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {contactId && <span className="min-w-0 truncate">{contactId}</span>}
            {viaAccount && (
              <span className="max-w-44 flex-none truncate rounded-full bg-muted px-1.5 py-px text-[10px]">
                via {viaAccount}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
