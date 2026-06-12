import { describe, expect, it } from 'vitest';
import { toggleReaction } from '../reactions';
import type { MessageReaction } from '../types';

const theirs: MessageReaction = { emoji: '😂', fromMe: false };

describe('toggleReaction', () => {
  it('adds my reaction when I have none', () => {
    expect(toggleReaction({ reactions: undefined, emoji: '👍' })).toEqual({
      next: [{ emoji: '👍', fromMe: true }],
      removed: false,
    });
    expect(toggleReaction({ reactions: [], emoji: '👍' })).toEqual({
      next: [{ emoji: '👍', fromMe: true }],
      removed: false,
    });
  });

  it('removes my reaction when picking the same emoji again', () => {
    const { next, removed } = toggleReaction({
      reactions: [{ emoji: '👍', fromMe: true }],
      emoji: '👍',
    });
    expect(removed).toBe(true);
    expect(next).toEqual([]);
  });

  it('replaces my reaction when picking a different emoji', () => {
    const { next, removed } = toggleReaction({
      reactions: [{ emoji: '👍', fromMe: true }],
      emoji: '❤️',
    });
    expect(removed).toBe(false);
    expect(next).toEqual([{ emoji: '❤️', fromMe: true }]);
  });

  it('preserves the other party reactions on add, replace and remove', () => {
    const add = toggleReaction({ reactions: [theirs], emoji: '👍' });
    expect(add.next).toEqual([theirs, { emoji: '👍', fromMe: true }]);

    const replace = toggleReaction({
      reactions: [theirs, { emoji: '👍', fromMe: true }],
      emoji: '❤️',
    });
    expect(replace.next).toEqual([theirs, { emoji: '❤️', fromMe: true }]);

    const remove = toggleReaction({
      reactions: [theirs, { emoji: '❤️', fromMe: true }],
      emoji: '❤️',
    });
    expect(remove.removed).toBe(true);
    expect(remove.next).toEqual([theirs]);
  });

  it('does not mutate the input array', () => {
    const input = [theirs, { emoji: '👍', fromMe: true }];
    toggleReaction({ reactions: input, emoji: '❤️' });
    expect(input).toEqual([theirs, { emoji: '👍', fromMe: true }]);
  });
});
