import { describe, expect, it } from 'vitest';
import type { Attachment } from '../types';
import {
  getContacts,
  getLocation,
  getQuickReplyBadge,
  getQuotedMessageId,
  getWaInteractive,
  isCallEvent,
  normalizeMessage,
} from '../message-metadata';

describe('normalizeMessage', () => {
  it('extracts audio attachments from metadata when attachments is empty', () => {
    const raw = {
      id: 'm1',
      conversationId: 'c1',
      accountId: 'a1',
      platform: 'whatsapp' as const,
      message: '',
      direction: 'incoming' as const,
      createdAt: '2026-03-12T12:00:00Z',
      metadata: {
        messageType: 'audioMessage',
        mediaUrl: '/v1/whatsapp/media/123',
      },
    };
    const norm = normalizeMessage(raw);
    expect(norm.attachments).toHaveLength(1);
    expect(norm.attachments?.[0]).toEqual({ type: 'audio', url: '/v1/whatsapp/media/123' });
  });

  it('extracts image attachments from nested metadata objects', () => {
    const raw = {
      id: 'm2',
      conversationId: 'c1',
      accountId: 'a1',
      platform: 'whatsapp' as const,
      message: '',
      direction: 'incoming' as const,
      createdAt: '2026-03-12T12:00:00Z',
      metadata: {
        image: { url: '/v1/whatsapp/media/456' },
      },
    };
    const norm = normalizeMessage(raw);
    expect(norm.attachments?.[0]).toEqual({ type: 'image', url: '/v1/whatsapp/media/456' });
  });

  it('extracts voiceNote and audioMessage from metadata fields', () => {
    const rawVoice = {
      id: 'm-voice',
      conversationId: 'c1',
      accountId: 'a1',
      platform: 'whatsapp' as const,
      message: '',
      direction: 'outgoing' as const,
      createdAt: '2026-03-12T12:00:00Z',
      metadata: {
        voiceNote: { mediaUrl: 'https://s3.amazonaws.com/audio1.ogg' },
      },
    };
    const normVoice = normalizeMessage(rawVoice);
    expect(normVoice.attachments).toHaveLength(1);
    expect(normVoice.attachments?.[0]).toEqual({ type: 'audio', url: 'https://s3.amazonaws.com/audio1.ogg' });
  });

  it('normalizes pre-existing attachment objects with mediaUrl and voice_note types', () => {
    const rawExisting = {
      id: 'm-existing',
      conversationId: 'c1',
      accountId: 'a1',
      platform: 'whatsapp' as const,
      message: '',
      direction: 'outgoing' as const,
      createdAt: '2026-03-12T12:00:00Z',
      attachments: [
        { type: 'voice_note', mediaUrl: 'https://s3.amazonaws.com/audio2.ogg' } as unknown as Attachment,
      ],
    };
    const normExisting = normalizeMessage(rawExisting);
    expect(normExisting.attachments).toHaveLength(1);
    expect(normExisting.attachments?.[0].type).toBe('audio');
    expect(normExisting.attachments?.[0].url).toBe('https://s3.amazonaws.com/audio2.ogg');
  });
});

describe('isCallEvent', () => {
  it('true only for kind === "call"', () => {
    expect(isCallEvent({ kind: 'call' })).toBe(true);
    expect(isCallEvent({ kind: 'other' })).toBe(false);
    expect(isCallEvent({ kind: 42 })).toBe(false);
    expect(isCallEvent(undefined)).toBe(false);
  });
});

describe('getQuotedMessageId', () => {
  it('returns the id only when a non-empty string', () => {
    expect(getQuotedMessageId({ quotedMessageId: 'm1' })).toBe('m1');
    expect(getQuotedMessageId({ quotedMessageId: '' })).toBeUndefined();
    expect(getQuotedMessageId({ quotedMessageId: 7 })).toBeUndefined();
    expect(getQuotedMessageId(undefined)).toBeUndefined();
  });
});

describe('getQuickReplyBadge', () => {
  it('undefined when no payload field is present', () => {
    expect(getQuickReplyBadge({})).toBeUndefined();
    expect(getQuickReplyBadge({ postbackTitle: 'Title only' })).toBeUndefined();
  });

  it('prefers the postback title over raw payloads', () => {
    expect(
      getQuickReplyBadge({ postbackPayload: 'PAYLOAD', postbackTitle: 'Get started' }),
    ).toBe('Get started');
  });

  it('falls back to quick-reply payload, then callback data', () => {
    expect(getQuickReplyBadge({ quickReplyPayload: 'QR' })).toBe('QR');
    expect(getQuickReplyBadge({ callbackData: 'cb_1' })).toBe('cb_1');
  });
});

describe('getWaInteractive', () => {
  it('undefined when missing or not an object', () => {
    expect(getWaInteractive(undefined)).toBeUndefined();
    expect(getWaInteractive({ waInteractive: 'nope' })).toBeUndefined();
  });

  it('parses the six known kinds', () => {
    expect(getWaInteractive({ waInteractive: { kind: 'buttons', buttons: ['A', 'B'] } })).toEqual({
      kind: 'buttons',
      buttons: ['A', 'B'],
    });
    expect(
      getWaInteractive({
        waInteractive: { kind: 'list', button: 'Menu', rows: [{ title: 'Row', description: 'D' }] },
      }),
    ).toEqual({ kind: 'list', button: 'Menu', rows: [{ title: 'Row', description: 'D' }] });
    expect(
      getWaInteractive({ waInteractive: { kind: 'cta_url', label: 'Open', url: 'https://x.com' } }),
    ).toEqual({ kind: 'cta_url', label: 'Open', url: 'https://x.com' });
    expect(getWaInteractive({ waInteractive: { kind: 'flow', label: 'Book' } })).toEqual({
      kind: 'flow',
      label: 'Book',
    });
    expect(getWaInteractive({ waInteractive: { kind: 'location_request' } })).toEqual({
      kind: 'location_request',
    });
    expect(getWaInteractive({ waInteractive: { kind: 'voice_call' } })).toEqual({
      kind: 'voice_call',
      label: 'Call Now',
    });
  });

  it('drops malformed entries instead of crashing', () => {
    // Non-string buttons filtered, non-record rows dropped.
    expect(
      getWaInteractive({ waInteractive: { kind: 'buttons', buttons: ['A', 2, null] } }),
    ).toEqual({ kind: 'buttons', buttons: ['A'] });
    expect(
      getWaInteractive({ waInteractive: { kind: 'list', button: 'Menu', rows: [null, { title: 'Ok' }] } }),
    ).toEqual({ kind: 'list', button: 'Menu', rows: [{ title: 'Ok' }] });
  });

  it('returns kind "unknown" for unrecognized or incomplete shapes', () => {
    expect(getWaInteractive({ waInteractive: { kind: 'carousel' } })).toEqual({ kind: 'unknown' });
    expect(getWaInteractive({ waInteractive: { kind: 'cta_url', label: 'No url' } })).toEqual({
      kind: 'unknown',
    });
    expect(getWaInteractive({ waInteractive: { kind: 'buttons', buttons: [] } })).toEqual({
      kind: 'unknown',
    });
  });
});

describe('getLocation', () => {
  it('requires numeric lat/lng', () => {
    expect(getLocation({ location: { latitude: 1.2, longitude: 3.4 } })).toEqual({
      latitude: 1.2,
      longitude: 3.4,
    });
    expect(getLocation({ location: { latitude: '1.2', longitude: 3.4 } })).toBeUndefined();
    expect(getLocation({})).toBeUndefined();
  });

  it('carries optional name and address when strings', () => {
    expect(
      getLocation({ location: { latitude: 1, longitude: 2, name: 'HQ', address: 'Main St 1' } }),
    ).toEqual({ latitude: 1, longitude: 2, name: 'HQ', address: 'Main St 1' });
  });
});

describe('getContacts', () => {
  it('empty array when missing or malformed', () => {
    expect(getContacts(undefined)).toEqual([]);
    expect(getContacts({ contacts: 'nope' })).toEqual([]);
    expect(getContacts({ contacts: [null, 5] })).toEqual([]);
  });

  it('extracts formatted name and first valid phone', () => {
    expect(
      getContacts({
        contacts: [
          { name: { formatted_name: 'Jane Doe' }, phones: [{}, { phone: '+34 600 000 000' }] },
          { phones: [] },
        ],
      }),
    ).toEqual([{ formattedName: 'Jane Doe', phone: '+34 600 000 000' }, { formattedName: 'Contact' }]);
  });
});
