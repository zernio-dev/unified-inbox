'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TemplateFields } from '@/components/composer/template-fields';
import { PlatformIcon } from '@/components/platform-icon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTemplateComposer } from '@/hooks/useTemplateComposer';
import { apiFetch, ApiError } from '@/lib/api-client';
import { NEW_CONVERSATION_PLATFORMS } from '@/lib/capabilities';
import { makeOptimisticMessage } from '@/lib/optimistic';
import { cn } from '@/lib/utils';
import type { Account, Conversation, Message, Platform } from '@/lib/types';

/** The recipient input shape per platform that can cold-initiate a DM. */
function recipientFieldForPlatform(platform: Platform): { label: string; placeholder: string } {
  switch (platform) {
    case 'bluesky':
      return { label: 'Handle', placeholder: 'name.bsky.social' };
    case 'reddit':
      return { label: 'Username', placeholder: 'u/username' };
    case 'whatsapp':
      return { label: 'Phone number', placeholder: '+1 555 123 4567' };
    default:
      return { label: 'Username or handle', placeholder: '@username' };
  }
}

/** Strip a leading @ or u/ (and surrounding whitespace) from a typed handle. */
function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@/, '')
    .replace(/^\/?u\//i, '');
}

interface CreateConversationResponse {
  success?: boolean;
  data?: { conversationId: string; participantId?: string; participantName?: string };
}

/**
 * Composer for initiating a brand-new conversation. Only platforms that can
 * cold-initiate a DM are listed (X / Bluesky / Reddit / WhatsApp). WhatsApp
 * can't send freeform to a cold contact (Meta requires an approved template),
 * so it swaps the message textarea for the template picker.
 */
export function NewMessageDialog({
  open,
  onOpenChange,
  accounts,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onCreated: (opts: { conversation: Conversation; optimisticMessage: Message }) => void;
}) {
  const eligible = useMemo(
    () => accounts.filter((a) => NEW_CONVERSATION_PLATFORMS.includes(a.platform)),
    [accounts],
  );

  const [accountId, setAccountId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = eligible.find((a) => a._id === accountId);
  const platform = account?.platform;
  const isWhatsApp = platform === 'whatsapp';
  const field = recipientFieldForPlatform(platform ?? 'twitter');

  const wa = useTemplateComposer({ accountId, enabled: open && isWhatsApp });

  // Auto-select the first eligible account when the dialog opens.
  useEffect(() => {
    if (open && !accountId && eligible.length > 0) setAccountId(eligible[0]._id);
  }, [open, eligible, accountId]);

  const sendDisabled =
    !accountId || !recipient.trim() || (isWhatsApp ? !wa.canSend : !message.trim());

  const handleSend = async () => {
    if (sendDisabled || sending || !account || !platform) return;
    setSending(true);
    setError(null);
    const preview = isWhatsApp
      ? wa.previewBody || `[template] ${wa.templateName}`
      : message.trim();
    try {
      const body: Record<string, unknown> = { accountId };
      if (isWhatsApp) {
        body.participantId = recipient.replace(/[^\d]/g, '');
        // Store/display the rendered template body (what the recipient sees);
        // the actual send still uses the template fields below.
        body.message = preview;
        body.templateName = wa.templateName;
        body.templateLanguage = wa.selected?.language || 'en_US';
        body.templateParams = wa.params;
      } else {
        body.participantUsername = normalizeHandle(recipient);
        body.message = message.trim();
      }
      const res = await apiFetch<CreateConversationResponse>('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = res.data;
      if (!data?.conversationId) throw new Error('Failed to start conversation');

      const conversation: Conversation = {
        id: data.conversationId,
        accountId,
        accountUsername: account.username,
        platform,
        participantName: data.participantName || recipient,
        lastMessage: preview,
        updatedTime: new Date().toISOString(),
        status: 'active',
        unreadCount: 0,
      };
      const optimisticMessage = makeOptimisticMessage({
        conversation,
        overrides: { id: `new_${Date.now()}`, message: preview },
      });
      toast.success('Message sent');
      onCreated({ conversation, optimisticMessage });
      setRecipient('');
      setMessage('');
      wa.reset();
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof Error
          ? e.message
          : 'Failed to start conversation',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Start a new conversation</DialogDescription>
        </DialogHeader>

        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None of your connected accounts support starting a new conversation. X, Bluesky,
            Reddit, and WhatsApp do.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Select account"
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[var(--chat-border)] bg-[var(--chat-surface)] px-3 text-sm hover:bg-[var(--chat-hover)]"
                >
                  {account ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <PlatformIcon platform={account.platform} />
                      <span className="truncate">
                        {account.username || account.displayName || account._id}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select an account...</span>
                  )}
                  <ChevronDown className="size-4 shrink-0 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
                  {eligible.map((a) => (
                    <DropdownMenuItem key={a._id} onSelect={() => setAccountId(a._id)}>
                      <PlatformIcon platform={a.platform} />
                      <span className="truncate">{a.username || a.displayName || a._id}</span>
                      <Check
                        className={cn('ml-auto size-3.5', accountId !== a._id && 'opacity-0')}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{field.label}</Label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={field.placeholder}
                className="bg-[var(--chat-surface)]"
              />
            </div>

            {isWhatsApp ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  WhatsApp requires an approved template to start a conversation.
                </p>
                <TemplateFields composer={wa} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  aria-label="Message"
                  className="bg-[var(--chat-surface)]"
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={sendDisabled || sending || eligible.length === 0}
          >
            {sending && <Loader2 className="size-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
