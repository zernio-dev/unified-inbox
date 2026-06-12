import { describe, expect, it } from 'vitest';
import {
  conversationKey,
  mergeConversations,
  mergeMessages,
  reconcilePatches,
  resolveLoadMoreCursor,
} from '../merge';
import type { Conversation, Message } from '../types';

function conv(overrides: Partial<Conversation> & { id: string }): Conversation {
  return {
    accountId: 'acc1',
    platform: 'whatsapp',
    lastMessage: 'hello',
    updatedTime: '2026-06-12T10:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

function msg(overrides: Partial<Message> & { id: string }): Message {
  return {
    conversationId: 'conv1',
    accountId: 'acc1',
    platform: 'whatsapp',
    message: 'hi',
    direction: 'incoming',
    createdAt: '2026-06-12T10:00:00.000Z',
    ...overrides,
  };
}

const noFilters = { search: '', sortKey: 'date-desc' as const };

describe('conversationKey', () => {
  it('scopes by accountId with a default fallback', () => {
    expect(conversationKey(conv({ id: 'c1' }))).toBe('acc1-c1');
    expect(conversationKey(conv({ id: 'c1', accountId: '' }))).toBe('default-c1');
  });
});

describe('mergeConversations', () => {
  it('dedupes head over older, first wins', () => {
    const out = mergeConversations({
      head: [conv({ id: 'c1', lastMessage: 'from head' })],
      older: [conv({ id: 'c1', lastMessage: 'from older' }), conv({ id: 'c2' })],
      pending: [],
      patches: {},
      filters: noFilters,
    });
    expect(out).toHaveLength(2);
    expect(out.find((c) => c.id === 'c1')?.lastMessage).toBe('from head');
  });

  it('keeps same conversation id on different accounts distinct', () => {
    const out = mergeConversations({
      head: [conv({ id: 'c1', accountId: 'acc1' })],
      older: [conv({ id: 'c1', accountId: 'acc2' })],
      pending: [],
      patches: {},
      filters: noFilters,
    });
    expect(out).toHaveLength(2);
  });

  it('appends pending only when its account-id key is absent from server', () => {
    const out = mergeConversations({
      head: [conv({ id: 'c1', accountId: 'acc1', lastMessage: 'server copy' })],
      older: [],
      pending: [
        conv({ id: 'c1', accountId: 'acc1', lastMessage: 'optimistic dupe' }),
        conv({ id: 'c1', accountId: 'acc2', lastMessage: 'other account' }),
        conv({ id: 'c9', updatedTime: '2026-06-12T09:00:00.000Z' }),
      ],
      patches: {},
      filters: noFilters,
    });
    expect(out).toHaveLength(3);
    expect(out.find((c) => c.id === 'c1' && c.accountId === 'acc1')?.lastMessage).toBe(
      'server copy',
    );
    expect(out.some((c) => c.id === 'c1' && c.accountId === 'acc2')).toBe(true);
    expect(out.some((c) => c.id === 'c9')).toBe(true);
  });

  it('applies patches on top of server data', () => {
    const out = mergeConversations({
      head: [conv({ id: 'c1', unreadCount: 3 })],
      older: [],
      pending: [],
      patches: { c1: { unreadCount: 0, lastMessage: 'patched' } },
      filters: noFilters,
    });
    expect(out[0].unreadCount).toBe(0);
    expect(out[0].lastMessage).toBe('patched');
  });

  it('sorts by updatedTime desc and asc', () => {
    const a = conv({ id: 'a', updatedTime: '2026-06-12T08:00:00.000Z' });
    const b = conv({ id: 'b', updatedTime: '2026-06-12T12:00:00.000Z' });
    const desc = mergeConversations({
      head: [a, b],
      older: [],
      pending: [],
      patches: {},
      filters: { search: '', sortKey: 'date-desc' },
    });
    expect(desc.map((c) => c.id)).toEqual(['b', 'a']);
    const asc = mergeConversations({
      head: [a, b],
      older: [],
      pending: [],
      patches: {},
      filters: { search: '', sortKey: 'date-asc' },
    });
    expect(asc.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('unanswered sort puts unread first, then newest', () => {
    const out = mergeConversations({
      head: [
        conv({ id: 'read-new', unreadCount: 0, updatedTime: '2026-06-12T12:00:00.000Z' }),
        conv({ id: 'unread-old', unreadCount: 2, updatedTime: '2026-06-12T08:00:00.000Z' }),
        conv({ id: 'unread-new', unreadCount: 1, updatedTime: '2026-06-12T11:00:00.000Z' }),
      ],
      older: [],
      pending: [],
      patches: {},
      filters: { search: '', sortKey: 'unanswered' },
    });
    expect(out.map((c) => c.id)).toEqual(['unread-new', 'unread-old', 'read-new']);
  });

  it('search filters case-insensitively across name, username, lastMessage, participantId', () => {
    const head = [
      conv({ id: 'c1', participantName: 'Alice Johnson' }),
      conv({ id: 'c2', participantUsername: 'bob_the_builder' }),
      conv({ id: 'c3', lastMessage: 'see you at the ALICE concert' }),
      conv({ id: 'c4', participantId: '34611222333' }),
      conv({ id: 'c5', participantName: 'Nobody' }),
    ];
    const base = { older: [], pending: [], patches: {} };
    const byName = mergeConversations({
      head,
      ...base,
      filters: { search: 'alice', sortKey: 'date-desc' },
    });
    expect(byName.map((c) => c.id).sort()).toEqual(['c1', 'c3']);
    const byUsername = mergeConversations({
      head,
      ...base,
      filters: { search: 'BOB_', sortKey: 'date-desc' },
    });
    expect(byUsername.map((c) => c.id)).toEqual(['c2']);
    const byParticipantId = mergeConversations({
      head,
      ...base,
      filters: { search: '34611', sortKey: 'date-desc' },
    });
    expect(byParticipantId.map((c) => c.id)).toEqual(['c4']);
  });

  it('search matches a patched field value', () => {
    const out = mergeConversations({
      head: [conv({ id: 'c1', lastMessage: 'original' })],
      older: [],
      pending: [],
      patches: { c1: { lastMessage: 'optimistic reply' } },
      filters: { search: 'optimistic', sortKey: 'date-desc' },
    });
    expect(out).toHaveLength(1);
  });
});

describe('mergeMessages', () => {
  it('orders older -> head -> pending and dedupes by id, first wins', () => {
    const out = mergeMessages({
      head: [
        msg({ id: 'm2', message: 'head copy' }),
        msg({ id: 'm3' }),
      ],
      older: [msg({ id: 'm1' }), msg({ id: 'm2', message: 'older copy' })],
      pending: [
        msg({
          id: 'temp-1',
          direction: 'outgoing',
          message: 'unconfirmed',
          createdAt: '2026-06-12T11:00:00.000Z',
        }),
      ],
      patches: {},
    });
    expect(out.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'temp-1']);
    expect(out.find((m) => m.id === 'm2')?.message).toBe('older copy');
  });

  it('suppresses pending stubs the server has confirmed (same text within 2 min)', () => {
    const out = mergeMessages({
      head: [
        msg({
          id: 'server-1',
          direction: 'outgoing',
          message: 'on my way',
          createdAt: '2026-06-12T10:00:30.000Z',
        }),
      ],
      older: [],
      pending: [
        msg({
          id: 'temp-1',
          direction: 'outgoing',
          message: 'on my way',
          createdAt: '2026-06-12T10:00:00.000Z',
        }),
        msg({
          id: 'temp-2',
          direction: 'outgoing',
          message: 'different text',
          createdAt: '2026-06-12T10:00:00.000Z',
        }),
      ],
      patches: {},
    });
    expect(out.map((m) => m.id)).toEqual(['server-1', 'temp-2']);
  });

  it('does not suppress against incoming server messages with matching text', () => {
    const out = mergeMessages({
      head: [
        msg({
          id: 'in-1',
          direction: 'incoming',
          message: 'hello',
          createdAt: '2026-06-12T10:00:00.000Z',
        }),
      ],
      older: [],
      pending: [
        msg({
          id: 'temp-1',
          direction: 'outgoing',
          message: 'hello',
          createdAt: '2026-06-12T10:00:10.000Z',
        }),
      ],
      patches: {},
    });
    expect(out.map((m) => m.id)).toEqual(['in-1', 'temp-1']);
  });

  it('applies patches to server and pending messages', () => {
    const out = mergeMessages({
      head: [msg({ id: 'm1', deliveryStatus: 'sent' })],
      older: [],
      pending: [
        msg({
          id: 'temp-1',
          direction: 'outgoing',
          message: 'unique pending',
          createdAt: '2026-06-12T11:00:00.000Z',
        }),
      ],
      patches: { m1: { deliveryStatus: 'read' }, 'temp-1': { deliveryStatus: 'failed' } },
    });
    expect(out.find((m) => m.id === 'm1')?.deliveryStatus).toBe('read');
    expect(out.find((m) => m.id === 'temp-1')?.deliveryStatus).toBe('failed');
  });
});

describe('resolveLoadMoreCursor', () => {
  it('starts from the head cursor before older paging begins', () => {
    expect(resolveLoadMoreCursor({ olderInit: false, olderCursor: null, headCursor: 'h1' })).toBe(
      'h1',
    );
  });

  it('uses only the older chain once initialized, even when the head cursor moved', () => {
    // A head poll landing mid-pagination must not clobber the older chain.
    expect(
      resolveLoadMoreCursor({ olderInit: true, olderCursor: 'o2', headCursor: 'h-fresh' }),
    ).toBe('o2');
  });

  it('returns null at the end of the older chain regardless of the head cursor', () => {
    expect(
      resolveLoadMoreCursor({ olderInit: true, olderCursor: null, headCursor: 'h-fresh' }),
    ).toBeNull();
  });

  it('returns null when nothing has a cursor', () => {
    expect(resolveLoadMoreCursor({ olderInit: false, olderCursor: null, headCursor: null })).toBeNull();
  });
});

describe('reconcilePatches', () => {
  it('keeps a patch when the head row does not reflect it yet', () => {
    const patches = { m1: { deliveryStatus: 'read' } as Partial<Message> };
    const out = reconcilePatches({
      patches,
      head: [msg({ id: 'm1', deliveryStatus: 'sent' })],
    });
    expect(out).toBe(patches); // unchanged, same reference
  });

  it('drops a patch once every patched field deep-equals the head row', () => {
    const out = reconcilePatches({
      patches: { m1: { deliveryStatus: 'read' } as Partial<Message> },
      head: [msg({ id: 'm1', deliveryStatus: 'read' })],
    });
    expect(out).toEqual({});
  });

  it('requires ALL patched fields to be reflected', () => {
    const patches = {
      c1: { unreadCount: 0, lastMessage: 'optimistic' } as Partial<Conversation>,
    };
    const out = reconcilePatches({
      patches,
      head: [conv({ id: 'c1', unreadCount: 0, lastMessage: 'stale server copy' })],
    });
    expect(out).toBe(patches);
  });

  it('compares nested values structurally', () => {
    const reactions = [{ emoji: '👍', fromMe: true }];
    const out = reconcilePatches({
      patches: { m1: { reactions } as Partial<Message> },
      head: [msg({ id: 'm1', reactions: [{ emoji: '👍', fromMe: true }] })],
    });
    expect(out).toEqual({});
  });

  it('keeps patches for rows absent from the head', () => {
    const patches = { ghost: { lastMessage: 'bump' } as Partial<Conversation> };
    expect(reconcilePatches({ patches, head: [conv({ id: 'c1' })] })).toBe(patches);
  });

  it('returns the same reference when there are no patches', () => {
    const patches = {};
    expect(reconcilePatches<Message>({ patches, head: [msg({ id: 'm1' })] })).toBe(patches);
  });
});
