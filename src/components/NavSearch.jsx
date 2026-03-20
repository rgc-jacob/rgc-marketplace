import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDebounced } from '../hooks/useDebounced';
import { useNavSearchSuggestions } from '../hooks/useNavSearchSuggestions';
import { gamesToDisplayNames } from '../hooks/useGames';
import { buildBrowsePath } from '../lib/browseUrl';

function norm(s) {
  return (s || '').trim().toLowerCase();
}

function expansionName(card) {
  const exp = Array.isArray(card.expansions) ? card.expansions[0] : card.expansions;
  return exp?.name || '';
}

/** Card scope: name matches rank above set-only matches. */
function catalogHitsNameFirst(hits, query) {
  const q = norm(query);
  if (!q || !hits?.length) return hits || [];
  return [...hits].sort((a, b) => {
    const rank = (card) => {
      const nm = norm(card.name);
      if (nm.includes(q)) return 2;
      if (norm(expansionName(card)).includes(q)) return 0;
      return 1;
    };
    const d = rank(b) - rank(a);
    if (d !== 0) return d;
    return norm(a.name).localeCompare(norm(b.name));
  });
}

/** Set scope: expansion name/code match ranks above incidental card name matches. */
function catalogHitsSetFirst(hits, query) {
  const q = norm(query);
  if (!q || !hits?.length) return hits || [];
  return [...hits].sort((a, b) => {
    const rank = (card) => {
      const ex = norm(expansionName(card));
      if (ex.includes(q)) return 2;
      if (norm(card.name).includes(q)) return 0;
      return 1;
    };
    const d = rank(b) - rank(a);
    if (d !== 0) return d;
    return norm(expansionName(a)).localeCompare(norm(expansionName(b))) || norm(a.name).localeCompare(norm(b.name));
  });
}

function catalogHitsOrdered(hits, query, scope) {
  return scope === 'set' ? catalogHitsSetFirst(hits, query) : catalogHitsNameFirst(hits, query);
}

/**
 * Many suggest APIs return "Expansion / set — card name". Show card as primary when we can infer it.
 * Navigation still uses the full raw string as `q`.
 */
function suggestDisplayParts(raw, query) {
  const q = norm(query);
  const s = (raw || '').trim();
  const m = s.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (!m) {
    return { primary: s, secondary: 'Marketplace · smart suggest' };
  }
  const left = m[1].trim();
  const right = m[2].trim();
  const lN = norm(left);
  const rN = norm(right);
  const lHit = q && lN.includes(q);
  const rHit = q && rN.includes(q);
  if (rHit && !lHit) {
    return { primary: right, secondary: `${left} · Smart suggest` };
  }
  if (lHit && !rHit) {
    return { primary: left, secondary: `${right} · Smart suggest` };
  }
  return { primary: right, secondary: `${left} · Marketplace` };
}

/**
 * Header search: marketplace-first. Smart suggest + catalog matches open `/browse` with `q` (and game when known).
 * Library catalog is deprioritized for this flow.
 */
export default function NavSearch({ games = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  /** Scope when not on /browse (on /browse, URL `q_scope` is the source of truth). */
  const [scopeOffBrowse, setScopeOffBrowse] = useState('card');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const lastUrlQRef = useRef(undefined);
  const debounced = useDebounced(search, 350);

  const browseBaseSearch = location.pathname === '/browse' ? location.search : '';
  const scope =
    location.pathname === '/browse'
      ? new URLSearchParams(location.search).get('q_scope') === 'set'
        ? 'set'
        : 'card'
      : scopeOffBrowse === 'set'
        ? 'set'
        : 'card';

  const { catalogHits, apiStrings, loadingRemote } = useNavSearchSuggestions(debounced, scope);
  const gameLabels = useMemo(() => gamesToDisplayNames(games), [games]);

  const mergeBrowse = (patch) => buildBrowsePath(browseBaseSearch, patch);

  const patchScope = (s) => (s === 'set' ? { q_scope: 'set' } : { q_scope: null });

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
    const q = debounced.trim();
    const apiNorm = new Set(apiStrings.map((s) => norm(s)));

    apiStrings.forEach((s, i) => {
      const { primary, secondary } = suggestDisplayParts(s, q);
      rows.push({
        id: `sug-${i}-${s.slice(0, 24)}`,
        primary,
        secondary,
        to: buildBrowsePath(browseBaseSearch, { q: s, q_scope: null, expansion: null }),
      });
    });

    const seenExpansion = new Set();
    catalogHitsOrdered(catalogHits, q, scope).forEach((card) => {
      const exp = Array.isArray(card.expansions) ? card.expansions[0] : card.expansions;
      const variant = card.variant_name || 'normal';
      const lid = `${card.id}|${variant}`;
      const gameName = gameLabels[card.game_id] || card.game_id;
      const setLabel = exp?.name || 'Set';
      const eid = exp?.id;
      const gameSlug = games.find((x) => x.id === card.game_id)?.slug ?? card.game_id;

      if (scope === 'set') {
        if (eid && seenExpansion.has(eid)) return;
        if (eid) seenExpansion.add(eid);
        rows.push({
          id: eid ? `set-${eid}` : `cat-${lid}`,
          primary: setLabel,
          secondary: `${card.name} · ${gameName} — Browse listings`,
          to:
            eid != null && String(eid).trim() !== ''
              ? buildBrowsePath(browseBaseSearch, {
                  game: gameSlug,
                  expansion: String(eid),
                  q_scope: 'set',
                  q: null,
                })
              : buildBrowsePath(browseBaseSearch, {
                  q: setLabel,
                  game: gameSlug,
                  q_scope: 'set',
                  expansion: null,
                }),
        });
      } else {
        if (apiNorm.has(norm(card.name))) return;
        rows.push({
          id: `mkt-${lid}`,
          primary: card.name,
          secondary: `${gameName} · ${setLabel} — Browse listings`,
          to: buildBrowsePath(browseBaseSearch, {
            q: card.name,
            game: gameSlug,
            q_scope: null,
            expansion: null,
          }),
        });
      }
    });
    return rows;
  }, [catalogHits, apiStrings, gameLabels, games, browseBaseSearch, debounced, scope]);

  const showPanel =
    open &&
    debounced.trim().length >= 3 &&
    (loadingRemote || catalogHits.length > 0 || apiStrings.length > 0);

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
    const sp = patchScope(scope);
    if (location.pathname === '/browse') {
      // Drop stale expansion (sidebar / prior set search); it intersects with text match in RPC and hides valid hits.
      go(mergeBrowse({ ...sp, ...(t ? { q: t } : { q: '' }), expansion: null }));
      return;
    }
    if (!t) return;
    const qs = new URLSearchParams();
    qs.set('q', t);
    if (scope === 'set') qs.set('q_scope', 'set');
    go(`/browse?${qs.toString()}`);
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

  const placeholder =
    scope === 'set' ? 'Search by set or expansion…' : 'Search by card name, number, rarity…';

  return (
    <form
      ref={rootRef}
      onSubmit={handleSubmit}
      className="flex flex-1 max-w-2xl min-w-0 relative rounded-lg border border-paper-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-foil/30 focus-within:border-foil"
    >
      <label htmlFor="nav-search-scope" className="sr-only">
        Search in
      </label>
      <select
        id="nav-search-scope"
        value={scope}
        onChange={(e) => {
          const next = e.target.value === 'set' ? 'set' : 'card';
          if (location.pathname === '/browse') {
            navigate(mergeBrowse(patchScope(next)), { replace: true });
          } else {
            setScopeOffBrowse(next);
          }
          setOpen(true);
          setActive(-1);
        }}
        aria-label="Search in"
        className="shrink-0 h-10 max-w-[5.75rem] sm:max-w-[6.25rem] rounded-l-lg border-0 border-r border-paper-200 bg-paper-100/90 pl-2 pr-7 text-xs sm:text-sm font-semibold text-ink-800 focus:outline-none focus:ring-0 cursor-pointer appearance-none bg-[length:10px] bg-[right_6px_center] bg-no-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%232c3e50'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
        }}
      >
        <option value="card">Card</option>
        <option value="set">Set</option>
      </select>

      <div className="relative flex-1 min-w-0">
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
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={showPanel ? 'nav-search-suggestions' : undefined}
          aria-activedescendant={
            showPanel && active >= 0 ? `nav-sug-${suggestionRows[active]?.id}` : undefined
          }
          className="w-full h-10 pl-3 pr-10 rounded-r-lg border-0 bg-transparent text-ink-900 placeholder:text-ink-300 font-sans text-sm focus:outline-none focus:ring-0"
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
          {loadingRemote && (
            <p className="px-3 py-2 text-xs text-ink-500">Loading catalog{scope === 'card' ? ' & suggestions' : ''}…</p>
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
