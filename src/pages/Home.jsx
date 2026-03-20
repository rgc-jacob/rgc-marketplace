import { Link } from 'react-router-dom';
import { listingPath, LISTING_VIEW } from '../lib/listingView';
import { useEffect, useState } from 'react';
import GameGrid from '../components/GameGrid';
import ListingCard from '../components/ListingCard';
import { CATEGORIES } from '../data/games';
import { useGames, gamesToDisplayNames } from '../hooks/useGames';
import { getMarketplaceListings, getTopMovers } from '../api/listings';

export default function Home() {
  const { games, loading: gamesLoading } = useGames();
  const [featured, setFeatured] = useState([]);
  const [topMovers, setTopMovers] = useState({ gainers: [], losers: [] });
  const [listingsLoading, setListingsLoading] = useState(true);
  const [moversLoading, setMoversLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setListingsLoading(true);
    const gameNames = gamesToDisplayNames(games);
    getMarketplaceListings({
      limit: 12,
      offset: 0,
      gameDisplayNames: gameNames,
    })
      .then(({ listings }) => {
        if (!cancelled) setFeatured(listings);
      })
      .finally(() => {
        if (!cancelled) setListingsLoading(false);
      });
    return () => { cancelled = true; };
  }, [games]);

  useEffect(() => {
    let cancelled = false;
    setMoversLoading(true);
    getTopMovers(5)
      .then((data) => {
        if (!cancelled) setTopMovers(data);
      })
      .finally(() => {
        if (!cancelled) setMoversLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const showMovers =
    !moversLoading &&
    (topMovers.gainers?.length > 0 || topMovers.losers?.length > 0);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <section className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink-900 mb-2">
          The collectibles marketplace with collector's in mind
        </h1>
        <p className="text-ink-500 max-w-xl mx-auto">
          Built by collectors, for collectors - discover singles, sealed product, and graded cards with the trust, detail, and clarity serious collectors expect.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-ink-900 mb-4">Shop by game</h2>
        <GameGrid games={games} loading={gamesLoading} />
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-900">New & trending</h2>
          <Link to="/browse" className="text-sm font-medium text-mint hover:underline">
            View all
          </Link>
        </div>
        {listingsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-charcoal/35 bg-charcoal/45 aspect-[5/7] animate-pulse" />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="text-sm text-ink-500">No listings right now. Check your Supabase connection.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {showMovers && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-ink-900 mb-4">Top movers (7d)</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-mint mb-2">Biggest gainers</h3>
              <ul className="space-y-2">
                {topMovers.gainers.slice(0, 5).map((item) => (
                  <li key={item.card_id}>
                    <Link
                      to={listingPath(`${item.card_id}|normal`, LISTING_VIEW.trending)}
                      className="flex items-center gap-3 text-sm text-ink-700 hover:text-ink-900"
                    >
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                      )}
                      <span className="flex-1 truncate">{item.card_name}</span>
                      <span className="font-mono text-ink-900">${Number(item.current_price).toFixed(2)}</span>
                      <span className="text-green-600 text-xs">+{Number(item.change_percent).toFixed(1)}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink-500 mb-2">Biggest losers</h3>
              <ul className="space-y-2">
                {topMovers.losers.slice(0, 5).map((item) => (
                  <li key={item.card_id}>
                    <Link
                      to={listingPath(`${item.card_id}|normal`, LISTING_VIEW.trending)}
                      className="flex items-center gap-3 text-sm text-ink-700 hover:text-ink-900"
                    >
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                      )}
                      <span className="flex-1 truncate">{item.card_name}</span>
                      <span className="font-mono text-ink-900">${Number(item.current_price).toFixed(2)}</span>
                      <span className="text-red-600 text-xs">{Number(item.change_percent).toFixed(1)}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-ink-900 mb-4">Shop by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to={`/browse?category=${c.slug}`}
              className="rounded-xl border border-white/25 bg-foil p-4 hover:bg-foil-dark hover:shadow-card transition text-center"
            >
              <span className="font-medium text-white text-sm block">{c.name}</span>
              <span className="text-xs text-white/90 mt-0.5 block">{c.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-mint/10 border border-mint/20 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink-900 mb-2">Collector-focused</h2>
        <p className="text-ink-600 text-sm max-w-2xl mb-4">
          Set codes, rarity, and condition front and center. Graded cards clearly labeled. No clutter—just what you need to decide.
        </p>
        <Link
          to="/browse?graded=no"
          className="inline-flex items-center gap-2 text-sm font-medium text-mint hover:underline"
        >
          Browse raw singles
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>
    </main>
  );
}