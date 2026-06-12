import type { TemplateComponent } from '../types';

const TOKEN_RE = /\{\{\s*(\d+|[A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * All variable tokens across a template definition's TEXT header, body, and
 * URL button suffixes, canonicalized to `{{token}}` (no inner whitespace) and
 * deduped: positional tokens ("{{1}}") sorted numerically first, then named
 * tokens ("{{name}}") in order of first appearance. This is the order the
 * composer fills values in, matching how positional sends map onto Meta's API.
 */
export function extractTemplateVariableTokens(components: TemplateComponent[]): string[] {
  const texts: string[] = [];
  for (const c of components ?? []) {
    const compType = (c?.type || '').toLowerCase();
    if (compType === 'header' && (c?.format || '').toLowerCase() === 'text' && typeof c?.text === 'string') {
      texts.push(c.text);
    }
    if (compType === 'body' && typeof c?.text === 'string') texts.push(c.text);
    if (compType === 'buttons') {
      for (const b of c?.buttons ?? []) {
        if ((b?.type || '').toLowerCase() === 'url' && typeof b?.url === 'string') texts.push(b.url);
      }
    }
  }

  const source = texts.join('\n');
  const seen = new Set<string>();
  const numeric: number[] = [];
  const named: string[] = [];
  for (const m of source.matchAll(TOKEN_RE)) {
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    if (/^\d+$/.test(key)) numeric.push(parseInt(key, 10));
    else named.push(key);
  }
  numeric.sort((a, b) => a - b);
  return [...numeric.map(String), ...named].map((k) => `{{${k}}}`);
}

/** Build the {name, language, components} payload the send endpoints expect. */
export function buildTemplatePayload({
  name,
  language,
  params,
}: {
  name: string;
  language: string;
  params: string[];
}): {
  name: string;
  language: string;
  components: { type: string; parameters: { type: string; text: string }[] }[];
} {
  return {
    name,
    language,
    components:
      params.length > 0
        ? [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: t })) }]
        : [],
  };
}

/**
 * Live preview: substitute entered values into the template body. Unfilled
 * placeholders stay visible as {{n}} so the user sees what's missing.
 */
export function renderTemplatePreview(bodyText: string, tokens: string[], params: string[]): string {
  return (bodyText || '').replace(TOKEN_RE, (match, key: string) => {
    const idx = tokens.indexOf(`{{${key}}}`);
    if (idx < 0) return match;
    const value = params[idx];
    return value && value.trim() ? value : match;
  });
}

/** Text of the first BODY component, else ''. */
export function templateBodyText(components: TemplateComponent[]): string {
  const body = (components ?? []).find((c) => (c?.type || '').toLowerCase() === 'body');
  return typeof body?.text === 'string' ? body.text : '';
}
