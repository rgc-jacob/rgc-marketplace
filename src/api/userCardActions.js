import { supabase } from '../lib/supabase';

/**
 * Add a catalog card to the user's first collection (or a new default collection).
 * @param {{ cardId: string, variantName?: string }} p
 * @returns {Promise<{ ok: boolean, error?: string, created?: boolean }>}
 */
export async function addCardToUserCollection(p) {
  const { cardId, variantName = 'normal' } = p;
  if (!cardId) return { ok: false, error: 'Missing card id' };

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: 'Sign in to add cards to your collection.' };
  }

  const uid = user.id;

  const { data: existing, error: colErr } = await supabase
    .from('collections')
    .select('id')
    .eq('user_id', uid)
    .order('display_order', { ascending: true })
    .limit(1);

  if (colErr) {
    return { ok: false, error: colErr.message };
  }

  let collectionId = existing?.[0]?.id;

  if (!collectionId) {
    const { data: created, error: insColErr } = await supabase
      .from('collections')
      .insert({ user_id: uid, name: 'My collection' })
      .select('id')
      .single();

    if (insColErr || !created?.id) {
      return { ok: false, error: insColErr?.message || 'Could not create a collection.' };
    }
    collectionId = created.id;
  }

  const { error: insErr } = await supabase.from('user_cards').insert({
    user_id: uid,
    collection_id: collectionId,
    card_id: cardId,
    card_id_v2: cardId,
    variant_name: variantName || 'normal',
    quantity: 1,
    is_graded: false,
    grading_company: 'none',
  });

  if (insErr) {
    if (insErr.code === '23505' || /duplicate|unique/i.test(insErr.message)) {
      return { ok: false, error: 'This card is already in that collection.' };
    }
    return { ok: false, error: insErr.message };
  }

  return { ok: true, created: true };
}
