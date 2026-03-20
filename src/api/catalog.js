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

const SELECT_CARD_SET =
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
  expansions!inner ( id, name, code )
`;

/** Escape `%` / `_` for PostgreSQL ILIKE patterns in PostgREST filter strings. */
function ilikePattern(raw) {
  const s = String(raw).trim();
  const escaped = s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `%${escaped}%`;
}

/**
 * Paginated catalog browse with optional text filter.
 * @param {Object} p
 * @param {string} [p.query] - search text (empty = no text filter)
 * @param {'card'|'set'} [p.searchKind] - card: name/rarity/number/variant; set: expansion name/code
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
    searchKind = 'card',
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
  const kind = searchKind === 'set' ? 'set' : 'card';

  const trimmed = query.trim();
  const pat = trimmed ? ilikePattern(trimmed) : '';

  let q = supabase
    .from('cards_v2')
    .select(kind === 'set' ? SELECT_CARD_SET : SELECT_CARD, { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to);

  if (gameId) q = q.eq('game_id', gameId);
  if (expansionId) q = q.eq('expansion_id', expansionId);
  if (rarity?.trim()) q = q.ilike('rarity', `%${rarity.trim()}%`);
  if (baseCardsOnly) q = q.not('id', 'like', '%::%');

  if (trimmed) {
    if (kind === 'set') {
      q = q.or(`name.ilike.${pat},code.ilike.${pat}`, { foreignTable: 'expansions' });
    } else {
      const orParts = [`name.ilike.${pat}`, `rarity.ilike.${pat}`, `variant_name.ilike.${pat}`];
      if (/^\d+$/.test(trimmed)) {
        orParts.push(`number.eq.${trimmed}`);
      }
      q = q.or(orParts.join(','));
    }
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
