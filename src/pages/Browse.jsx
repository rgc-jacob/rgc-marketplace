import { useSearchParams, Link, useLocation } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback } from 'react';
import FilterSidebar from '../components/FilterSidebar';
import ListingCard from '../components/ListingCard';
import { useGames, gamesToDisplayNames } from '../hooks/useGames';
import { useDebounced } from '../hooks/useDebounced';
import { getMarketplaceListings } from '../api/listings';
import { getExpansionsForGame } from '../api/catalog';
import { CATEGORIES } from '../data/games';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
];

const PAGE_SIZE = 48;

function numOrEmpty(raw) {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  return Number.isFinite(n) ? n : '';
}

export default function Browse() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [condition, setCondition] = useState('');

  const q = searchParams.get('q') ?? '';
  const debouncedQ = useDebounced(q, 400);
  const queryScope = searchParams.get('q_scope') === 'set' ? 'set' : 'card';
  const game = searchParams.get('game') ?? '';
  const expansion = searchParams.get('expansion') ?? '';
  const category = searchParams.get('category') ?? '';
  const graded = searchParams.get('graded') ?? '';
  const priceMin = numOrEmpty(searchParams.get('price_min'));
  const priceMax = numOrEmpty(searchParams.get('price_max'));

  const { games } = useGames();
  const gameNames = useMemo(() => gamesToDisplayNames(games), [games]);

  const filters = useMemo(
    () => ({
      game,
      expansion,
      category,
      condition,
      graded,
      priceMin,
      priceMax,
    }),
    [game, expansion, category, condition, graded, priceMin, priceMax],
  );

  const [expansions, setExpansions] = useState([]);
  const [expansionsLoading, setExpansionsLoading] = useState(false);

  useEffect(() => {
    if (!game) {
      setExpansions([]);
      setExpansionsLoading(false);
      return;
    }
    let cancelled = false;
    setExpansionsLoading(true);
    getExpansionsForGame(game)
      .then((rows) => {
        if (!cancelled) setExpansions(rows || []);
      })
      .catch(() => {
        if (!cancelled) setExpansions([]);
      })
      .finally(() => {
        if (!cancelled) setExpansionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [game]);

  const onFilterChange = useCallback(
    (key, value) => {
      if (key === 'clear') {
        setSearchParams(new URLSearchParams(), { replace: true });
        setCondition('');
        return;
      }
      if (key === 'condition') {
        setCondition(value);
        return;
      }
      const next = new URLSearchParams(searchParams);
      if (key === 'game') {
        next.delete('expansion');
      }
      const urlKey = key === 'priceMin' ? 'price_min' : key === 'priceMax' ? 'price_max' : key;
      if (value === '' || value === null || value === undefined) {
        next.delete(urlKey);
      } else {
        next.set(urlKey, String(value));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clearSearchOnly = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [sort, setSort] = useState('relevance');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [mayHaveMore, setMayHaveMore] = useState(false);
  const [listError, setListError] = useState(null);

  const searchKey = searchParams.toString();

  useEffect(() => {
    setPage(0);
  }, [searchKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const pGraded = filters.graded === 'yes' ? true : filters.graded === 'no' ? false : null;
    getMarketplaceListings({
      query: debouncedQ.trim() || null,
      queryScope,
      graded: pGraded,
      minPrice: filters.priceMin !== '' ? Number(filters.priceMin) : null,
      maxPrice: filters.priceMax !== '' ? Number(filters.priceMax) : null,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      gameId: filters.game || null,
      expansionId: filters.expansion || null,
      gameDisplayNames: gameNames,
    })
      .then((res) => {
        if (!cancelled) {
          setListError(res.ok ? null : res.error);
          setListings(res.listings || []);
          setMayHaveMore(res.mayHaveMore);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    debouncedQ,
    queryScope,
    filters.game,
    filters.expansion,
    filters.graded,
    filters.priceMin,
    filters.priceMax,
    gameNames,
    page,
  ]);

  const filtered = useMemo(() => {
    let list = [...listings];
    if (filters.category && filters.category !== 'singles') {
      if (!q.trim()) {
        list = list.filter((l) => l.source === 'seller');
      }
    }
    if (filters.condition) {
      list = list.filter((l) => {
        const cond = (l.condition || '').toLowerCase();
        const c = filters.condition.toLowerCase();
        if (c === 'graded') return l.graded;
        if (c === 'nm') return cond.includes('near mint');
        if (c === 'lp') return cond.includes('lightly played');
        if (c === 'mp') return cond.includes('moderately played');
        if (c === 'hp') return cond.includes('heavily played');
        if (c === 'new') return cond.includes('new');
        return cond.includes(c);
      });
    }
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (sort === 'newest') list.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    return list;
  }, [listings, filters.category, filters.condition, sort, q]);

  const gameLabel = useMemo(() => games.find((g) => g.slug === game || g.id === game)?.name, [games, game]);
  const expansionLabel = useMemo(() => {
    if (!expansion) return null;
    return expansions.find((e) => e.id === expansion)?.name ?? null;
  }, [expansion, expansions]);
  const categoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.slug === category)?.name,
    [category],
  );
  const hasUrlFilters =
    Boolean(game || expansion || category || graded || priceMin !== '' || priceMax !== '');
  const hasSidebarFiltersActive = hasUrlFilters || Boolean(condition);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileFiltersOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileFiltersOpen]);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileFiltersOpen]);

  const closeMobileFilters = useCallback(() => setMobileFiltersOpen(false), []);

  useEffect(() => {
    setMobileFiltersOpen(false);
  }, [location.pathname]);

  const filterSidebarProps = {
    filters,
    onFilterChange,
    games,
    expansions,
    expansionsLoading,
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="hidden lg:block shrink-0">
          <FilterSidebar {...filterSidebarProps} />
        </div>

        {mobileFiltersOpen && (
          <>
            <button
              type="button"
              aria-label="Close filters"
              className="fixed inset-0 top-14 sm:top-16 z-[60] bg-ink-900/40 lg:hidden"
              onClick={closeMobileFilters}
            />
            <div
              id="browse-mobile-filters"
              role="dialog"
              aria-modal="true"
              aria-labelledby="browse-mobile-filters-title"
              className="fixed top-14 sm:top-16 right-0 bottom-0 z-[70] w-full max-w-sm lg:hidden bg-paper-100 border-l border-paper-200 shadow-xl flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-paper-200 shrink-0">
                <h2 id="browse-mobile-filters-title" className="font-semibold text-ink-900 text-sm uppercase tracking-wide">
                  Filters
                </h2>
                <button
                  type="button"
                  onClick={closeMobileFilters}
                  className="p-2 -mr-2 text-ink-600 hover:text-ink-900 rounded-lg"
                  aria-label="Close filters"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                <FilterSidebar {...filterSidebarProps} embedded showHeading={false} />
              </div>
            </div>
          </>
        )}

        <div className="flex-1 min-w-0">
          {listError && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {listError}
            </p>
          )}

          {(q || hasUrlFilters) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-600">
              <span className="font-medium text-ink-500 uppercase tracking-wide">Active</span>
              {q && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-paper-100 border border-paper-200 px-2.5 py-1">
                    <span className="truncate max-w-[14rem]" title={q}>
                      Search: &ldquo;{q}&rdquo;
                    </span>
                    <button
                      type="button"
                      onClick={clearSearchOnly}
                      className="text-ink-500 hover:text-ink-900 shrink-0"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  </span>
                  <span className="rounded-full bg-paper-100 border border-paper-200 px-2.5 py-1">
                    {queryScope === 'set' ? 'Match: set / expansion' : 'Match: card'}
                  </span>
                </>
              )}
              {gameLabel && (
                <span className="rounded-full bg-paper-100 border border-paper-200 px-2.5 py-1">Game: {gameLabel}</span>
              )}
              {expansion && (
                <span className="rounded-full bg-paper-100 border border-paper-200 px-2.5 py-1 max-w-[16rem] truncate" title={expansionLabel || expansion}>
                  Set: {expansionLabel || expansion}
                </span>
              )}
              {categoryLabel && (
                <span className="rounded-full bg-paper-100 border border-paper-200 px-2.5 py-1">
                  Category: {categoryLabel}
                </span>
              )}
              {graded && (
                <span className="rounded-full bg-paper-100 border border-paper-200 px-2.5 py-1">
                  Graded: {graded === 'yes' ? 'Yes' : graded === 'no' ? 'Raw only' : graded}
                </span>
              )}
              {(priceMin !== '' || priceMax !== '') && (
                <span className="rounded-full bg-paper-100 border border-paper-200 px-2.5 py-1">
                  Price: {priceMin !== '' ? `$${priceMin}` : '—'} – {priceMax !== '' ? `$${priceMax}` : '—'}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <p
                className={
                  loading
                    ? 'text-sm inline-flex items-center rounded-lg bg-charcoal px-3 py-1.5 font-medium text-white'
                    : 'text-sm text-ink-500'
                }
              >
                {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'listing' : 'listings'}`}
                {!loading && q && (
                  <>
                    {' '}
                    for &ldquo;{q}&rdquo;
                  </>
                )}
                {!loading && page > 0 && <span className="text-ink-400"> · Page {page + 1}</span>}
              </p>
              {!loading && q && (
                <button
                  type="button"
                  onClick={clearSearchOnly}
                  className="text-sm font-medium text-mint hover:underline"
                >
                  Clear search
                </button>
              )}
              {!loading && (page > 0 || mayHaveMore) && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="text-sm font-medium text-mint disabled:text-ink-300 disabled:cursor-not-allowed hover:underline"
                  >
                    Previous
                  </button>
                  <span className="text-ink-300 text-sm">|</span>
                  <button
                    type="button"
                    disabled={!mayHaveMore}
                    onClick={() => setPage((p) => p + 1)}
                    className="text-sm font-medium text-mint disabled:text-ink-300 disabled:cursor-not-allowed hover:underline"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
                aria-expanded={mobileFiltersOpen}
                aria-controls={mobileFiltersOpen ? 'browse-mobile-filters' : undefined}
              >
                Filters
                <svg
                  className={`h-5 w-5 shrink-0 ${hasSidebarFiltersActive ? 'text-foil' : 'text-ink-500'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-charcoal/35 bg-charcoal/45 aspect-[5/7] animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-ink-500 space-y-3">
              <p className="font-medium text-ink-700">No listings match your filters.</p>
              <p className="text-sm max-w-md mx-auto">
                {queryScope === 'set' ? (
                  <>
                    <strong>Set</strong> mode matches expansion/set <strong>name and code</strong> only. Use the header
                    search dropdown on <strong>Card</strong> to match card name, number, rarity, and variant. Seller
                    listing title and description still apply. For full-catalog search, use the{' '}
                  </>
                ) : (
                  <>
                    <strong>Card</strong> mode matches <strong>card name, rarity, number, and variant</strong> — not set
                    or game. Use <strong>Set</strong> in the header dropdown to search by expansion. Seller title and
                    description still apply. For full-catalog search, use the{' '}
                  </>
                )}
                <Link to="/account/library" className="text-mint font-medium hover:underline">
                  Collectibles library
                </Link>
                .
              </p>
              {(q || hasUrlFilters) && (
                <p className="text-sm">
                  <button type="button" onClick={() => onFilterChange('clear')} className="text-mint font-medium hover:underline">
                    Reset all filters and search
                  </button>
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
