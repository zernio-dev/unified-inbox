import { describe, expect, it } from 'vitest';
import {
  MESSAGE_PLATFORMS,
  NEW_CONVERSATION_PLATFORMS,
  QUICK_REACTIONS,
  isWhatsApp,
  supportsAttachments,
  supportsDelete,
  supportsEdit,
  supportsReactions,
  supportsReply,
  supportsTyping,
} from '../capabilities';
import type { Platform } from '../types';

const ALL: Platform[] = ['facebook', 'instagram', 'twitter', 'bluesky', 'reddit', 'telegram', 'whatsapp'];

function expectGate(gate: (p: Platform) => boolean, allowed: Platform[]) {
  for (const p of ALL) {
    expect(gate(p), `${p} should be ${allowed.includes(p)}`).toBe(allowed.includes(p));
  }
}

describe('capability gates', () => {
  it('supportsAttachments', () => {
    expectGate(supportsAttachments, ['telegram', 'facebook', 'twitter', 'instagram', 'whatsapp']);
  });

  it('supportsReply', () => {
    expectGate(supportsReply, ['whatsapp', 'telegram']);
  });

  it('supportsReactions', () => {
    expectGate(supportsReactions, ['whatsapp', 'telegram']);
  });

  it('supportsTyping', () => {
    expectGate(supportsTyping, ['facebook', 'telegram', 'whatsapp']);
  });

  it('supportsEdit', () => {
    expectGate(supportsEdit, ['telegram']);
  });

  it('supportsDelete', () => {
    expectGate(supportsDelete, ['telegram', 'twitter', 'bluesky', 'reddit']);
  });
});

describe('platform constants', () => {
  it('NEW_CONVERSATION_PLATFORMS', () => {
    expect(NEW_CONVERSATION_PLATFORMS).toEqual(['twitter', 'bluesky', 'reddit', 'whatsapp']);
  });

  it('MESSAGE_PLATFORMS covers all seven platforms', () => {
    expect(MESSAGE_PLATFORMS).toEqual(ALL);
  });

  it('QUICK_REACTIONS', () => {
    expect(QUICK_REACTIONS).toEqual(['👍', '❤️', '😂', '😮', '😢', '🙏']);
  });
});

describe('isWhatsApp', () => {
  it('true only for whatsapp', () => {
    expect(isWhatsApp('whatsapp')).toBe(true);
    expect(isWhatsApp('telegram')).toBe(false);
    expect(isWhatsApp('facebook')).toBe(false);
  });
});
