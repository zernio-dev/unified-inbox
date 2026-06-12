import { describe, expect, it } from 'vitest';
import { searchMessageIds } from '../search';
import type { Message } from '../types';

function msg(overrides: Partial<Message> & { id: string }): Message {
  return {
    conversationId: 'conv1',
    accountId: 'acc1',
    platform: 'whatsapp',
    message: '',
    direction: 'incoming',
    createdAt: '2026-06-12T10:00:00.000Z',
    ...overrides,
  };
}

describe('searchMessageIds', () => {
  it('matches message text case-insensitively', () => {
    const out = searchMessageIds({
      messages: [msg({ id: 'm1', message: 'Hello WORLD' }), msg({ id: 'm2', message: 'nope' })],
      query: 'world',
    });
    expect(out).toEqual(['m1']);
  });

  it('matches attachment names case-insensitively', () => {
    const out = searchMessageIds({
      messages: [
        msg({ id: 'm1', attachments: [{ type: 'file', name: 'Invoice-2026.PDF' }] }),
        msg({ id: 'm2', attachments: [{ type: 'image' }] }),
      ],
      query: 'invoice',
    });
    expect(out).toEqual(['m1']);
  });

  it('skips deleted messages and optimistic stubs', () => {
    const out = searchMessageIds({
      messages: [
        msg({ id: 'm1', message: 'hello', isDeleted: true }),
        msg({ id: 'temp-123', message: 'hello there' }),
        msg({ id: 'new_456', message: 'hello again' }),
        msg({ id: 'm2', message: 'hello back' }),
      ],
      query: 'hello',
    });
    expect(out).toEqual(['m2']);
  });

  it('returns nothing for queries shorter than 2 trimmed chars', () => {
    const messages = [msg({ id: 'm1', message: 'a b c' })];
    expect(searchMessageIds({ messages, query: '' })).toEqual([]);
    expect(searchMessageIds({ messages, query: 'a' })).toEqual([]);
    expect(searchMessageIds({ messages, query: '  b  ' })).toEqual([]);
  });

  it('returns ids in chronological (input) order', () => {
    const out = searchMessageIds({
      messages: [
        msg({ id: 'old', message: 'ping one' }),
        msg({ id: 'mid', message: 'no match' }),
        msg({ id: 'new', message: 'ping two' }),
      ],
      query: 'ping',
    });
    expect(out).toEqual(['old', 'new']);
  });
});
