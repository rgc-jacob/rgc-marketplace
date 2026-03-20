import { useState, useEffect } from 'react';
import { getGames } from '../api/games';

/**
 * Fetch games once. Used by Header, Home (GameGrid), and Browse (FilterSidebar).
 */
export function useGames() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getGames()
      .then((data) => {
        if (!cancelled) setGames(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { games, loading, error };
}

/** Map game_id -> display name for listing labels */
export function gamesToDisplayNames(games) {
  return Object.fromEntries((games || []).map((g) => [g.slug ?? g.id, g.name]));
}
