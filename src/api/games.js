import { supabase } from '../lib/supabase';

/**
 * Fetch all games from Supabase (for shop-by-game nav and filters).
 * @returns {Promise<Array<{ id: string, name: string, slug: string }>>}
 */
export async function getGames() {
  const { data, error } = await supabase
    .from('games')
    .select('id, display_name')
    .order('display_name');

  if (error) {
    console.error('getGames error:', error);
    return [];
  }

  return (data || []).map((g) => ({
    id: g.id,
    name: g.display_name,
    slug: g.id,
  }));
}
