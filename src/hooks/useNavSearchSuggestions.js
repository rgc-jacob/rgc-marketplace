import { useEffect, useState } from 'react';
import { searchCatalogCards } from '../api/catalog';
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
 * Debounced query → catalog (card vs set) + optional RGC suggest API.
 * Games/categories live in the main nav, not here.
 * @param {string} debouncedQuery
 * @param {'card'|'set'} searchKind
 */
export function useNavSearchSuggestions(debouncedQuery, searchKind) {
  const [apiStrings, setApiStrings] = useState([]);
  const [catalogHits, setCatalogHits] = useState([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  const kind = searchKind === 'set' ? 'set' : 'card';

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
    const k = `${norm(q)}|${kind}`;
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
          searchKind: kind,
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

    const suggestP =
      kind === 'card' && suggestEligible
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
  }, [debouncedQuery, kind]);

  return {
    catalogHits,
    apiStrings,
    loadingRemote,
  };
}
