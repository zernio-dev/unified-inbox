import { describe, expect, it } from 'vitest';
import { buildSnapshot, diffForNotifications } from '../notifications';
import type { Conversation } from '../types';

function conv(overrides: Partial<Conversation> & { id: string }): Conversation {
  return {
    accountId: 'acc1',
    platform: 'whatsapp',
    lastMessage: 'hello',
    updatedTime: '2026-06-12T10:00:00.000Z',
    status: 'active',
    unreadCount: 0,
    ...overrides,
  };
}

const LATER = '2026-06-12T10:05:00.000Z';

describe('diffForNotifications', () => {
  it('returns nothing on the first poll (prev === null)', () => {
    const out = diffForNotifications({
      prev: null,
      conversations: [conv({ id: 'c1', unreadCount: 5 })],
      selectedKey: null,
      pageVisible: true,
    });
    expect(out).toEqual([]);
  });

  it('notifies when updatedTime advanced and unread grew', () => {
    const prev = buildSnapshot([conv({ id: 'c1', unreadCount: 1 })]);
    const out = diffForNotifications({
      prev,
      conversations: [conv({ id: 'c1', unreadCount: 2, updatedTime: LATER })],
      selectedKey: null,
      pageVisible: true,
    });
    expect(out.map((c) => c.id)).toEqual(['c1']);
  });

  it('does not notify when updatedTime advanced without unread growth (own send)', () => {
    const prev = buildSnapshot([conv({ id: 'c1', unreadCount: 1 })]);
    const out = diffForNotifications({
      prev,
      conversations: [conv({ id: 'c1', unreadCount: 1, updatedTime: LATER })],
      selectedKey: null,
      pageVisible: true,
    });
    expect(out).toEqual([]);
  });

  it('does not notify when unread grew but updatedTime did not advance', () => {
    const prev = buildSnapshot([conv({ id: 'c1', unreadCount: 1 })]);
    const out = diffForNotifications({
      prev,
      conversations: [conv({ id: 'c1', unreadCount: 3 })],
      selectedKey: null,
      pageVisible: true,
    });
    expect(out).toEqual([]);
  });

  it('suppresses the selected conversation while the page is visible', () => {
    const prev = buildSnapshot([conv({ id: 'c1', unreadCount: 0 })]);
    const out = diffForNotifications({
      prev,
      conversations: [conv({ id: 'c1', unreadCount: 1, updatedTime: LATER })],
      selectedKey: 'acc1-c1',
      pageVisible: true,
    });
    expect(out).toEqual([]);
  });

  it('notifies for the selected conversation when the page is hidden', () => {
    const prev = buildSnapshot([conv({ id: 'c1', unreadCount: 0 })]);
    const out = diffForNotifications({
      prev,
      conversations: [conv({ id: 'c1', unreadCount: 1, updatedTime: LATER })],
      selectedKey: 'acc1-c1',
      pageVisible: false,
    });
    expect(out.map((c) => c.id)).toEqual(['c1']);
  });

  it('notifies for a brand-new conversation with unread messages', () => {
    const prev = buildSnapshot([conv({ id: 'c1' })]);
    const out = diffForNotifications({
      prev,
      conversations: [conv({ id: 'c1' }), conv({ id: 'c2', unreadCount: 2 })],
      selectedKey: null,
      pageVisible: true,
    });
    expect(out.map((c) => c.id)).toEqual(['c2']);
  });

  it('stays silent for a brand-new conversation without unread messages', () => {
    const prev = buildSnapshot([conv({ id: 'c1' })]);
    const out = diffForNotifications({
      prev,
      conversations: [conv({ id: 'c1' }), conv({ id: 'c2', unreadCount: 0 })],
      selectedKey: null,
      pageVisible: true,
    });
    expect(out).toEqual([]);
  });

  it('keys conversations per account: same id on another account is new', () => {
    const prev = buildSnapshot([conv({ id: 'c1', accountId: 'acc1' })]);
    const out = diffForNotifications({
      prev,
      conversations: [conv({ id: 'c1', accountId: 'acc2', unreadCount: 1 })],
      selectedKey: null,
      pageVisible: true,
    });
    expect(out.map((c) => c.accountId)).toEqual(['acc2']);
  });
});

describe('buildSnapshot', () => {
  it('round-trips: diffing a list against its own snapshot is silent', () => {
    const conversations = [
      conv({ id: 'c1', unreadCount: 3 }),
      conv({ id: 'c2', accountId: 'acc2', unreadCount: 0 }),
    ];
    const out = diffForNotifications({
      prev: buildSnapshot(conversations),
      conversations,
      selectedKey: null,
      pageVisible: true,
    });
    expect(out).toEqual([]);
  });

  it('captures updatedTime, lastMessage and a defaulted unreadCount', () => {
    const snap = buildSnapshot([conv({ id: 'c1', unreadCount: undefined, lastMessage: 'yo' })]);
    expect(snap.get('acc1-c1')).toEqual({
      updatedTime: '2026-06-12T10:00:00.000Z',
      lastMessage: 'yo',
      unreadCount: 0,
    });
  });
});
