'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, MoreVertical, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Conversation } from '@/lib/types';

interface BlockUsersResponse {
  error?: string | { message?: string };
  failed?: { errors?: string[] }[];
}

/**
 * Block/unblock the WhatsApp contact of the open conversation (Meta Block
 * Users API). Blocked contacts can't message the number or see it online.
 *
 * Blocked state: true/false once known, null = unknown (lazy lookup runs when
 * the menu opens), 'failed' = lookup failed (menu shows both actions rather
 * than guessing). Seeded from the conversation payload when the list endpoint
 * already joined the blocklist server-side.
 */
export function BlockMenu({ conversation }: { conversation: Conversation }) {
  const [blocked, setBlocked] = useState<boolean | null | 'failed'>(null);
  const { accountId, participantId } = conversation;

  useEffect(() => {
    setBlocked(
      typeof conversation.contactBlocked === 'boolean' ? conversation.contactBlocked : null,
    );
  }, [conversation.id, conversation.contactBlocked]);

  const checkBlocked = useCallback(async () => {
    const waId = participantId?.replace(/^\+/, '');
    if (!accountId || !waId) return;
    const d = (await fetch(
      `/api/whatsapp/block-users/status?accountId=${encodeURIComponent(accountId)}&user=${encodeURIComponent(waId)}`,
      { cache: 'no-store' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch((): null => null)) as { blocked?: unknown } | null;
    setBlocked(typeof d?.blocked === 'boolean' ? d.blocked : 'failed');
  }, [accountId, participantId]);

  const setBlockState = async (block: boolean) => {
    if (!accountId || !participantId) return;
    const phone = `+${participantId.replace(/^\+/, '')}`;
    if (
      block &&
      !confirm('Block this contact? They will no longer be able to message you on WhatsApp.')
    ) {
      return;
    }
    try {
      const res = await fetch('/api/whatsapp/block-users', {
        method: block ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, users: [phone] }),
      });
      const data = (await res.json().catch(() => ({}))) as BlockUsersResponse;
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : data.error?.message;
        toast.error(msg || `Failed to ${block ? 'block' : 'unblock'} contact`);
        return;
      }
      // Per-user failures arrive in a 200 envelope. Meta only allows blocking
      // contacts who messaged within the last 24h, so surface its reason verbatim.
      const failed = data.failed?.[0];
      if (failed) {
        toast.error(failed.errors?.[0] || `Could not ${block ? 'block' : 'unblock'} this contact`);
        return;
      }
      toast.success(block ? 'Contact blocked' : 'Contact unblocked');
      setBlocked(block);
    } catch {
      toast.error(`Failed to ${block ? 'block' : 'unblock'} contact`);
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && blocked === null) void checkBlocked();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Conversation actions"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {blocked === null ? (
          <DropdownMenuItem disabled>
            <Ban className="size-4 opacity-50" />
            Checking block status
          </DropdownMenuItem>
        ) : (
          <>
            {blocked !== true && (
              <DropdownMenuItem variant="destructive" onClick={() => void setBlockState(true)}>
                <Ban className="size-4" />
                Block contact
              </DropdownMenuItem>
            )}
            {blocked !== false && (
              <DropdownMenuItem onClick={() => void setBlockState(false)}>
                <Undo2 className="size-4" />
                Unblock contact
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
