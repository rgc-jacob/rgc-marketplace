import { supabase } from '../lib/supabase';

/**
 * @returns {Promise<Array>}
 */
export async function getCollectionsWithMarketStats() {
  const { data, error } = await supabase.rpc('get_collections_with_market_stats');
  if (error) {
    console.error('get_collections_with_market_stats', error);
    return [];
  }
  return data || [];
}

/**
 * @param {Object} p
 * @param {string} p.collectionId - uuid
 * @param {string} [p.searchQuery]
 * @param {string[]|null} [p.franchises] - game_id strings
 * @param {string[]|null} [p.sets] - expansion ids
 * @param {'all'|'graded'|'raw'} [p.gradedStatus]
 * @param {number|null} [p.minValue]
 * @param {number|null} [p.maxValue]
 * @param {string} [p.sortBy]
 * @param {boolean} [p.sortAscending]
 * @param {number} [p.limit]
 * @param {number} [p.offset]
 */
export async function getCollectionCardsFiltered(p) {
  const {
    collectionId,
    searchQuery = null,
    franchises = null,
    sets = null,
    gradedStatus = 'all',
    minValue = null,
    maxValue = null,
    sortBy = 'created_at',
    sortAscending = false,
    limit = 48,
    offset = 0,
  } = p;

  const { data, error } = await supabase.rpc('get_collection_cards_filtered', {
    p_collection_id: collectionId,
    p_search_query: searchQuery || null,
    p_franchises: franchises?.length ? franchises : null,
    p_sets: sets?.length ? sets : null,
    p_graded_status: gradedStatus,
    p_grading_companies: null,
    p_conditions: null,
    p_min_grade: null,
    p_max_grade: null,
    p_min_value: minValue,
    p_max_value: maxValue,
    p_sort_by: sortBy,
    p_sort_ascending: sortAscending,
    p_limit: Math.min(Math.max(1, limit), 200),
    p_offset: offset,
    p_cursor_created_at: null,
    p_cursor_id: null,
  });

  if (error) {
    console.error('get_collection_cards_filtered', error);
    return { rows: [], totalCount: 0, error };
  }

  const rows = data || [];
  const totalCount = rows[0]?.total_count != null ? Number(rows[0].total_count) : rows.length;
  return { rows, totalCount, error: null };
}

/**
 * Search the signed-in user's cards across collections (richer row shape).
 * @param {Object} p
 * @param {string} [p.searchQuery]
 * @param {string|null} [p.franchise] - single game_id
 * @param {number} [p.limit]
 * @param {number} [p.offset]
 */
export async function searchUserCardsAcrossCollections(p) {
  const {
    searchQuery = '',
    franchise = null,
    limit = 48,
    offset = 0,
  } = p;

  const { data, error } = await supabase.rpc('search_user_cards_across_collections', {
    p_user_id: null,
    p_search_query: searchQuery || '',
    p_franchise: franchise || null,
    p_limit: Math.min(Math.max(1, limit), 200),
    p_offset: offset,
  });

  if (error) {
    console.error('search_user_cards_across_collections', error);
    return { rows: [], totalCount: 0, error };
  }

  const rows = data || [];
  const totalCount = rows[0]?.total_count != null ? Number(rows[0].total_count) : rows.length;
  return { rows, totalCount, error: null };
}
