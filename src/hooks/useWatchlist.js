import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getWatchlist, addWatchlistEntry, removeWatchlistEntry } from '../api/watchlist';
import { isFavoriteListingId, toggleFavoriteListingId } from '../lib/favorites';

/**
 * Unified favorite/watchlist state: server-backed (`watchlist` table) when signed in,
 * localStorage (`src/lib/favorites.js`) fallback when signed out. `AuthContext` merges
 * local favorites into the server on sign-in (see `mergeLocalFavoritesIntoWatchlist`).
 */
export function useWatchlist() {
  const [userId, setUserId] = useState(undefined); // undefined = not yet known, null = signed out
  const [serverKeys, setServerKeys] = useState(new Set());
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setUserId(user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setServerKeys(new Set());
      return;
    }
    let cancelled = false;
    getWatchlist().then(({ rows }) => {
      if (!cancelled) setServerKeys(new Set(rows.map((r) => r.listing_key)));
    });
    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  useEffect(() => {
    if (userId) return; // server data already refreshed via `tick` above
    const onLocalChange = () => refresh();
    window.addEventListener('rgc-favorites', onLocalChange);
    window.addEventListener('storage', onLocalChange);
    return () => {
      window.removeEventListener('rgc-favorites', onLocalChange);
      window.removeEventListener('storage', onLocalChange);
    };
  }, [userId, refresh]);

  const isFavorite = useCallback(
    (listingKey) => (userId ? serverKeys.has(listingKey) : isFavoriteListingId(listingKey)),
    [userId, serverKeys]
  );

  const toggle = useCallback(
    async (listingKey) => {
      if (!listingKey) return false;
      if (!userId) {
        return toggleFavoriteListingId(listingKey);
      }
      const next = !serverKeys.has(listingKey);
      if (next) {
        await addWatchlistEntry(listingKey);
      } else {
        await removeWatchlistEntry(listingKey);
      }
      refresh();
      return next;
    },
    [userId, serverKeys, refresh]
  );

  return { isFavorite, toggle, signedIn: !!userId };
}
