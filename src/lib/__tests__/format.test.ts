import { describe, expect, it } from 'vitest';
import {
  dateSeparatorLabel,
  formatPhonePretty,
  formatRelativeTime,
  initials,
  messagePreviewText,
} from '../format';

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-12T12:00:00');

  it('30 seconds ago -> now', () => {
    expect(formatRelativeTime(new Date('2026-03-12T11:59:30').toISOString(), now)).toBe('now');
  });

  it('just under a minute -> now', () => {
    expect(formatRelativeTime(new Date('2026-03-12T11:59:00.001').toISOString(), now)).toBe('now');
  });

  it('5 minutes ago -> 5m', () => {
    expect(formatRelativeTime(new Date('2026-03-12T11:55:00').toISOString(), now)).toBe('5m');
  });

  it('3 hours ago -> 3h', () => {
    expect(formatRelativeTime(new Date('2026-03-12T09:00:00').toISOString(), now)).toBe('3h');
  });

  it('previous calendar day beyond 24h -> yesterday', () => {
    // 26h ago, crossing midnight into the prior calendar day
    expect(formatRelativeTime(new Date('2026-03-11T10:00:00').toISOString(), now)).toBe('yesterday');
  });

  it('4 calendar days ago -> 4d', () => {
    expect(formatRelativeTime(new Date('2026-03-08T09:00:00').toISOString(), now)).toBe('4d');
  });

  it('more than 7 days ago -> short month format', () => {
    expect(formatRelativeTime(new Date('2026-03-01T09:00:00').toISOString(), now)).toBe('Mar 1');
  });
});

describe('messagePreviewText', () => {
  it('non-empty trimmed text wins over attachments', () => {
    expect(messagePreviewText({ message: '  hello  ', attachments: [{ type: 'image' }] })).toBe('hello');
  });

  it('audio attachment -> voice message', () => {
    expect(messagePreviewText({ message: '', attachments: [{ type: 'audio' }] })).toBe('🎤 Voice message');
  });

  it('image attachment -> photo', () => {
    expect(messagePreviewText({ message: '   ', attachments: [{ type: 'image' }] })).toBe('📷 Photo');
  });

  it('video attachment -> video', () => {
    expect(messagePreviewText({ message: '', attachments: [{ type: 'video' }] })).toBe('🎥 Video');
  });

  it('other attachment -> generic attachment', () => {
    expect(messagePreviewText({ message: '', attachments: [{ type: 'document' }] })).toBe('📎 Attachment');
  });

  it('only first attachment matters', () => {
    expect(messagePreviewText({ message: '', attachments: [{ type: 'audio' }, { type: 'image' }] })).toBe(
      '🎤 Voice message'
    );
  });

  it('no text and no attachments -> Message', () => {
    expect(messagePreviewText({ message: '', attachments: [] })).toBe('Message');
    expect(messagePreviewText({ message: '' })).toBe('Message');
  });
});

describe('formatPhonePretty', () => {
  it('formats +34666777888', () => {
    expect(formatPhonePretty('+34666777888')).toBe('+34 666 777 888');
  });

  it('strips non-digits and re-normalizes', () => {
    expect(formatPhonePretty('34 666-777-888')).toBe('+34 666 777 888');
  });

  it('is deterministic', () => {
    expect(formatPhonePretty('+34666777888')).toBe(formatPhonePretty('+34666777888'));
  });

  it('formats NANP numbers as +1 XXX XXX XXXX', () => {
    expect(formatPhonePretty('+14155552671')).toBe('+1 415 555 2671');
    expect(formatPhonePretty('14155552671')).toBe('+1 415 555 2671');
    expect(formatPhonePretty('1 (415) 555-2671')).toBe('+1 415 555 2671');
  });

  it('keeps the generic 2-digit-cc grouping for non-11-digit numbers starting with 1', () => {
    expect(formatPhonePretty('123456789012')).toBe('+12 345 678 901 2');
  });
});

describe('dateSeparatorLabel', () => {
  const now = new Date('2026-03-12T12:00:00');

  it('same calendar day -> Today', () => {
    expect(dateSeparatorLabel(new Date('2026-03-12T00:30:00'), now)).toBe('Today');
  });

  it('previous calendar day -> Yesterday', () => {
    expect(dateSeparatorLabel(new Date('2026-03-11T23:59:00'), now)).toBe('Yesterday');
  });

  it('same year -> weekday + month + day, no year', () => {
    // 2026-03-05 is a Thursday
    expect(dateSeparatorLabel(new Date('2026-03-05T10:00:00'), now)).toBe('Thu, Mar 5');
  });

  it('different year -> includes year', () => {
    // 2025-12-31 is a Wednesday
    expect(dateSeparatorLabel(new Date('2025-12-31T10:00:00'), now)).toBe('Wed, Dec 31, 2025');
  });
});

describe('initials', () => {
  it('first + last word initials, uppercase', () => {
    expect(initials('john doe')).toBe('JD');
  });

  it('middle words ignored', () => {
    expect(initials('John Fitzgerald Kennedy')).toBe('JK');
  });

  it('single word -> single initial', () => {
    expect(initials('madonna')).toBe('M');
  });

  it('empty / undefined -> ?', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
    expect(initials(undefined)).toBe('?');
  });
});
