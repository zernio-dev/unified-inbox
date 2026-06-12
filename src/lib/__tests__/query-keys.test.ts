import { describe, expect, it } from 'vitest';
import { queryKeys } from '../query-keys';

describe('queryKeys', () => {
  it('static keys', () => {
    expect(queryKeys.accounts).toEqual(['accounts']);
    expect(queryKeys.settings).toEqual(['settings']);
  });

  it('parameterized keys embed their arguments', () => {
    expect(queryKeys.conversations('whatsapp', 'acc1', 'newest')).toEqual([
      'conversations',
      'whatsapp',
      'acc1',
      'newest',
    ]);
    expect(queryKeys.messages('conv1', 'acc1')).toEqual(['messages', 'conv1', 'acc1']);
    expect(queryKeys.templates('acc1')).toEqual(['whatsapp-templates', 'acc1']);
    expect(queryKeys.flows('acc1')).toEqual(['whatsapp-flows', 'acc1']);
  });
});
