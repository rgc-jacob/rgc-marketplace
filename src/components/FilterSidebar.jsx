import { CATEGORIES } from '../data/games';

export default function FilterSidebar({ filters, onFilterChange, games = [], expansions = [], expansionsLoading = false }) {
  const { game, expansion, category, condition, graded, priceMin, priceMax } = filters;

  return (
    <aside className="w-full lg:w-56 shrink-0">
      <div className="sticky top-24 space-y-6">
        <h3 className="font-semibold text-ink-900 text-sm uppercase tracking-wide">Filters</h3>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => onFilterChange('category', e.target.value)}
            className="w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Game</label>
          <select
            value={game}
            onChange={(e) => onFilterChange('game', e.target.value)}
            className="w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
          >
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.slug}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Set / expansion</label>
          <select
            value={expansion}
            onChange={(e) => onFilterChange('expansion', e.target.value)}
            disabled={!game || expansionsLoading}
            className="w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">{game ? 'All sets in this game' : 'Select a game first'}</option>
            {expansions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
                {ex.code ? ` (${ex.code})` : ''}
              </option>
            ))}
          </select>
          {game && expansionsLoading && (
            <p className="text-xs text-ink-500 mt-1">Loading sets…</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Condition</label>
          <select
            value={condition}
            onChange={(e) => onFilterChange('condition', e.target.value)}
            className="w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
          >
            <option value="">Any</option>
            <option value="new">New</option>
            <option value="nm">Near Mint</option>
            <option value="lp">Lightly Played</option>
            <option value="mp">Moderately Played</option>
            <option value="hp">Heavily Played</option>
            <option value="graded">Graded</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Graded</label>
          <select
            value={graded}
            onChange={(e) => onFilterChange('graded', e.target.value)}
            className="w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
          >
            <option value="">Any</option>
            <option value="yes">Graded only</option>
            <option value="no">Raw only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Price range</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={priceMin ?? ''}
              onChange={(e) => onFilterChange('priceMin', e.target.value ? Number(e.target.value) : '')}
              min={0}
              step={1}
              className="w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm font-mono text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
            />
            <input
              type="number"
              placeholder="Max"
              value={priceMax ?? ''}
              onChange={(e) => onFilterChange('priceMax', e.target.value ? Number(e.target.value) : '')}
              min={0}
              step={1}
              className="w-full rounded-lg border border-paper-200 bg-white px-3 py-2 text-sm font-mono text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onFilterChange('clear')}
          className="text-sm text-ink-500 hover:text-ink-900"
        >
          Clear all filters
        </button>
      </div>
    </aside>
  );
}
