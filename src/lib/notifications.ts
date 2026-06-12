import { conversationKey } from './merge';
import type { Conversation } from './types';

/**
 * Browser-notification logic for new inbound messages. The pure diff lives
 * here (testable, no DOM); the conversation-list pane wires it to the polled
 * list, the Notification API and localStorage prefs.
 */

export interface ConversationSnapshot {
  updatedTime: string;
  lastMessage: string;
  unreadCount: number;
}

const PREF_KEY = 'unified-inbox-notifications';
const SOUND_KEY = 'unified-inbox-notification-sound';

/** Snapshot of the polled list, keyed by account-scoped conversation key. */
export function buildSnapshot(conversations: Conversation[]): Map<string, ConversationSnapshot> {
  const map = new Map<string, ConversationSnapshot>();
  for (const c of conversations) {
    map.set(conversationKey(c), {
      updatedTime: c.updatedTime,
      lastMessage: c.lastMessage,
      unreadCount: c.unreadCount ?? 0,
    });
  }
  return map;
}

/**
 * Conversations worth a browser notification, given the previous poll's
 * snapshot. Pure: the caller owns the snapshot ref and the Notification API.
 *
 * - `prev === null` (first poll after load or a filter switch) is always
 *   silent: it only initializes the baseline, never fires a storm.
 * - An existing conversation notifies only when its `updatedTime` advanced AND
 *   its unread count grew (inbound activity; our own sends bump updatedTime
 *   without growing unread).
 * - A conversation absent from the snapshot is brand new and notifies when it
 *   arrives with unread messages.
 * - The selected conversation is suppressed while the page is visible (the
 *   user is already looking at it).
 */
export function diffForNotifications({
  prev,
  conversations,
  selectedKey,
  pageVisible,
}: {
  prev: Map<string, ConversationSnapshot> | null;
  conversations: Conversation[];
  selectedKey: string | null;
  pageVisible: boolean;
}): Conversation[] {
  if (prev === null) return [];
  const out: Conversation[] = [];
  for (const c of conversations) {
    const key = conversationKey(c);
    if (key === selectedKey && pageVisible) continue;
    const unread = c.unreadCount ?? 0;
    const snap = prev.get(key);
    if (snap) {
      const advanced = new Date(c.updatedTime).getTime() > new Date(snap.updatedTime).getTime();
      if (advanced && unread > (snap.unreadCount ?? 0)) out.push(c);
    } else if (unread > 0) {
      out.push(c);
    }
  }
  return out;
}

export function getNotificationPref(): 'on' | 'off' {
  if (typeof window === 'undefined') return 'off';
  try {
    return window.localStorage.getItem(PREF_KEY) === 'on' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export function setNotificationPref(pref: 'on' | 'off'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREF_KEY, pref);
  } catch {
    // localStorage can throw (private mode / quota); the pref just won't stick.
  }
}

export function getSoundPref(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setSoundPref(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'true' : 'false');
  } catch {
    // Same as setNotificationPref: best-effort.
  }
}

/**
 * Two-note WebAudio chime (A5 then D6), generated programmatically so the app
 * ships no audio assets. Best-effort: never throws, never blocks.
 */
export function playChime(): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.AudioContext !== 'function') return;
    const ctx = new window.AudioContext();
    const note = ({ freq, start, duration }: { freq: number; start: number; duration: number }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Ramp the gain in and out so the oscillator doesn't click on start/stop.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };
    const t = ctx.currentTime;
    note({ freq: 880, start: t, duration: 0.12 });
    note({ freq: 1174.66, start: t + 0.13, duration: 0.12 });
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Audio is a nicety; a failed chime must never break the notification path.
  }
}
