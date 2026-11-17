import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/server/supabase';

export interface QuickReply {
  id: string;
  profile_id: string;
  shortcut: string;
  title: string;
  content: string;
  media_url?: string | null;
  category?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Fallback in-memory defaults if Supabase is offline or empty
const FALLBACK_QUICK_REPLIES: QuickReply[] = [
  {
    id: 'fallback-1',
    profile_id: 'default',
    shortcut: '/boasvindas',
    title: 'Boas-vindas',
    content: 'Olá! Seja muito bem-vindo(a) à Harmo Store. Como posso te ajudar hoje?',
    category: 'atendimento',
  },
  {
    id: 'fallback-2',
    profile_id: 'default',
    shortcut: '/pix',
    title: 'Dados do PIX',
    content: 'Seguem os nossos dados para pagamento via PIX:\nChave PIX (CNPJ): 00.000.000/0001-00\nFavorecido: Harmo Store Comércio',
    category: 'pagamento',
  },
  {
    id: 'fallback-3',
    profile_id: 'default',
    shortcut: '/horarios',
    title: 'Horário de Atendimento',
    content: 'Nosso horário de atendimento é de Segunda a Sexta das 09h às 18h, e aos Sábados das 09h às 13h.',
    category: 'informacoes',
  },
  {
    id: 'fallback-4',
    profile_id: 'default',
    shortcut: '/agradecimento',
    title: 'Agradecimento',
    content: 'Agradecemos o seu contato! Qualquer outra dúvida, estamos à disposição. Tenha um ótimo dia!',
    category: 'atendimento',
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId') || 'default';

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ quickReplies: FALLBACK_QUICK_REPLIES });
  }

  try {
    const { data, error } = await supabase
      .from('wacrm_quick_replies')
      .select('*')
      .or(`profile_id.eq.${profileId},profile_id.eq.default`)
      .order('shortcut', { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ quickReplies: FALLBACK_QUICK_REPLIES });
    }

    return NextResponse.json({ quickReplies: data });
  } catch (err) {
    console.error('Error fetching quick replies:', err);
    return NextResponse.json({ quickReplies: FALLBACK_QUICK_REPLIES });
  }
}

export async function POST(req: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client unavailable' }, { status: 500 });
  }

  try {
    const body = await req.json();
    let shortcut = (body.shortcut || '').trim();
    if (shortcut && !shortcut.startsWith('/')) {
      shortcut = '/' + shortcut;
    }

    if (!shortcut || !body.title || !body.content) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: atalho, título e conteúdo' },
        { status: 400 }
      );
    }

    const newReply = {
      profile_id: body.profileId || 'default',
      shortcut,
      title: body.title.trim(),
      content: body.content.trim(),
      media_url: body.mediaUrl || null,
      category: body.category || 'geral',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('wacrm_quick_replies')
      .insert([newReply])
      .select('*')
      .single();

    if (error) {
      console.error('Error inserting quick reply:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ quickReply: data }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/quick-replies:', err);
    return NextResponse.json({ error: 'Erro ao criar resposta rápida' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client unavailable' }, { status: 500 });
  }

  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'ID da resposta rápida é obrigatório' }, { status: 400 });
    }

    let shortcut = (body.shortcut || '').trim();
    if (shortcut && !shortcut.startsWith('/')) {
      shortcut = '/' + shortcut;
    }

    const updates: Partial<QuickReply> = {
      updated_at: new Date().toISOString(),
    };

    if (shortcut) updates.shortcut = shortcut;
    if (body.title) updates.title = body.title.trim();
    if (body.content) updates.content = body.content.trim();
    if (body.mediaUrl !== undefined) updates.media_url = body.mediaUrl || null;
    if (body.category !== undefined) updates.category = body.category || 'geral';

    const { data, error } = await supabase
      .from('wacrm_quick_replies')
      .update(updates)
      .eq('id', body.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ quickReply: data });
  } catch (err) {
    console.error('Unexpected error in PUT /api/quick-replies:', err);
    return NextResponse.json({ error: 'Erro ao atualizar resposta rápida' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client unavailable' }, { status: 500 });
  }

  try {
    const { error } = await supabase
      .from('wacrm_quick_replies')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error in DELETE /api/quick-replies:', err);
    return NextResponse.json({ error: 'Erro ao remover resposta rápida' }, { status: 500 });
  }
}
