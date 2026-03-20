import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingPath, LISTING_VIEW } from '../../lib/listingView';
import {
  getCollectionsWithMarketStats,
  getCollectionCardsFiltered,
  searchUserCardsAcrossCollections,
} from '../../api/collections';
import { useGames } from '../../hooks/useGames';
import { useDebounced } from '../../hooks/useDebounced';

const PAGE_SIZE = 36;

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Recently added' },
  { value: 'declared_value', label: 'Declared value' },
  { value: 'purchase_price', label: 'Purchase price' },
  { value: 'updated_at', label: 'Recently updated' },
];

function cardLinkId(row) {
  const vid = row.variant_name || 'normal';
  const cid = row.card_id;
  if (!cid) return null;
  return `${cid}|${vid}`;
}

function titleFromRow(row) {
  if (row.card_name) return row.card_name;
  const d = row.card_data;
  if (d && typeof d === 'object' && d.name) return d.name;
  return row.card_id || 'Card';
}

function imageFromRow(row) {
  if (row.image_url) return row.image_url;
  const d = row.card_data;
  if (d && typeof d === 'object') {
    return d.image_medium || d.image_small || d.image_large || '';
  }
  return '';
}

export default function CollectionPage() {
  const { games } = useGames();
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [scope, setScope] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounced(searchInput, 400);
  const [franchiseFilter, setFranchiseFilter] = useState('');
  const [selectedGames, setSelectedGames] = useState(() => new Set());
  const [gradedStatus, setGradedStatus] = useState('all');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let c = false;
    setCollectionsLoading(true);
    getCollectionsWithMarketStats().then((data) => {
      if (!c) setCollections(data);
    }).finally(() => {
      if (!c) setCollectionsLoading(false);
    });
    return () => { c = true; };
  }, []);

  const collectionId = scope !== 'all' ? scope : null;

  const toggleGame = useCallback((slug) => {
    setSelectedGames((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    setPage(0);
  }, []);

  const franchisesArray = useMemo(() => {
    const arr = [...selectedGames];
    return arr.length ? arr : null;
  }, [selectedGames]);

  useEffect(() => {
    setPage(0);
  }, [
    scope,
    debouncedSearch,
    franchiseFilter,
    gradedStatus,
    minValue,
    maxValue,
    sortBy,
    sortAsc,
    selectedGames,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    const run = async () => {
      const offset = page * PAGE_SIZE;
      const minV = minValue === '' ? null : Number(minValue);
      const maxV = maxValue === '' ? null : Number(maxValue);
      const minOk = minV != null && Number.isFinite(minV) ? minV : null;
      const maxOk = maxV != null && Number.isFinite(maxV) ? maxV : null;

      if (scope === 'all') {
        const { rows: r, totalCount: t, error } = await searchUserCardsAcrossCollections({
          searchQuery: debouncedSearch.trim(),
          franchise: franchiseFilter || null,
          limit: PAGE_SIZE,
          offset,
        });
        if (cancelled) return;
        if (error) setFetchError(error.message || String(error));
        setRows(r);
        setTotalCount(t);
        return;
      }

      const { rows: r, totalCount: t, error } = await getCollectionCardsFiltered({
        collectionId,
        searchQuery: debouncedSearch.trim() || null,
        franchises: franchisesArray,
        sets: null,
        gradedStatus,
        minValue: minOk,
        maxValue: maxOk,
        sortBy,
        sortAscending: sortAsc,
        limit: PAGE_SIZE,
        offset,
      });
      if (cancelled) return;
      if (error) setFetchError(error.message || String(error));
      setRows(r);
      setTotalCount(t);
    };

    run().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [
    scope,
    collectionId,
    page,
    debouncedSearch,
    franchiseFilter,
    franchisesArray,
    gradedStatus,
    minValue,
    maxValue,
    sortBy,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1);
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900">My collection</h1>
        <p className="text-sm text-ink-500 mt-1">
          Search and filter cards across your RGC collections. Data comes from your synced mobile collections.
        </p>
      </header>

      <div className="rounded-xl border border-paper-200 bg-white p-4 sm:p-6 mb-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="coll-scope" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Collection
            </label>
            <select
              id="coll-scope"
              value={scope}
              onChange={(e) => { setScope(e.target.value); setPage(0); }}
              disabled={collectionsLoading}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30"
            >
              <option value="all">All collections</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.total_cards != null ? ` (${c.total_cards} cards)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="coll-search" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Search
            </label>
            <input
              id="coll-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Card name…"
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30"
            />
          </div>
        </div>

        {scope === 'all' ? (
          <div>
            <label htmlFor="coll-fr" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Game (franchise)
            </label>
            <select
              id="coll-fr"
              value={franchiseFilter}
              onChange={(e) => { setFranchiseFilter(e.target.value); setPage(0); }}
              className="w-full max-w-md rounded-lg border border-paper-200 px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30"
            >
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">
                Filter by game (multi)
              </p>
              <div className="flex flex-wrap gap-2">
                {games.map((g) => (
                  <label
                    key={g.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${
                      selectedGames.has(g.slug)
                        ? 'border-mint bg-mint/10 text-mint'
                        : 'border-paper-200 text-ink-700 hover:bg-paper-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-paper-200 text-mint focus:ring-foil/30"
                      checked={selectedGames.has(g.slug)}
                      onChange={() => toggleGame(g.slug)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="graded" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                  Graded
                </label>
                <select
                  id="graded"
                  value={gradedStatus}
                  onChange={(e) => setGradedStatus(e.target.value)}
                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="graded">Graded only</option>
                  <option value="raw">Raw only</option>
                </select>
              </div>
              <div>
                <label htmlFor="minv" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                  Min value
                </label>
                <input
                  id="minv"
                  type="number"
                  min={0}
                  step="0.01"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
                  placeholder="Any"
                />
              </div>
              <div>
                <label htmlFor="maxv" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                  Max value
                </label>
                <input
                  id="maxv"
                  type="number"
                  min={0}
                  step="0.01"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
                  placeholder="Any"
                />
              </div>
              <div>
                <label htmlFor="sort" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                  Sort by
                </label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={sortAsc}
                onChange={(e) => setSortAsc(e.target.checked)}
                className="rounded border-paper-200 text-mint focus:ring-foil/30"
              />
              Ascending order
            </label>
          </>
        )}
      </div>

      {fetchError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {fetchError}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-charcoal/35 bg-charcoal/45 aspect-[5/7] animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center py-16 text-ink-500 text-sm">
          No cards match these filters. Try another collection or clear search.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-500 mb-4">
            {totalCount} {totalCount === 1 ? 'card' : 'cards'}
            {scope !== 'all' && collections.find((c) => c.id === scope)?.name
              ? ` in “${collections.find((c) => c.id === scope).name}”`
              : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {rows.map((row) => {
              const lid = cardLinkId(row);
              const inner = (
                <>
                  <div className="aspect-[5/7] bg-paper-100 rounded-t-xl overflow-hidden">
                    {imageFromRow(row) ? (
                      <img
                        src={imageFromRow(row)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-300 text-xs p-2 text-center">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-paper-200">
                    <p className="text-sm font-medium text-ink-900 line-clamp-2">{titleFromRow(row)}</p>
                    {row.set_name && (
                      <p className="text-xs text-ink-500 mt-0.5 truncate">{row.set_name}</p>
                    )}
                    {row.collection_name && scope === 'all' && (
                      <p className="text-xs text-mint mt-1 truncate">{row.collection_name}</p>
                    )}
                    <div className="flex flex-wrap gap-x-2 mt-2 text-xs text-ink-600">
                      {row.quantity != null && row.quantity > 1 && <span>×{row.quantity}</span>}
                      {row.is_graded && (
                        <span className="text-foil">
                          {row.grading_company || 'Graded'}
                          {row.grade != null ? ` ${row.grade}` : ''}
                        </span>
                      )}
                      {row.declared_value != null && (
                        <span className="font-mono">${Number(row.declared_value).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </>
              );
              return lid ? (
                <Link
                  key={row.id}
                  to={listingPath(lid, LISTING_VIEW.collection)}
                  className="rounded-xl border border-paper-200 bg-white overflow-hidden hover:shadow-cardHover transition text-left block"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={row.id}
                  className="rounded-xl border border-paper-200 bg-white overflow-hidden"
                >
                  {inner}
                </div>
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
                Page {page + 1} of {totalPages}
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
