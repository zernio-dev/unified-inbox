'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileUp,
  ImageIcon,
  Loader2,
  MapPin,
  MousePointerClick,
  Paperclip,
  Send,
  SmilePlus,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, ApiError } from '@/lib/api-client';
import { isWhatsApp, supportsAttachments, supportsReply, supportsTyping } from '@/lib/capabilities';
import { messagePreviewText } from '@/lib/format';
import { isWhatsAppOutside24h, makeOptimisticMessage } from '@/lib/optimistic';
import { useTemplateComposer } from '@/hooks/useTemplateComposer';
import type { Account, Conversation, Message } from '@/lib/types';
import { InteractiveDrawer, type InteractiveSendPayload } from './interactive-drawer';
import { LocationContactDrawer, type ExtraMode, type ExtraSendPayload } from './location-contact-drawer';
import { TemplateFields } from './template-fields';
import { VoiceRecorder } from './voice-recorder';

/**
 * Stable composer contract. Task 8 expands the internals (attachments, voice,
 * WhatsApp templates / interactive, typing) behind these same props; the
 * thread-pane wiring doesn't change.
 */
export interface ComposerProps {
  conversation: Conversation;
  account: Account | null;
  replyingTo: Message | null;
  onCancelReply: () => void;
  addOptimistic: (m: Message) => void;
  removeOptimistic: (id: string) => void;
  refreshHead: () => Promise<void>;
  patchConversation?: (id: string, patch: Partial<Conversation>) => void;
  messages: Message[];
  messagesLoading: boolean;
}

const MAX_TEXTAREA_HEIGHT_PX = 144; // ~6 lines, then scroll

const VALID_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
const ATTACHMENT_ACCEPT = VALID_ATTACHMENT_TYPES.join(',');
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// Outgoing typing indicators are throttled to one per 4s (WhatsApp typing
// lasts ~25s, Telegram ~5s, so this keeps it alive without spamming).
const TYPING_THROTTLE_MS = 4_000;

// Curated quick-insert grid; deliberately a static list, no emoji library.
const QUICK_EMOJI = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘',
  '😎', '🤩', '🥳', '😇', '🙂', '🙃', '😉', '😌',
  '🤔', '🤨', '😅', '😬', '🙄', '😴', '🤤', '😷',
  '😢', '😭', '😡', '🤬', '😱', '🤯', '🥺', '😳',
  '👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '✌️',
  '👌', '🤞', '🫶', '❤️', '🔥', '✨', '🎉', '🎊',
  '💯', '✅', '❌', '⚡', '💡', '📌', '🚀', '⭐',
  '😺', '🤖', '💀', '👀', '🤷', '🤦', '💬', '☕',
];

const attachmentKind = (file: File): 'image' | 'video' | 'file' =>
  file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';

const sentAttachmentLabel = (file: File): string => {
  const kind = attachmentKind(file);
  return kind === 'image' ? 'Sent an image' : kind === 'video' ? 'Sent a video' : 'Sent a file';
};

interface StagedAttachment {
  file: File;
  previewUrl: string;
}

export function Composer({
  conversation,
  replyingTo,
  onCancelReply,
  addOptimistic,
  removeOptimistic,
  refreshHead,
  patchConversation,
  messages,
  messagesLoading,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<StagedAttachment | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [sendingInteractive, setSendingInteractive] = useState(false);
  const [extraMode, setExtraMode] = useState<ExtraMode | null>(null);
  const [sendingExtra, setSendingExtra] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [dragging, setDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef(0);
  const dragDepthRef = useRef(0);
  // Mirror of `attachment` for stable callbacks + unmount cleanup.
  const attachmentRef = useRef<StagedAttachment | null>(null);
  attachmentRef.current = attachment;

  const platform = conversation.platform;
  const canAttach = supportsAttachments(platform);
  const whatsapp = isWhatsApp(platform);

  // Outside WhatsApp's 24h customer-care window only approved templates are
  // deliverable, so the whole composer row swaps for the template picker.
  const outside24h = isWhatsAppOutside24h({ platform, messages, messagesLoading });
  const template = useTemplateComposer({
    accountId: conversation.accountId,
    enabled: outside24h,
  });

  // Revoke the staged preview URL on unmount (remove/replace/send revoke it
  // inline via clearAttachment/stageAttachment).
  useEffect(
    () => () => {
      if (attachmentRef.current) URL.revokeObjectURL(attachmentRef.current.previewUrl);
    },
    [],
  );

  const clearAttachment = useCallback(() => {
    const prev = attachmentRef.current;
    if (prev) URL.revokeObjectURL(prev.previewUrl);
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Validate + stage a file as the pending attachment. Shared by the file
  // picker and drag-and-drop.
  const stageAttachment = useCallback((file: File) => {
    if (!VALID_ATTACHMENT_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF images and MP4 videos are supported');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('File size must be under 25MB');
      return;
    }
    const prev = attachmentRef.current;
    if (prev) URL.revokeObjectURL(prev.previewUrl);
    setAttachment({ file, previewUrl: URL.createObjectURL(file) });
  }, []);

  // Drag-and-drop anywhere over the thread: depth-counted enter/leave so
  // nested elements don't flicker the overlay, drop stages the file.
  const dropEnabled = canAttach && !outside24h;
  useEffect(() => {
    if (!dropEnabled) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current += 1;
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current -= 1;
      if (dragDepthRef.current <= 0) {
        dragDepthRef.current = 0;
        setDragging(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault(); // allow dropping
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) stageAttachment(file);
    };
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
      dragDepthRef.current = 0;
      setDragging(false);
    };
  }, [dropEnabled, stageAttachment]);

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  // Let the contact see "typing…" while composing. Fire-and-forget; failures
  // are silent.
  const notifyTyping = () => {
    if (!supportsTyping(platform)) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    void apiFetch(`/api/conversations/${encodeURIComponent(conversation.id)}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: conversation.accountId }),
    }).catch(() => {});
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    setEmojiOpen(false);
    // Restore focus + put the cursor after the inserted emoji once React
    // commits the new value.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const postJson = (body: Record<string, unknown>) =>
    apiFetch(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const postFormData = (form: FormData) =>
    apiFetch(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`, {
      method: 'POST',
      body: form,
    });

  // Shared optimistic send: append the stub, POST, then on success pull the
  // persisted message into the head (the stub is matched and dropped on merge)
  // and bump the conversation row; on failure roll back + toast.
  const runSend = async ({
    stub,
    request,
    preview,
    errorMessage,
    onError,
    setBusy,
  }: {
    stub: Message;
    request: () => Promise<unknown>;
    preview: string;
    errorMessage: string;
    onError?: () => void;
    setBusy?: (busy: boolean) => void;
  }): Promise<boolean> => {
    addOptimistic(stub);
    setBusy?.(true);
    try {
      await request();
      await refreshHead();
      patchConversation?.(conversation.id, {
        lastMessage: preview,
        updatedTime: new Date().toISOString(),
      });
      return true;
    } catch (err) {
      removeOptimistic(stub.id);
      onError?.();
      toast.error(err instanceof ApiError ? err.message : errorMessage);
      return false;
    } finally {
      setBusy?.(false);
    }
  };

  // Text and/or staged attachment.
  const send = async () => {
    const message = text.trim();
    const staged = attachment;
    if ((!message && !staged) || sending) return;

    const replyToId = supportsReply(platform) ? replyingTo?.id : undefined;
    const stub = makeOptimisticMessage({
      conversation,
      overrides: {
        message,
        ...(replyToId ? { metadata: { quotedMessageId: replyToId } } : {}),
        ...(staged
          ? {
              attachments: [
                {
                  id: `temp-att-${Date.now()}`,
                  type: attachmentKind(staged.file),
                  url: URL.createObjectURL(staged.file),
                },
              ],
            }
          : {}),
      },
    });

    setText('');
    resetHeight();
    onCancelReply();
    clearAttachment();

    // The guard above ensures at least one of message / staged is present.
    const preview = message ? `You: ${message}` : staged ? sentAttachmentLabel(staged.file) : '';
    await runSend({
      stub,
      request: () => {
        if (staged) {
          const form = new FormData();
          form.append('accountId', conversation.accountId);
          if (message) form.append('message', message);
          form.append('attachment', staged.file);
          if (replyToId) form.append('replyTo', replyToId);
          return postFormData(form);
        }
        return postJson({
          accountId: conversation.accountId,
          message,
          ...(replyToId ? { replyTo: replyToId } : {}),
        });
      },
      preview,
      errorMessage: 'Failed to send message',
      onError: () => setText(message),
      setBusy: setSending,
    });
  };

  // Recorded voice note: multipart with voiceNote flag so the server
  // transcodes MediaRecorder output to a WhatsApp-native container.
  const sendVoiceNote = (file: File) => {
    const stub = makeOptimisticMessage({
      conversation,
      overrides: {
        attachments: [
          { id: `temp-att-${Date.now()}`, type: 'audio', url: URL.createObjectURL(file) },
        ],
      },
    });
    void runSend({
      stub,
      request: () => {
        const form = new FormData();
        form.append('accountId', conversation.accountId);
        form.append('attachment', file);
        form.append('voiceNote', 'true');
        return postFormData(form);
      },
      preview: 'Voice note',
      errorMessage: 'Failed to send voice note',
      setBusy: setSending,
    });
  };

  // Interactive message (buttons / list / CTA / flow / location request /
  // call button) built in the drawer.
  const sendInteractive = async (payload: InteractiveSendPayload) => {
    const stub = makeOptimisticMessage({
      conversation,
      overrides: {
        message: payload.preview,
        metadata: { waInteractive: payload.optimisticMeta },
      },
    });
    const ok = await runSend({
      stub,
      request: () => postJson({ accountId: conversation.accountId, ...payload.body }),
      preview: payload.preview,
      errorMessage: 'Failed to send interactive message',
      setBusy: setSendingInteractive,
    });
    if (ok) setInteractiveOpen(false);
  };

  // Location pin / contact card built in the drawer.
  const sendExtra = async (payload: ExtraSendPayload) => {
    const stub = makeOptimisticMessage({
      conversation,
      overrides: { metadata: payload.optimisticMeta },
    });
    const ok = await runSend({
      stub,
      request: () => postJson({ accountId: conversation.accountId, ...payload.body }),
      preview: payload.preview,
      errorMessage: 'Failed to send',
      setBusy: setSendingExtra,
    });
    if (ok) setExtraMode(null);
  };

  // Approved template (the only deliverable outside the 24h window).
  const sendTemplate = async () => {
    const payload = template.buildPayload();
    if (!payload || sendingTemplate) return;
    const preview = template.previewBody;
    const ok = await runSend({
      stub: makeOptimisticMessage({ conversation, overrides: { message: preview } }),
      request: () =>
        postJson({
          accountId: conversation.accountId,
          template: { type: 'generic', elements: [payload] },
        }),
      preview,
      errorMessage: 'Failed to send template',
      setBusy: setSendingTemplate,
    });
    if (ok) template.reset();
  };

  if (outside24h) {
    return (
      <footer className="flex-none border-t border-[var(--chat-border)] bg-[var(--chat-surface)] p-3">
        <div className="space-y-3 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-warning-bg)] p-3">
          <p className="text-xs text-[var(--chat-warning-fg)]">
            It&apos;s been over 24 hours since this contact last messaged you. WhatsApp only
            delivers approved templates now. Pick one to reach them.
          </p>
          <TemplateFields composer={template} />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void sendTemplate()}
              disabled={!template.canSend || sendingTemplate}
            >
              {sendingTemplate && <Loader2 className="size-4 animate-spin" />}
              Send template
            </Button>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="flex-none space-y-2 border-t border-[var(--chat-border)] bg-[var(--chat-surface)] p-3">
      {/* Drop overlay: purely visual; the document-level listeners do the work. */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/80">
          <div className="rounded-xl border-2 border-dashed border-primary bg-[var(--chat-surface)] px-8 py-6 text-sm font-medium">
            Drop to attach
          </div>
        </div>
      )}

      {replyingTo && !recordingVoice && (
        <div className="flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">
              Replying to{' '}
              {replyingTo.direction === 'outgoing'
                ? 'yourself'
                : conversation.participantName || replyingTo.senderName || 'them'}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {messagePreviewText(replyingTo)}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            title="Cancel reply"
            aria-label="Cancel reply"
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Staged attachment preview chip */}
      {attachment && !recordingVoice && (
        <div className="relative inline-block">
          {attachment.file.type.startsWith('video/') ? (
            <video
              src={attachment.previewUrl}
              className="max-h-24 rounded-lg border border-[var(--chat-border)]"
              controls
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.previewUrl}
              alt="Attachment preview"
              className="max-h-24 rounded-lg border border-[var(--chat-border)]"
            />
          )}
          <button
            type="button"
            onClick={clearAttachment}
            title="Remove attachment"
            aria-label="Remove attachment"
            className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white hover:bg-destructive/90"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-1 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-2 py-1.5">
        {canAttach && (
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) stageAttachment(file);
            }}
          />
        )}

        {/* While recording a voice note, the recorder takes over the whole
            bar; the text input + other controls collapse. */}
        {!recordingVoice && (
          <Textarea
            ref={textareaRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              // Auto-grow up to the cap, then scroll.
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
              if (e.target.value.trim()) notifyTyping();
            }}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline (textarea default).
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type a message..."
            aria-label="Message"
            className="max-h-36 min-h-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-base shadow-none field-sizing-fixed focus-visible:ring-0 sm:text-sm"
          />
        )}

        {!recordingVoice && (
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Insert emoji"
                aria-label="Insert emoji"
                className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <SmilePlus className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-auto p-2">
              <div className="grid grid-cols-8 gap-0.5">
                {QUICK_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-muted"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Attach: WhatsApp gets a menu (media, file, location, contact,
            interactive); other attachment-capable platforms open the file
            picker directly. */}
        {!recordingVoice &&
          canAttach &&
          (whatsapp ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={sending}
                  title="Attach"
                  aria-label="Attach"
                  className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <Paperclip className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52">
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <ImageIcon className="size-4" /> Photo or video
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <FileUp className="size-4" /> File
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setExtraMode('location')}>
                  <MapPin className="size-4" /> Location
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setExtraMode('contact')}>
                  <User className="size-4" /> Contact
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setInteractiveOpen(true)}>
                  <MousePointerClick className="size-4" /> Interactive message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Attach"
              aria-label="Attach"
              className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="size-4" />
            </Button>
          ))}

        {whatsapp && (
          <VoiceRecorder
            disabled={sending}
            onRecorded={sendVoiceNote}
            onRecordingChange={setRecordingVoice}
          />
        )}

        {!recordingVoice && (
          <Button
            size="icon"
            onClick={() => void send()}
            disabled={(!text.trim() && !attachment) || sending}
            aria-label="Send message"
            className="size-8 shrink-0 rounded-lg"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        )}
      </div>

      <InteractiveDrawer
        open={interactiveOpen}
        onOpenChange={setInteractiveOpen}
        accountId={conversation.accountId}
        sending={sendingInteractive}
        onSend={(payload) => void sendInteractive(payload)}
      />
      <LocationContactDrawer
        mode={extraMode}
        onClose={() => setExtraMode(null)}
        sending={sendingExtra}
        onSend={(payload) => void sendExtra(payload)}
      />
    </footer>
  );
}
