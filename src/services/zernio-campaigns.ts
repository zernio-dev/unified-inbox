import type {
  Broadcast,
  Sequence,
  CommentAutomation,
  CreateBroadcastInput,
} from '@/types/zernio-campaigns';

const mockBroadcasts: Broadcast[] = [
  {
    id: 'bc-101',
    name: 'Lançamento de Verão - Coleção 2026',
    channel: 'instagram',
    status: 'completed',
    targetTags: ['Cliente VIP', 'Interesse Moda'],
    message: 'Olá {{nome}}! Nossa nova coleção de verão já está disponível com 20% OFF.',
    sentCount: 1450,
    totalRecipients: 1500,
    createdAt: '2026-08-10T10:00:00Z',
  },
  {
    id: 'bc-102',
    name: 'Cupom de Boas-Vindas WhatsApp',
    channel: 'whatsapp',
    status: 'sending',
    targetTags: ['Novo Lead'],
    message: 'Seja bem-vindo(a) à HarmoStore! Use o cupom BEMVINDO10 na sua primeira compra.',
    sentCount: 320,
    totalRecipients: 500,
    createdAt: '2026-08-19T14:30:00Z',
  },
  {
    id: 'bc-103',
    name: 'Lembrete de Carrinho Abandonado',
    channel: 'instagram',
    status: 'scheduled',
    targetTags: ['Carrinho Abandonado'],
    message: 'Notamos que você deixou itens no carrinho. Finalize sua compra com frete grátis!',
    scheduledAt: '2026-08-22T09:00:00Z',
    sentCount: 0,
    totalRecipients: 240,
    createdAt: '2026-08-20T12:00:00Z',
  },
];

const mockSequences: Sequence[] = [
  {
    id: 'seq-201',
    name: 'Régua de Boas-Vindas e Nutrição (Instagram DM)',
    channel: 'instagram',
    active: true,
    enrolledCount: 840,
    createdAt: '2026-07-01T08:00:00Z',
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        delayHours: 0,
        message: 'Obrigado por nos seguir! Conheça nossos produtos mais vendidos no link.',
      },
      {
        id: 'step-2',
        stepNumber: 2,
        delayHours: 24,
        message: 'Ficou com alguma dúvida sobre o catálogo? Nossa equipe está à disposição!',
      },
      {
        id: 'step-3',
        stepNumber: 3,
        delayHours: 72,
        message: 'Aqui está um presente especial: 15% OFF para você testar nossos serviços!',
      },
    ],
  },
  {
    id: 'seq-202',
    name: 'Follow-up de Clientes Inativos (WhatsApp)',
    channel: 'whatsapp',
    active: true,
    enrolledCount: 310,
    createdAt: '2026-07-15T11:20:00Z',
    steps: [
      {
        id: 'step-21',
        stepNumber: 1,
        delayHours: 0,
        message: 'Sentimos sua falta! Como podemos te ajudar hoje?',
      },
      {
        id: 'step-22',
        stepNumber: 2,
        delayHours: 48,
        message: 'Veja as novidades que chegaram esta semana no estoque HarmoStore.',
      },
    ],
  },
];

const mockCommentAutomations: CommentAutomation[] = [
  {
    id: 'ca-301',
    name: 'Automação Post Instagram - Oferta iPhone',
    platform: 'instagram',
    postUrl: 'https://instagram.com/p/C123456789',
    postId: 'post-108',
    keyword: 'QUERO',
    publicResponses: [
      'Te enviamos uma mensagem privada com os detalhes! 📩',
      'Confira o seu direct! Enviamos o link promocional por lá. ✨',
    ],
    dmMessage: 'Olá! Vimos seu comentário. Clique no link para garantir o seu iPhone com desconto exclusivo: https://harmostore.com/iphone-promo',
    triggerCount: 420,
    active: true,
    createdAt: '2026-08-01T15:00:00Z',
  },
  {
    id: 'ca-302',
    name: 'Automação Post Facebook - E-book Grátis',
    platform: 'facebook',
    postUrl: 'https://facebook.com/posts/987654321',
    postId: 'post-204',
    keyword: 'EBOOK',
    publicResponses: [
      'Link enviado no seu Messenger! 📚',
      'Acabamos de te mandar o e-book por mensagem privada!',
    ],
    dmMessage: 'Aqui está o seu e-book gratuito de estratégias de vendas. Aproveite!',
    triggerCount: 185,
    active: true,
    createdAt: '2026-08-05T09:30:00Z',
  },
];

export async function getBroadcasts(): Promise<Broadcast[]> {
  return Promise.resolve([...mockBroadcasts]);
}

export async function createBroadcast(input: CreateBroadcastInput): Promise<Broadcast> {
  const newBroadcast: Broadcast = {
    id: `bc-${Date.now()}`,
    name: input.name,
    channel: input.channel,
    status: input.scheduledAt ? 'scheduled' : 'sending',
    targetTags: input.targetTags,
    message: input.message,
    mediaUrl: input.mediaUrl,
    scheduledAt: input.scheduledAt,
    sentCount: 0,
    totalRecipients: input.targetTags.length * 150 + 100, // mock count
    createdAt: new Date().toISOString(),
  };

  mockBroadcasts.unshift(newBroadcast);
  return Promise.resolve(newBroadcast);
}

export async function getSequences(): Promise<Sequence[]> {
  return Promise.resolve([...mockSequences]);
}

export async function getCommentAutomations(): Promise<CommentAutomation[]> {
  return Promise.resolve([...mockCommentAutomations]);
}
