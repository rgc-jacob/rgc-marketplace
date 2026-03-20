import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDebounced } from '../hooks/useDebounced';
import { useNavSearchSuggestions } from '../hooks/useNavSearchSuggestions';
import { gamesToDisplayNames } from '../hooks/useGames';
import { listingPath, LISTING_VIEW } from '../lib/listingView';
import { buildBrowsePath } from '../lib/browseUrl';

/**
 * Header search: `/browse` uses URL params (q, game, category, …) + `get_combined_browse_listings`.
 * Suggestions: games, categories, catalog FTS, RGC `/search/suggest`.
 */
export default function NavSearch({ games = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const lastUrlQRef = useRef(undefined);
  const debounced = useDebounced(search, 350);
  const { localGames, localCategories, catalogHits, apiStrings, loadingRemote } = useNavSearchSuggestions(
    debounced,
    games,
  );
  const gameLabels = useMemo(() => gamesToDisplayNames(games), [games]);

  const browseBaseSearch = location.pathname === '/browse' ? location.search : '';

  const mergeBrowse = (patch) => buildBrowsePath(browseBaseSearch, patch);

  // Only sync draft input when the URL `q` param actually changes (avoid wiping typing when `game`/`category` update).
  useEffect(() => {
    if (location.pathname !== '/browse') {
      lastUrlQRef.current = undefined;
      return;
    }
    const urlQ = new URLSearchParams(location.search).get('q') ?? '';
    if (lastUrlQRef.current !== urlQ) {
      lastUrlQRef.current = urlQ;
      setSearch(urlQ);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const suggestionRows = useMemo(() => {
    const rows = [];
    localGames.forEach((g) => {
      rows.push({
        id: `game-${g.slug}`,
        primary: g.name,
        secondary: 'Browse marketplace · Game',
        to: mergeBrowse({ game: g.slug }),
      });
    });
    localCategories.forEach((c) => {
      rows.push({
        id: `cat-${c.slug}`,
        primary: c.name,
        secondary: 'Browse marketplace · Category',
        to: mergeBrowse({ category: c.slug }),
      });
    });
    catalogHits.forEach((card) => {
      const exp = Array.isArray(card.expansions) ? card.expansions[0] : card.expansions;
      const variant = card.variant_name || 'normal';
      const lid = `${card.id}|${variant}`;
      const gameName = gameLabels[card.game_id] || card.game_id;
      rows.push({
        id: `lib-${lid}`,
        primary: card.name,
        secondary: `${gameName} · ${exp?.name || 'Set'} — Collectibles library`,
        to: listingPath(lid, LISTING_VIEW.library),
      });
    });
    apiStrings.forEach((s, i) => {
      rows.push({
        id: `sug-${i}-${s.slice(0, 24)}`,
        primary: s,
        secondary: 'Search marketplace (smart suggest)',
        to: mergeBrowse({ q: s }),
      });
    });
    return rows;
  }, [localGames, localCategories, catalogHits, apiStrings, gameLabels, browseBaseSearch]);

  const showPanel =
    open &&
    (localGames.length > 0 ||
      localCategories.length > 0 ||
      (debounced.trim().length >= 3 && (loadingRemote || catalogHits.length > 0 || apiStrings.length > 0)));

  useEffect(() => {
    if (!showPanel || suggestionRows.length === 0) {
      setActive(-1);
      return;
    }
    if (active >= suggestionRows.length) setActive(suggestionRows.length - 1);
  }, [showPanel, suggestionRows.length, active]);

  const go = (to) => {
    setOpen(false);
    setActive(-1);
    navigate(to);
  };

  const submitTextSearch = () => {
    const t = search.trim();
    if (location.pathname === '/browse') {
      go(mergeBrowse({ q: t }));
      return;
    }
    if (!t) return;
    go(`/browse?q=${encodeURIComponent(t)}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (showPanel && active >= 0 && suggestionRows[active]) {
      go(suggestionRows[active].to);
      return;
    }
    submitTextSearch();
  };

  const onKeyDown = (e) => {
    if (!showPanel || suggestionRows.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestionRows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestionRows.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <form ref={rootRef} onSubmit={handleSubmit} className="flex-1 max-w-2xl min-w-0 relative">
      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search cards, games, categories…"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={showPanel ? 'nav-search-suggestions' : undefined}
          aria-activedescendant={
            showPanel && active >= 0 ? `nav-sug-${suggestionRows[active]?.id}` : undefined
          }
          className="w-full h-10 pl-4 pr-10 rounded-lg border border-paper-200 bg-white text-ink-900 placeholder:text-ink-300 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-foil/30 focus:border-foil"
          aria-label="Search"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-900 hover:text-foil rounded"
          aria-label="Submit search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {showPanel && (
        <div
          id="nav-search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-[60] max-h-[min(70vh,22rem)] overflow-y-auto rounded-lg border border-paper-200 bg-white shadow-card py-1"
        >
          {debounced.trim().length >= 3 && loadingRemote && (
            <p className="px-3 py-2 text-xs text-ink-500">Loading catalog &amp; suggestions…</p>
          )}
          {suggestionRows.map((row, idx) => (
            <button
              key={row.id}
              type="button"
              role="option"
              id={`nav-sug-${row.id}`}
              aria-selected={idx === active}
              onMouseEnter={() => setActive(idx)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(row.to)}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                idx === active ? 'bg-paper-100 text-ink-900' : 'text-ink-900 hover:bg-paper-100/80'
              }`}
            >
              <span className="font-medium line-clamp-2">{row.primary}</span>
              <span className="block text-xs text-ink-500 mt-0.5 line-clamp-1">{row.secondary}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
