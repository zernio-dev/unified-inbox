import { describe, expect, it } from 'vitest';
import {
  buildTemplatePayload,
  extractTemplateVariableTokens,
  renderTemplatePreview,
  templateBodyText,
} from '../whatsapp/template-utils';
import type { TemplateComponent } from '../types';

const body = (text: string): TemplateComponent => ({ type: 'BODY', text });

describe('extractTemplateVariableTokens', () => {
  it('positional tokens in body', () => {
    expect(extractTemplateVariableTokens([body('Hi {{1}}, your code is {{2}}')])).toEqual([
      '{{1}}',
      '{{2}}',
    ]);
  });

  it('named tokens in body', () => {
    expect(extractTemplateVariableTokens([body('Hi {{name}}, from {{company}}')])).toEqual([
      '{{name}}',
      '{{company}}',
    ]);
  });

  it('mixed: numeric sorted ascending first, then named in appearance order', () => {
    expect(extractTemplateVariableTokens([body('{{name}} {{2}} {{1}} {{city}}')])).toEqual([
      '{{1}}',
      '{{2}}',
      '{{name}}',
      '{{city}}',
    ]);
  });

  it('dedupes repeated tokens', () => {
    expect(extractTemplateVariableTokens([body('{{1}} and again {{1}} plus {{ 1 }}')])).toEqual([
      '{{1}}',
    ]);
  });

  it('normalizes inner whitespace to {{token}}', () => {
    expect(extractTemplateVariableTokens([body('Hi {{ name }}')])).toEqual(['{{name}}']);
  });

  it('includes TEXT header tokens', () => {
    expect(
      extractTemplateVariableTokens([
        { type: 'HEADER', format: 'TEXT', text: 'Order {{1}}' },
        body('Thanks {{2}}'),
      ])
    ).toEqual(['{{1}}', '{{2}}']);
  });

  it('ignores non-TEXT headers', () => {
    expect(
      extractTemplateVariableTokens([
        { type: 'HEADER', format: 'IMAGE', text: 'should be ignored {{9}}' },
        body('Hi {{1}}'),
      ])
    ).toEqual(['{{1}}']);
  });

  it('includes URL button tokens, ignores non-URL buttons', () => {
    expect(
      extractTemplateVariableTokens([
        body('Hi {{1}}'),
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'URL', text: 'Track', url: 'https://example.com/track/{{2}}' },
            { type: 'QUICK_REPLY', text: 'Stop' },
          ],
        },
      ])
    ).toEqual(['{{1}}', '{{2}}']);
  });

  it('empty components -> empty', () => {
    expect(extractTemplateVariableTokens([])).toEqual([]);
    expect(extractTemplateVariableTokens([body('no vars here')])).toEqual([]);
  });
});

describe('buildTemplatePayload', () => {
  it('empty params -> empty components', () => {
    expect(buildTemplatePayload({ name: 'welcome', language: 'en_US', params: [] })).toEqual({
      name: 'welcome',
      language: 'en_US',
      components: [],
    });
  });

  it('params become a single body component with text parameters', () => {
    expect(buildTemplatePayload({ name: 'otp', language: 'es', params: ['John', '1234'] })).toEqual({
      name: 'otp',
      language: 'es',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'John' },
            { type: 'text', text: '1234' },
          ],
        },
      ],
    });
  });
});

describe('renderTemplatePreview', () => {
  const text = 'Hi {{1}}, your order {{2}} ships. Bye {{1}}!';
  const tokens = ['{{1}}', '{{2}}'];

  it('replaces filled tokens (all occurrences)', () => {
    expect(renderTemplatePreview(text, tokens, ['John', 'A42'])).toBe(
      'Hi John, your order A42 ships. Bye John!'
    );
  });

  it('leaves unfilled / blank tokens visible', () => {
    expect(renderTemplatePreview(text, tokens, ['John', '   '])).toBe(
      'Hi John, your order {{2}} ships. Bye John!'
    );
    expect(renderTemplatePreview(text, tokens, [])).toBe(text);
  });

  it('handles named tokens', () => {
    expect(renderTemplatePreview('Hello {{name}}', ['{{name}}'], ['Ana'])).toBe('Hello Ana');
  });
});

describe('templateBodyText', () => {
  it('returns the first BODY text', () => {
    expect(
      templateBodyText([
        { type: 'HEADER', format: 'TEXT', text: 'header' },
        body('the body'),
        body('second body'),
      ])
    ).toBe('the body');
  });

  it('empty string when no body component', () => {
    expect(templateBodyText([{ type: 'HEADER', format: 'TEXT', text: 'header' }])).toBe('');
    expect(templateBodyText([])).toBe('');
  });
});
