import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingPath, LISTING_VIEW } from '../../lib/listingView';
import { supabase } from '../../lib/supabase';
import { getMarketplaceListings, getTopMovers } from '../../api/listings';
import { useGames, gamesToDisplayNames } from '../../hooks/useGames';

const PAGE_SIZE = 24;

export default function SellerDashboardPage() {
  const { games } = useGames();
  const gameNames = useMemo(() => gamesToDisplayNames(games), [games]);

  const [pricedSkuCount, setPricedSkuCount] = useState(null);
  const [gamesCount, setGamesCount] = useState(null);
  const [topMovers, setTopMovers] = useState({ gainers: [], losers: [] });
  const [listings, setListings] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [page, setPage] = useState(0);
  const [mayHaveMore, setMayHaveMore] = useState(false);
  const [query, setQuery] = useState('');
  const [gameId, setGameId] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    let c = false;
    setLoadingStats(true);
    Promise.all([
      supabase
        .from('card_prices_current')
        .select('card_id', { count: 'exact', head: true })
        .gt('raw_nm', 0),
      supabase.from('games').select('id', { count: 'exact', head: true }),
      getTopMovers(6),
    ]).then(([priceRes, gamesRes, movers]) => {
      if (c) return;
      setPricedSkuCount(priceRes.count ?? null);
      setGamesCount(gamesRes.count ?? null);
      setTopMovers(movers);
    }).finally(() => {
      if (!c) setLoadingStats(false);
    });
    return () => { c = true; };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [query, gameId, minPrice, maxPrice]);

  useEffect(() => {
    let cancelled = false;
    setLoadingTable(true);
    getMarketplaceListings({
      query: query.trim() || null,
      gameId: gameId || null,
      minPrice: (() => {
        if (minPrice === '') return null;
        const n = Number(minPrice);
        return Number.isFinite(n) ? n : null;
      })(),
      maxPrice: (() => {
        if (maxPrice === '') return null;
        const n = Number(maxPrice);
        return Number.isFinite(n) ? n : null;
      })(),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      gameDisplayNames: gameNames,
    })
      .then(({ listings: data, mayHaveMore: more }) => {
        if (!cancelled) {
          setListings(data);
          setMayHaveMore(more);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTable(false);
      });
    return () => { cancelled = true; };
  }, [query, gameId, minPrice, maxPrice, page, gameNames]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900">Seller dashboard</h1>
        <p className="text-sm text-ink-500 mt-1">
          Marketplace-wide view: priced inventory footprint, price movers, and filterable listings you can cross-check against the public browse experience.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-paper-200 bg-white p-5">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Priced SKUs (raw NM)</p>
          <p className="text-2xl font-mono font-semibold text-ink-900 mt-2">
            {loadingStats ? '…' : pricedSkuCount != null ? pricedSkuCount.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-ink-500 mt-2">Rows in card_prices_current with raw_nm &gt; 0</p>
        </div>
        <div className="rounded-xl border border-paper-200 bg-white p-5">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Games in catalog</p>
          <p className="text-2xl font-mono font-semibold text-ink-900 mt-2">
            {loadingStats ? '…' : gamesCount != null ? gamesCount.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-ink-500 mt-2">From games table</p>
        </div>
        <div className="rounded-xl border border-paper-200 bg-white p-5 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">7d volatility</p>
          <p
            className={
              loadingStats
                ? 'text-sm mt-2 inline-flex rounded-lg bg-charcoal px-3 py-1.5 font-medium text-white'
                : 'text-sm text-ink-700 mt-2'
            }
          >
            {loadingStats
              ? 'Loading movers…'
              : `${topMovers.gainers?.length || 0} gainers · ${topMovers.losers?.length || 0} losers in sample`}
          </p>
          <Link to="/" className="text-xs text-mint font-medium hover:underline mt-2 inline-block">
            View on home →
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-paper-200 bg-white p-4 sm:p-6 mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">Marketplace listings explorer</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label htmlFor="sell-q" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Search card name
            </label>
            <input
              id="sell-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
              placeholder="Filter by name…"
            />
          </div>
          <div>
            <label htmlFor="sell-game" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Game
            </label>
            <select
              id="sell-game"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {games.map((g) => (
                <option key={g.id} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="sell-min" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                Min $
              </label>
              <input
                id="sell-min"
                type="number"
                min={0}
                step="0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full rounded-lg border border-paper-200 px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="sell-max" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                Max $
              </label>
              <input
                id="sell-max"
                type="number"
                min={0}
                step="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full rounded-lg border border-paper-200 px-2 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {loadingTable ? (
        <p className="text-sm py-8 inline-flex rounded-lg bg-charcoal px-4 py-2 font-medium text-white">
          Loading listings…
        </p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-ink-500 py-8">No listings match these filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-paper-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-paper-200 text-left text-xs uppercase text-ink-500">
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">Game</th>
                  <th className="px-4 py-3 font-medium">Set</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((row) => (
                  <tr key={row.id} className="border-b border-paper-100 hover:bg-paper-50">
                    <td className="px-4 py-3">
                      <Link
                        to={listingPath(row.id, LISTING_VIEW.marketplace)}
                        className="font-medium text-mint hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{row.game}</td>
                    <td className="px-4 py-3 text-ink-600 truncate max-w-[200px]">{row.set || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-900">
                      ${Number(row.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-ink-500 text-xs whitespace-nowrap">
                      {row.recorded_at
                        ? new Date(row.recorded_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="text-sm font-medium text-mint disabled:text-ink-300 hover:underline"
            >
              Previous
            </button>
            <span className="text-sm text-ink-500">Page {page + 1}</span>
            <button
              type="button"
              disabled={!mayHaveMore}
              onClick={() => setPage((p) => p + 1)}
              className="text-sm font-medium text-mint disabled:text-ink-300 hover:underline"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
