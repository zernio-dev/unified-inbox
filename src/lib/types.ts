export type Platform =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'bluesky'
  | 'reddit'
  | 'telegram'
  | 'whatsapp';

export interface Attachment {
  id?: string;
  type: string;
  url?: string;
  name?: string;
  mimeType?: string;
  previewUrl?: string;
  requiresExternalView?: boolean;
  payload?: { title?: string; [k: string]: unknown };
}

export interface MessageReaction {
  emoji: string;
  fromMe: boolean;
  reactedAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  accountId: string;
  platform: Platform;
  message: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  senderId?: string;
  senderName?: string;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted';
  deliveryError?: { code?: string | number; title?: string; message?: string };
  isEdited?: boolean;
  editedAt?: string;
  editCount?: number;
  editHistory?: { text?: string; editedAt?: string }[];
  isDeleted?: boolean;
  deletedAt?: string;
  reactions?: MessageReaction[];
}

export interface Conversation {
  id: string;
  accountId: string;
  accountUsername?: string;
  platform: Platform;
  participantId?: string;
  participantName?: string;
  participantUsername?: string | null;
  participantPicture?: string | null;
  participantVerifiedType?: 'blue' | 'government' | 'business' | 'none' | null;
  lastMessage: string;
  updatedTime: string;
  status: 'active' | 'archived';
  unreadCount?: number;
  url?: string | null;
  contactBlocked?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Account {
  _id: string;
  platform: Platform;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  profileId?: { _id: string; name: string } | string | null;
  isActive?: boolean;
  enabled?: boolean;
}

export interface Profile {
  _id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

export interface ZernioTemplate {
  id?: string;
  name: string;
  status: string;
  category?: string;
  language: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  url?: string;
  buttons?: { type?: string; text?: string; url?: string }[];
  [k: string]: unknown;
}

export interface ZernioFlow {
  id: string;
  name: string;
  status: string;
}
