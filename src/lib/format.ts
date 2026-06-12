import type { Message } from './types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Midnight-local for calendar-day comparisons. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const calendarDayDiff = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();

  if (diffMs < MINUTE_MS) return 'now';
  if (diffMs < HOUR_MS) return `${Math.round(diffMs / MINUTE_MS)}m`;
  if (diffMs < DAY_MS) return `${Math.round(diffMs / HOUR_MS)}h`;

  const dayDiff = calendarDayDiff(then, now);
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff < 7) return `${dayDiff}d`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function messagePreviewText(m: Pick<Message, 'message' | 'attachments'>): string {
  const text = (m.message ?? '').trim();
  if (text) return text;
  const first = m.attachments?.[0];
  if (first) {
    if (first.type === 'audio') return '🎤 Voice message';
    if (first.type === 'image') return '📷 Photo';
    if (first.type === 'video') return '🎥 Video';
    return '📎 Attachment';
  }
  return 'Message';
}

/**
 * Best-effort phone formatter: '+' + digits, space after a 2-digit country
 * code guess, then groups of 3. Deterministic, no external lib.
 * '+34666777888' -> '+34 666 777 888'
 */
export function formatPhonePretty(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return input;
  const cc = digits.slice(0, 2);
  const rest = digits.slice(2);
  const groups = rest.match(/.{1,3}/g) ?? [];
  return ['+' + cc, ...groups].join(' ').trim();
}

export function dateSeparatorLabel(date: Date, now: Date = new Date()): string {
  const dayDiff = calendarDayDiff(date, now);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  const differentYear = date.getFullYear() !== now.getFullYear();
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(differentYear ? { year: 'numeric' } : {}),
  });
}

export function initials(name?: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}
