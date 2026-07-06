import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingPath, LISTING_VIEW } from '../../lib/listingView';
import { supabase } from '../../lib/supabase';
import {
  getMySellerListings,
  updateSellerListing,
  cancelSellerListing,
  getTopMovers,
} from '../../api/listings';
import { getWatchlistCounts } from '../../api/watchlist';
import { useGames, gamesToDisplayNames } from '../../hooks/useGames';
import { CONDITIONS } from '../../data/games';

const PAGE_SIZE = 24;

const STATUS_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'draft', label: 'Draft' },
  { value: 'all', label: 'All' },
];

const STATUS_BADGE = {
  active: 'bg-mint/15 text-mint',
  sold: 'bg-ink-200 text-ink-800',
  cancelled: 'bg-red-100 text-red-700',
  draft: 'bg-amber-100 text-amber-800',
};

function expansionOf(card) {
  return Array.isArray(card?.expansions) ? card.expansions[0] : card?.expansions;
}

export default function SellerDashboardPage() {
  const { games } = useGames();
  const gameNames = useMemo(() => gamesToDisplayNames(games), [games]);

  // Market-context stats (marketplace-wide, not seller-specific -- kept as secondary info).
  const [pricedSkuCount, setPricedSkuCount] = useState(null);
  const [gamesCount, setGamesCount] = useState(null);
  const [topMovers, setTopMovers] = useState({ gainers: [], losers: [] });
  const [loadingStats, setLoadingStats] = useState(true);

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
    ])
      .then(([priceRes, gamesRes, movers]) => {
        if (c) return;
        setPricedSkuCount(priceRes.count ?? null);
        setGamesCount(gamesRes.count ?? null);
        setTopMovers(movers);
      })
      .finally(() => {
        if (!c) setLoadingStats(false);
      });
    return () => {
      c = true;
    };
  }, []);

  // The seller's own listings.
  const [myListings, setMyListings] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [listError, setListError] = useState(null);
  const [watcherCounts, setWatcherCounts] = useState({});

  const loadMyListings = useCallback(() => {
    setLoadingMine(true);
    setListError(null);
    getMySellerListings()
      .then((res) => {
        if (!res.ok) {
          setListError(res.error);
          setMyListings([]);
          return;
        }
        setMyListings(res.rows);
        getWatchlistCounts(res.rows.map((r) => r.id)).then(setWatcherCounts);
      })
      .finally(() => setLoadingMine(false));
  }, []);

  useEffect(() => {
    loadMyListings();
  }, [loadMyListings]);

  const [statusTab, setStatusTab] = useState('active');
  const [searchText, setSearchText] = useState('');
  const [filterGame, setFilterGame] = useState('');
  const [page, setPage] = useState(0);

  const tabCounts = useMemo(() => {
    const counts = { all: myListings.length };
    for (const r of myListings) counts[r.status] = (counts[r.status] || 0) + 1;
    return counts;
  }, [myListings]);

  const filtered = useMemo(() => {
    let rows = myListings;
    if (statusTab !== 'all') rows = rows.filter((r) => r.status === statusTab);
    const q = searchText.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => (r.title_override || r.card?.name || '').toLowerCase().includes(q));
    }
    if (filterGame) rows = rows.filter((r) => r.card?.game_id === filterGame);
    return rows;
  }, [myListings, statusTab, searchText, filterGame]);

  useEffect(() => {
    setPage(0);
  }, [statusTab, searchText, filterGame]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // Inline edit state.
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionError, setActionError] = useState('');

  const startEdit = (row) => {
    setActionError('');
    setEditingId(row.id);
    setEditForm({
      titleOverride: row.title_override || '',
      description: row.description || '',
      conditionLabel: row.condition_label || 'Near Mint',
      priceUsd: row.price_usd != null ? String(row.price_usd) : '',
      quantity: String(row.quantity ?? 1),
      buyItNow: row.buy_it_now !== false,
      bestOffer: row.best_offer === true,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async (id) => {
    const price = Number(editForm.priceUsd);
    if (!Number.isFinite(price) || price < 0) {
      setActionError('Enter a valid price.');
      return;
    }
    const qty = Math.max(1, Math.floor(Number(editForm.quantity)) || 1);
    setSavingEdit(true);
    setActionError('');
    const res = await updateSellerListing(id, {
      titleOverride: editForm.titleOverride.trim() || null,
      description: editForm.description.trim() || null,
      conditionLabel: editForm.conditionLabel,
      priceUsd: price,
      quantity: qty,
      buyItNow: editForm.buyItNow,
      bestOffer: editForm.bestOffer,
    });
    setSavingEdit(false);
    if (!res.ok) {
      setActionError(res.error || 'Could not save changes.');
      return;
    }
    setEditingId(null);
    setEditForm(null);
    loadMyListings();
  };

  const handleCancelListing = async (id) => {
    if (!window.confirm('Cancel this listing? It will no longer be visible in Browse.')) return;
    setActionError('');
    const res = await cancelSellerListing(id);
    if (!res.ok) {
      setActionError(res.error || 'Could not cancel listing.');
      return;
    }
    loadMyListings();
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900">Seller dashboard</h1>
        <p className="text-sm text-ink-500 mt-1">
          Your listings, at a glance -- edit price and details, cancel a listing, or see how many people
          are watching it.
        </p>
      </header>

      <div className="rounded-xl border border-paper-200 bg-white p-4 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusTab(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                statusTab === tab.value
                  ? 'bg-charcoal text-white'
                  : 'border border-paper-200 text-ink-700 hover:bg-paper-50'
              }`}
            >
              {tab.label}
              {tabCounts[tab.value] != null && (
                <span className="ml-1.5 text-xs opacity-75">({tabCounts[tab.value] || 0})</span>
              )}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label htmlFor="mine-q" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Search your listings
            </label>
            <input
              id="mine-q"
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
              placeholder="Filter by title…"
            />
          </div>
          <div>
            <label htmlFor="mine-game" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Game
            </label>
            <select
              id="mine-game"
              value={filterGame}
              onChange={(e) => setFilterGame(e.target.value)}
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
        </div>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {actionError}
        </p>
      )}
      {listError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {listError}
        </p>
      )}

      {loadingMine ? (
        <p className="text-sm py-8 inline-flex rounded-lg bg-charcoal px-4 py-2 font-medium text-white">
          Loading your listings…
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-500 py-8">
          {myListings.length === 0
            ? 'You have no listings yet.'
            : 'No listings match these filters.'}{' '}
          <Link to="/sell" className="text-mint font-medium hover:underline">
            List an item
          </Link>
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-paper-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-paper-200 text-left text-xs uppercase text-ink-500">
                  <th className="px-4 py-3 font-medium">Listing</th>
                  <th className="px-4 py-3 font-medium">Condition</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Watchers</th>
                  <th className="px-4 py-3 font-medium">Listed</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const card = row.card;
                  const expansion = expansionOf(card);
                  const title = row.title_override || card?.name || row.card_id;
                  const image = card?.image_medium || card?.image_small || '';
                  const isEditing = editingId === row.id;
                  const canEdit = row.status === 'active' || row.status === 'draft';
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-paper-100 hover:bg-paper-50 align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-14 shrink-0 rounded bg-charcoal/20 overflow-hidden">
                              {image && <img src={image} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={listingPath(row.id, LISTING_VIEW.marketplace)}
                                className="font-medium text-mint hover:underline line-clamp-2"
                              >
                                {title}
                              </Link>
                              <p className="text-xs text-ink-500 mt-0.5">
                                {gameNames[card?.game_id] || card?.game_id}
                                {expansion?.name ? ` · ${expansion.name}` : ''}
                                {expansion?.code ? ` (${expansion.code})` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-700">{row.condition_label || 'Near Mint'}</td>
                        <td className="px-4 py-3 text-right font-mono text-ink-900">
                          ${Number(row.price_usd).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-ink-700">{row.quantity}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${
                              STATUS_BADGE[row.status] || 'bg-paper-200 text-ink-700'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-ink-700 tabular-nums">
                          {watcherCounts[row.id] ?? 0}
                        </td>
                        <td className="px-4 py-3 text-ink-500 text-xs whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {canEdit ? (
                            <div className="flex items-center justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => (isEditing ? cancelEdit() : startEdit(row))}
                                className="text-xs font-medium text-mint hover:underline"
                              >
                                {isEditing ? 'Close' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelListing(row.id)}
                                className="text-xs font-medium text-red-600 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-400">—</span>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="border-b border-paper-200 bg-paper-50">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl">
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                                  Title override
                                </label>
                                <input
                                  type="text"
                                  value={editForm.titleOverride}
                                  onChange={(e) => setEditForm((f) => ({ ...f, titleOverride: e.target.value }))}
                                  placeholder={card?.name}
                                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                                  Condition
                                </label>
                                <select
                                  value={editForm.conditionLabel}
                                  onChange={(e) => setEditForm((f) => ({ ...f, conditionLabel: e.target.value }))}
                                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
                                >
                                  {CONDITIONS.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={9999}
                                  value={editForm.quantity}
                                  onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                                  Price (USD)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editForm.priceUsd}
                                  onChange={(e) => setEditForm((f) => ({ ...f, priceUsd: e.target.value }))}
                                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm font-mono"
                                />
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                                  Description
                                </label>
                                <textarea
                                  rows={2}
                                  value={editForm.description}
                                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="flex items-end gap-4">
                                <label className="inline-flex items-center gap-2 text-sm text-ink-700">
                                  <input
                                    type="checkbox"
                                    checked={editForm.buyItNow}
                                    onChange={(e) => setEditForm((f) => ({ ...f, buyItNow: e.target.checked }))}
                                    className="rounded border-paper-300 text-mint focus:ring-mint"
                                  />
                                  Buy It Now
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm text-ink-700">
                                  <input
                                    type="checkbox"
                                    checked={editForm.bestOffer}
                                    onChange={(e) => setEditForm((f) => ({ ...f, bestOffer: e.target.checked }))}
                                    className="rounded border-paper-300 text-foil focus:ring-foil"
                                  />
                                  Best Offer
                                </label>
                              </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                              <button
                                type="button"
                                disabled={savingEdit}
                                onClick={() => saveEdit(row.id)}
                                className="px-4 py-2 rounded-lg bg-mint text-white text-sm font-medium hover:bg-mint-dark disabled:opacity-50"
                              >
                                {savingEdit ? 'Saving…' : 'Save changes'}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="px-4 py-2 rounded-lg border border-paper-200 text-sm text-ink-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                type="button"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="text-sm font-medium text-mint disabled:text-ink-300 hover:underline"
              >
                Previous
              </button>
              <span className="text-sm text-ink-500">
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="text-sm font-medium text-mint disabled:text-ink-300 hover:underline"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
        <div className="sm:col-span-2 lg:col-span-3">
          <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide">Market context</h2>
          <p className="text-xs text-ink-400 mt-0.5">Marketplace-wide reference, not specific to your listings.</p>
        </div>
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
        <div className="rounded-xl border border-paper-200 bg-white p-5">
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
    </div>
  );
}
