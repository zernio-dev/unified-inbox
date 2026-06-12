import { describe, expect, it } from 'vitest';
import {
  isOptimisticId,
  isWhatsAppOutside24h,
  makeOptimisticMessage,
  suppressDeliveredStubs,
} from '../optimistic';
import type { Message } from '../types';

const NOW = new Date('2026-03-12T12:00:00Z').getTime();

function msg(overrides: Partial<Message>): Message {
  return {
    id: 'm1',
    conversationId: 'c1',
    accountId: 'a1',
    platform: 'whatsapp',
    message: 'hello',
    direction: 'incoming',
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('isWhatsAppOutside24h', () => {
  it('false for non-whatsapp platforms', () => {
    expect(
      isWhatsAppOutside24h({ platform: 'telegram', messages: [], messagesLoading: false, now: NOW })
    ).toBe(false);
    expect(
      isWhatsAppOutside24h({ platform: undefined, messages: [], messagesLoading: false, now: NOW })
    ).toBe(false);
  });

  it('false while messages are loading', () => {
    expect(
      isWhatsAppOutside24h({ platform: 'whatsapp', messages: [], messagesLoading: true, now: NOW })
    ).toBe(false);
  });

  it('true when there is no incoming message at all', () => {
    const messages = [msg({ direction: 'outgoing' })];
    expect(
      isWhatsAppOutside24h({ platform: 'whatsapp', messages, messagesLoading: false, now: NOW })
    ).toBe(true);
    expect(
      isWhatsAppOutside24h({ platform: 'whatsapp', messages: [], messagesLoading: false, now: NOW })
    ).toBe(true);
  });

  it('false when last incoming message is 23h old', () => {
    const messages = [
      msg({ direction: 'incoming', createdAt: new Date(NOW - 23 * 60 * 60 * 1000).toISOString() }),
    ];
    expect(
      isWhatsAppOutside24h({ platform: 'whatsapp', messages, messagesLoading: false, now: NOW })
    ).toBe(false);
  });

  it('true when last incoming message is 25h old', () => {
    const messages = [
      msg({ direction: 'incoming', createdAt: new Date(NOW - 25 * 60 * 60 * 1000).toISOString() }),
      msg({ direction: 'outgoing', createdAt: new Date(NOW - 60 * 1000).toISOString() }),
    ];
    expect(
      isWhatsAppOutside24h({ platform: 'whatsapp', messages, messagesLoading: false, now: NOW })
    ).toBe(true);
  });

  it('uses the LAST incoming message, not the first', () => {
    const messages = [
      msg({ direction: 'incoming', createdAt: new Date(NOW - 48 * 60 * 60 * 1000).toISOString() }),
      msg({ direction: 'incoming', createdAt: new Date(NOW - 60 * 60 * 1000).toISOString() }),
    ];
    expect(
      isWhatsAppOutside24h({ platform: 'whatsapp', messages, messagesLoading: false, now: NOW })
    ).toBe(false);
  });
});

describe('suppressDeliveredStubs', () => {
  const pendingStub = msg({
    id: 'temp-1',
    direction: 'outgoing',
    message: 'hi there',
    createdAt: new Date(NOW).toISOString(),
  });

  it('suppresses the stub when a matching server outgoing message exists', () => {
    const server = [
      msg({
        id: 'srv-1',
        direction: 'outgoing',
        message: '  hi there  ', // trimmed match
        createdAt: new Date(NOW + 30_000).toISOString(),
      }),
    ];
    expect(suppressDeliveredStubs([pendingStub], server)).toEqual([]);
  });

  it('keeps the stub when the server text differs', () => {
    const server = [
      msg({
        id: 'srv-1',
        direction: 'outgoing',
        message: 'different text',
        createdAt: new Date(NOW + 30_000).toISOString(),
      }),
    ];
    expect(suppressDeliveredStubs([pendingStub], server)).toEqual([pendingStub]);
  });

  it('keeps the stub when timestamps are more than 2 minutes apart', () => {
    const server = [
      msg({
        id: 'srv-1',
        direction: 'outgoing',
        message: 'hi there',
        createdAt: new Date(NOW + 121_000).toISOString(),
      }),
    ];
    expect(suppressDeliveredStubs([pendingStub], server)).toEqual([pendingStub]);
  });

  it('never matches against incoming server messages', () => {
    const server = [
      msg({
        id: 'srv-1',
        direction: 'incoming',
        message: 'hi there',
        createdAt: new Date(NOW).toISOString(),
      }),
    ];
    expect(suppressDeliveredStubs([pendingStub], server)).toEqual([pendingStub]);
  });
});

describe('isOptimisticId', () => {
  it('true for temp- and new_ prefixes', () => {
    expect(isOptimisticId('temp-123')).toBe(true);
    expect(isOptimisticId('new_abc')).toBe(true);
  });

  it('false otherwise', () => {
    expect(isOptimisticId('mid_temp-123')).toBe(false);
    expect(isOptimisticId('64f0c0ffee')).toBe(false);
  });
});

describe('makeOptimisticMessage', () => {
  const conversation = { id: 'c1', accountId: 'a1', platform: 'whatsapp' as const };

  it('builds an outgoing stub scoped to the conversation with an optimistic id', () => {
    const stub = makeOptimisticMessage({ conversation, overrides: { message: 'hi' } });
    expect(isOptimisticId(stub.id)).toBe(true);
    expect(stub).toMatchObject({
      conversationId: 'c1',
      accountId: 'a1',
      platform: 'whatsapp',
      message: 'hi',
      direction: 'outgoing',
      deliveryStatus: 'sent',
    });
    expect(Number.isNaN(new Date(stub.createdAt).getTime())).toBe(false);
  });

  it('lets overrides win (e.g. quoted-reply metadata)', () => {
    const stub = makeOptimisticMessage({
      conversation,
      overrides: { message: 'hi', metadata: { quotedMessageId: 'm9' } },
    });
    expect(stub.metadata).toEqual({ quotedMessageId: 'm9' });
  });
});
