import { describe, expect, it } from 'vitest';

interface QuickReply {
  id: string;
  profile_id: string;
  shortcut: string;
  title: string;
  content: string;
  category?: string;
}

const SAMPLE_REPLIES: QuickReply[] = [
  {
    id: '1',
    profile_id: 'default',
    shortcut: '/boasvindas',
    title: 'Boas-vindas',
    content: 'Olá! Seja muito bem-vindo(a) à Harmo Store.',
    category: 'atendimento',
  },
  {
    id: '2',
    profile_id: 'default',
    shortcut: '/pix',
    title: 'Dados do PIX',
    content: 'Seguem os nossos dados para pagamento via PIX.',
    category: 'pagamento',
  },
  {
    id: '3',
    profile_id: 'default',
    shortcut: '/horarios',
    title: 'Horário de Atendimento',
    content: 'Nosso horário de atendimento é de 09h às 18h.',
    category: 'informacoes',
  },
];

function filterQuickReplies(replies: QuickReply[], query: string): QuickReply[] {
  const clean = query.toLowerCase().replace(/^\//, '');
  return replies.filter(
    (r) =>
      r.shortcut.toLowerCase().includes(clean) ||
      r.title.toLowerCase().includes(clean) ||
      r.content.toLowerCase().includes(clean)
  );
}

function applyQuickReplyToText(text: string, shortcutMatch: string | null, replyContent: string): string {
  if (shortcutMatch) {
    return text.replace(/(^|\s)\/([a-zA-Z0-9_áàâãéèêíïóôõöúçñ-]*)$/i, `$1${replyContent}`);
  }
  return text ? `${text}\n${replyContent}` : replyContent;
}

describe('Quick Replies Logic', () => {
  it('filters quick replies by shortcut query', () => {
    const result = filterQuickReplies(SAMPLE_REPLIES, 'pix');
    expect(result).toHaveLength(1);
    expect(result[0].shortcut).toBe('/pix');
  });

  it('filters quick replies with leading slash', () => {
    const result = filterQuickReplies(SAMPLE_REPLIES, '/boas');
    expect(result).toHaveLength(1);
    expect(result[0].shortcut).toBe('/boasvindas');
  });

  it('replaces typed shortcut with reply content', () => {
    const text = 'Olá cliente /pix';
    const updated = applyQuickReplyToText(text, '/pix', 'PIX: 00.000.000/0001-00');
    expect(updated).toBe('Olá cliente PIX: 00.000.000/0001-00');
  });

  it('appends reply content when no shortcut is actively typed', () => {
    const text = 'Olá cliente';
    const updated = applyQuickReplyToText(text, null, 'Tenha um bom dia!');
    expect(updated).toBe('Olá cliente\nTenha um bom dia!');
  });
});
