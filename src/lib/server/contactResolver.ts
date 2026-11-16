import { getSupabaseServerClient } from './supabase';

export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  // Strip non-digits
  let cleaned = rawPhone.replace(/\D/g, '');
  // If it starts with 0, strip leading 0
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  // If 10 or 11 digits (Brazilian local format), prepend DDI 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
}

export interface ProvisionContactParams {
  phone: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export async function resolveOrProvisionContact(params: ProvisionContactParams): Promise<{ id: string; name: string; phone: string } | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const normalized = normalizePhone(params.phone);
  if (!normalized) return null;

  try {
    // 1. Search for existing contact by phone variations
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, name, phone')
      .or(`phone.eq.${normalized},phone.eq.${params.phone}`)
      .maybeSingle();

    if (existing) {
      // Touch updated_at
      await supabase
        .from('contacts')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      return {
        id: existing.id,
        name: existing.name || `Lead +${normalized}`,
        phone: existing.phone,
      };
    }

    // 2. Contact does not exist -> Auto-create
    const displayName = params.name && params.name.trim() ? params.name.trim() : `Lead +${normalized}`;
    
    // Get dummy user_id from existing contacts or system user if RLS demands it
    const { data: dummyContact } = await supabase
      .from('contacts')
      .select('user_id')
      .limit(1)
      .maybeSingle();

    const userId = dummyContact?.user_id || '00000000-0000-0000-0000-000000000000';

    const { data: newContact, error: insertErr } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        name: displayName,
        phone: normalized,
        avatar_url: params.avatarUrl || null,
        kommo_metadata: { zernio_auto_created: true, created_at: new Date().toISOString() },
      })
      .select('id, name, phone')
      .single();

    if (insertErr || !newContact) {
      console.error('[contactResolver] Failed to insert contact:', insertErr);
      return null;
    }

    // 3. Attach 'Zernio Auto' tag if exists
    try {
      const { data: tag } = await supabase
        .from('tags')
        .select('id')
        .eq('name', 'Zernio Auto')
        .maybeSingle();

      if (tag?.id) {
        await supabase
          .from('contact_tags')
          .insert({ contact_id: newContact.id, tag_id: tag.id })
          .single();
      }
    } catch {
      // Non-blocking tag error
    }

    return {
      id: newContact.id,
      name: newContact.name,
      phone: newContact.phone,
    };
  } catch (err) {
    console.error('[contactResolver] Unexpected error:', err);
    return null;
  }
}
