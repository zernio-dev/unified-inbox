import type { Platform } from './types';

const has = (platforms: Platform[]) => (p: Platform) => platforms.includes(p);

export const supportsAttachments = has(['telegram', 'facebook', 'twitter', 'instagram', 'whatsapp']);
export const supportsReply = has(['whatsapp', 'telegram']);
export const supportsReactions = has(['whatsapp', 'telegram']);
export const supportsTyping = has(['facebook', 'telegram', 'whatsapp']);
export const supportsEdit = has(['telegram']);
export const supportsDelete = has(['telegram', 'twitter', 'bluesky', 'reddit']);

export const NEW_CONVERSATION_PLATFORMS: Platform[] = ['twitter', 'bluesky', 'reddit', 'whatsapp'];
export const MESSAGE_PLATFORMS: Platform[] = [
  'facebook',
  'instagram',
  'twitter',
  'bluesky',
  'reddit',
  'telegram',
  'whatsapp',
];

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const isWhatsApp = (p: Platform) => p === 'whatsapp';
