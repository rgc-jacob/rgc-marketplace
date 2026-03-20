import { supabase } from '../lib/supabase';

const SELECT_CARD =
  `
  id,
  game_id,
  expansion_id,
  name,
  number,
  rarity,
  variant_name,
  image_small,
  image_medium,
  expansions ( id, name, code )
`;

/**
 * Paginated catalog browse with optional full-text search on search_vector.
 * @param {Object} p
 * @param {string} [p.query] - full-text query (empty = no text filter)
 * @param {string|null} [p.gameId]
 * @param {string|null} [p.expansionId]
 * @param {string|null} [p.rarity] - exact match
 * @param {boolean} [p.baseCardsOnly] - exclude ids containing "::" (variant rows)
 * @param {number} [p.limit]
 * @param {number} [p.offset]
 */
export async function searchCatalogCards(p) {
  const {
    query = '',
    gameId = null,
    expansionId = null,
    rarity = null,
    baseCardsOnly = true,
    limit = 48,
    offset = 0,
  } = p;

  const pageSize = Math.min(Math.max(1, limit), 100);
  const from = offset;
  const to = offset + pageSize - 1;

  let q = supabase
    .from('cards_v2')
    .select(SELECT_CARD, { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (gameId) q = q.eq('game_id', gameId);
  if (expansionId) q = q.eq('expansion_id', expansionId);
  if (rarity?.trim()) q = q.ilike('rarity', `%${rarity.trim()}%`);
  if (baseCardsOnly) q = q.not('id', 'like', '%::%');

  const trimmed = query.trim();
  if (trimmed) {
    q = q.textSearch('search_vector', trimmed, {
      type: 'websearch',
      config: 'english',
    });
  }

  const { data, error, count } = await q;

  if (error) {
    console.error('searchCatalogCards', error);
    return { rows: [], totalCount: 0, error };
  }

  return {
    rows: data || [],
    totalCount: count ?? 0,
    error: null,
  };
}

/**
 * @param {string} gameId
 * @returns {Promise<Array<{ id: string, name: string, code: string | null }>>}
 */
export async function getExpansionsForGame(gameId) {
  if (!gameId) return [];
  const { data, error } = await supabase
    .from('expansions')
    .select('id, name, code')
    .eq('game_id', gameId)
    .order('name')
    .limit(500);

  if (error) {
    console.error('getExpansionsForGame', error);
    return [];
  }
  return data || [];
}
