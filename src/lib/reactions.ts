import type { MessageReaction } from './types';

/**
 * Next reactions state after the user picks `emoji` on a message.
 *
 * Semantics (WhatsApp/Telegram 1:1 threads): at most one reaction per party.
 * Picking the emoji we already set removes it (toggle); picking a different
 * one replaces our previous reaction. Other parties' reactions are preserved.
 */
export function toggleReaction({
  reactions,
  emoji,
}: {
  reactions: MessageReaction[] | undefined;
  emoji: string;
}): { next: MessageReaction[]; removed: boolean } {
  const all = reactions ?? [];
  const mine = all.find((r) => r.fromMe);
  const others = all.filter((r) => !r.fromMe);
  const removed = mine?.emoji === emoji;
  return {
    next: removed ? others : [...others, { emoji, fromMe: true }],
    removed,
  };
}
