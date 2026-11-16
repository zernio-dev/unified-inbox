import { describe, expect, it } from 'vitest';
import {
  inboundDtosFromWebhook,
  isEchoEvent,
  isUsableText,
  pickText,
  unwrapEvent,
} from '../server/agentInbound';

describe('inboundDtosFromWebhook', () => {
  it('forwards inbound text with event_id', () => {
    expect(
      inboundDtosFromWebhook({
        data: {
          phone: '5551999999999',
          body: 'Tem iPhone 13?',
          id: 'evt-1',
          conversationId: '5551999999999@c.us',
        },
      }),
    ).toEqual([
      {
        phone: '5551999999999',
        text: 'Tem iPhone 13?',
        event_id: 'evt-1',
        conversation_id: '5551999999999@c.us',
      },
    ]);
  });

  it('skips from-me / outgoing echo', () => {
    expect(inboundDtosFromWebhook({ data: { phone: '5551', body: 'oi', fromMe: true, id: 'e1' } })).toEqual([]);
    expect(
      inboundDtosFromWebhook({ direction: 'outgoing', data: { phone: '5551', text: 'oi', id: 'e2' } }),
    ).toEqual([]);
    expect(isEchoEvent({ from_me: true })).toBe(true);
  });

  it('skips sticker/audio placeholders and empty text', () => {
    expect(inboundDtosFromWebhook({ data: { phone: '5551', body: '[sticker]' } })).toEqual([]);
    expect(inboundDtosFromWebhook({ data: { phone: '5551', body: '   ' } })).toEqual([]);
    expect(isUsableText('[audio]')).toBe(false);
  });

  it('reads Baileys-style conversation text', () => {
    const data = unwrapEvent({
      data: { from: '5551888888888', message: { conversation: 'quero o 13' }, key: { id: 'wamid.1' } },
    });
    expect(pickText(data)).toBe('quero o 13');
    expect(
      inboundDtosFromWebhook({
        data: { from: '5551888888888', message: { conversation: 'quero o 13' }, key: { id: 'wamid.1' } },
      }),
    ).toEqual([{ phone: '5551888888888', text: 'quero o 13', event_id: 'wamid.1' }]);
  });
});
