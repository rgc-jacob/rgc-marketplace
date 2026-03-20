import { useEffect, useMemo, useState } from 'react';
import { searchCatalogCards } from '../api/catalog';
import { CATEGORIES } from '../data/games';
import { normalizeRgcSuggestResponse, rgcSearchSuggest } from '../lib/rgcBackend';

const CACHE_TTL_MS = 90 * 1000;
const CACHE_MAX_ENTRIES = 50;
const navSuggestCache = new Map();

function norm(s) {
  return (s || '').trim().toLowerCase();
}

function getCache(key) {
  const entry = navSuggestCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    navSuggestCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  if (navSuggestCache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = navSuggestCache.keys().next().value;
    if (firstKey) navSuggestCache.delete(firstKey);
  }
  navSuggestCache.set(key, { ts: Date.now(), value });
}

/**
 * Debounced query → local games/categories + catalog FTS + optional RGC suggest API.
 * @param {string} debouncedQuery
 * @param {Array<{ id: string, name: string, slug: string }>} games
 */
export function useNavSearchSuggestions(debouncedQuery, games) {
  const [apiStrings, setApiStrings] = useState([]);
  const [catalogHits, setCatalogHits] = useState([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  const localGames = useMemo(() => {
    const q = norm(debouncedQuery);
    if (q.length < 1) return [];
    return (games || [])
      .filter((g) => norm(g.name).includes(q) || norm(g.slug).includes(q) || norm(g.id).includes(q))
      .slice(0, 5);
  }, [debouncedQuery, games]);

  const localCategories = useMemo(() => {
    const q = norm(debouncedQuery);
    if (q.length < 1) return [];
    return CATEGORIES.filter(
      (c) =>
        norm(c.name).includes(q) ||
        norm(c.slug).includes(q) ||
        norm(c.description).includes(q),
    ).slice(0, 5);
  }, [debouncedQuery]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    const suggestEligible = q.length >= 3;
    const catalogEligible = q.length >= 4;
    if (!suggestEligible && !catalogEligible) {
      setApiStrings([]);
      setCatalogHits([]);
      setLoadingRemote(false);
      return;
    }

    const ac = new AbortController();
    setLoadingRemote(true);
    const k = norm(q);
    const cached = getCache(k);
    if (cached) {
      setApiStrings(cached.apiStrings || []);
      setCatalogHits(cached.catalogHits || []);
      setLoadingRemote(false);
      return () => ac.abort();
    }
    let nextCatalogHits = [];
    let nextApiStrings = [];

    const catalogP = catalogEligible
      ? searchCatalogCards({
          query: q,
          limit: 3,
          offset: 0,
          baseCardsOnly: true,
        }).then(({ rows, error }) => {
          if (ac.signal.aborted) return;
          nextCatalogHits = error ? [] : rows || [];
          setCatalogHits(nextCatalogHits);
        })
      : Promise.resolve().then(() => {
          if (!ac.signal.aborted) {
            nextCatalogHits = [];
            setCatalogHits([]);
          }
        });

    const suggestP = suggestEligible
      ? rgcSearchSuggest({ search_prefix: q, result_limit: 6 }, { signal: ac.signal })
          .then(({ data, error }) => {
            if (ac.signal.aborted) return;
            nextApiStrings = error ? [] : normalizeRgcSuggestResponse(data);
            setApiStrings(nextApiStrings);
          })
          .catch(() => {
            if (!ac.signal.aborted) {
              nextApiStrings = [];
              setApiStrings([]);
            }
          })
      : Promise.resolve().then(() => {
          if (!ac.signal.aborted) {
            nextApiStrings = [];
            setApiStrings([]);
          }
        });

    Promise.all([catalogP, suggestP]).finally(() => {
      if (!ac.signal.aborted) {
        setCache(k, {
          apiStrings: nextApiStrings,
          catalogHits: nextCatalogHits,
        });
        setLoadingRemote(false);
      }
    });

    return () => ac.abort();
  }, [debouncedQuery]);

  const apiStringsDeduped = useMemo(() => {
    const names = new Set((catalogHits || []).map((c) => norm(c.name)));
    return apiStrings.filter((s) => !names.has(norm(s)));
  }, [apiStrings, catalogHits]);

  return {
    localGames,
    localCategories,
    catalogHits,
    apiStrings: apiStringsDeduped,
    loadingRemote,
  };
}
