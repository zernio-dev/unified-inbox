'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, ExternalLink, Search } from 'lucide-react';
import { PLATFORM_LABELS } from '@/components/platform-icon';
import { isVerifiedType, XVerifiedBadge } from '@/components/conversation-list/verified-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  conversationDisplayName,
  formatPhonePretty,
  formatRelativeTime,
  initials,
} from '@/lib/format';
import type { Conversation } from '@/lib/types';

export function ThreadHeader({
  conversation,
  onBack,
  onToggleSearch,
  actionsSlot,
}: {
  conversation: Conversation;
  onBack: () => void;
  /** Toggles the in-thread search bar (thread-pane owns the state). */
  onToggleSearch?: () => void;
  /** Task 9 mounts the block-menu / call button here. */
  actionsSlot?: ReactNode;
}) {
  const name = conversationDisplayName(conversation);

  // CONTACT id: phone for WhatsApp, @handle elsewhere. Hidden when it would
  // just repeat the name (mirrors the conversation-list row).
  const contactSub =
    conversation.platform === 'whatsapp'
      ? conversation.participantId && conversation.participantId !== conversation.participantName
        ? formatPhonePretty(`+${conversation.participantId}`)
        : null
      : conversation.participantUsername &&
          conversation.participantUsername !== conversation.participantName
        ? `@${conversation.participantUsername}`
        : null;
  const lastActive = conversation.updatedTime ? formatRelativeTime(conversation.updatedTime) : null;

  return (
    <header className="flex h-14 flex-none items-center gap-2.5 border-b border-[var(--chat-border)] bg-[var(--chat-surface)] px-3">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onBack}
        aria-label="Back to conversations"
      >
        <ArrowLeft className="size-4" />
      </Button>
      <Avatar className="size-9 flex-none">
        {conversation.participantPicture && (
          <AvatarImage src={conversation.participantPicture} alt="" />
        )}
        <AvatarFallback className="text-sm text-muted-foreground">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-1 truncate text-sm font-medium">
          <span className="truncate">{name}</span>
          {isVerifiedType(conversation.participantVerifiedType) && (
            <XVerifiedBadge type={conversation.participantVerifiedType} />
          )}
        </h2>
        {(contactSub || lastActive) && (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {contactSub && <span className="truncate">{contactSub}</span>}
            {contactSub && lastActive && <span>·</span>}
            {lastActive && <span className="flex-none">Active {lastActive}</span>}
          </p>
        )}
      </div>
      <div className="flex flex-none items-center gap-1.5">
        {onToggleSearch && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={onToggleSearch}
            aria-label="Search in conversation"
          >
            <Search className="size-4" />
          </Button>
        )}
        {conversation.url && (
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <a
              href={conversation.url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              title={`Open in ${PLATFORM_LABELS[conversation.platform]}`}
              aria-label={`Open in ${PLATFORM_LABELS[conversation.platform]}`}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        {actionsSlot}
      </div>
    </header>
  );
}
