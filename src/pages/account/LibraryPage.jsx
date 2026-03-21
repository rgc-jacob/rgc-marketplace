import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingPath, LISTING_VIEW } from '../../lib/listingView';
import { searchCatalogCards, getExpansionsForGame } from '../../api/catalog';
import { useGames } from '../../hooks/useGames';
import { isComingSoonLibraryGame } from '../../data/comingSoonGames';
import { useDebounced } from '../../hooks/useDebounced';

const PAGE_SIZE = 48;

export default function LibraryPage() {
  const { games } = useGames();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 400);
  const [gameId, setGameId] = useState('');
  const [expansionId, setExpansionId] = useState('');
  const [expansions, setExpansions] = useState([]);
  const [rarity, setRarity] = useState('');
  const [baseOnly, setBaseOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId) {
      setExpansions([]);
      setExpansionId('');
      return;
    }
    let c = false;
    getExpansionsForGame(gameId).then((ex) => {
      if (!c) setExpansions(ex);
    });
    return () => { c = true; };
  }, [gameId]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, gameId, expansionId, rarity, baseOnly]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchCatalogCards({
      query: debouncedQuery,
      gameId: gameId || null,
      expansionId: expansionId || null,
      rarity: rarity.trim() || null,
      baseCardsOnly: baseOnly,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then(({ rows: r, totalCount: t, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message || String(err));
        setRows(r);
        setTotalCount(t);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, gameId, expansionId, rarity, baseOnly, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900">Collectibles library</h1>
        <p className="text-sm text-ink-500 mt-1">
          Search the full catalog (hundreds of thousands of cards) with full-text search, game, set, and rarity filters.
        </p>
      </header>

      <div className="rounded-xl border border-paper-200 bg-white p-4 sm:p-6 mb-6 space-y-4">
        {isComingSoonLibraryGame(gameId) && (
          <div className="rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 -mt-1">
            <p className="font-semibold">Collectible library coming soon</p>
            <p className="mt-1.5 leading-relaxed text-amber-950/95">
              The full <strong>{games.find((g) => g.slug === gameId || g.id === gameId)?.name ?? 'this game'}</strong>{' '}
              catalog isn’t available in RGC yet. Searches here may return few or no cards until we ship the
              library—thanks for your patience.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="lib-q" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
            Search catalog
          </label>
          <input
            id="lib-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: charizard, lightning energy, black lotus…"
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30"
          />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="lib-game" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Game
            </label>
            <select
              id="lib-game"
              value={gameId}
              onChange={(e) => { setGameId(e.target.value); setExpansionId(''); }}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            >
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lib-exp" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Set / expansion
            </label>
            <select
              id="lib-exp"
              value={expansionId}
              onChange={(e) => setExpansionId(e.target.value)}
              disabled={!gameId}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">All sets</option>
              {expansions.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}{ex.code ? ` (${ex.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lib-rarity" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Rarity contains
            </label>
            <input
              id="lib-rarity"
              type="text"
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              placeholder="e.g. Rare, Ultra"
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-ink-700 pb-2">
              <input
                type="checkbox"
                checked={baseOnly}
                onChange={(e) => setBaseOnly(e.target.checked)}
                className="rounded border-paper-200 text-mint focus:ring-foil/30"
              />
              Hide variant printings
            </label>
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-xl border border-charcoal/35 bg-charcoal/45 aspect-[5/7] animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center py-16 text-ink-500 text-sm">
          No cards match. Broaden search or clear filters.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-500 mb-4">
            Showing {rows.length} of {totalCount.toLocaleString()} matching cards
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {rows.map((card) => {
              const exp = Array.isArray(card.expansions) ? card.expansions[0] : card.expansions;
              const variant = card.variant_name || 'normal';
              const lid = `${card.id}|${variant}`;
              const img = card.image_medium || card.image_small || '';
              return (
                <Link
                  key={`${card.id}-${variant}`}
                  to={listingPath(lid, LISTING_VIEW.library)}
                  className="rounded-xl border border-paper-200 bg-white overflow-hidden hover:shadow-cardHover transition text-left block"
                >
                  <div className="aspect-[5/7] bg-paper-100 overflow-hidden">
                    {img ? (
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-300 text-xs p-2 text-center">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-paper-200">
                    <p className="text-sm font-medium text-ink-900 line-clamp-2">{card.name}</p>
                    <p className="text-xs text-ink-500 mt-0.5 truncate">
                      {exp?.name || card.expansion_id}
                      {card.number ? ` · #${card.number}` : ''}
                    </p>
                    {card.rarity && (
                      <p className="text-xs text-foil mt-1 truncate">{card.rarity}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="text-sm font-medium text-mint disabled:text-ink-300 hover:underline"
              >
                Previous
              </button>
              <span className="text-sm text-ink-500">
                Page {page + 1} of {totalPages.toLocaleString()}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="text-sm font-medium text-mint disabled:text-ink-300 hover:underline"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
