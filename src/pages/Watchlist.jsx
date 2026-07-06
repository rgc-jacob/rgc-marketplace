import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import { useGames, gamesToDisplayNames } from '../hooks/useGames';
import { useWatchlist } from '../hooks/useWatchlist';
import { getWatchlist } from '../api/watchlist';
import { getListingSummariesByKeys } from '../api/listings';
import { getAllFavoriteListingIds } from '../lib/favorites';

export default function Watchlist() {
  const { games } = useGames();
  const { signedIn } = useWatchlist();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const gameNames = gamesToDisplayNames(games);

    const loadKeys = signedIn
      ? getWatchlist().then(({ rows }) => rows.map((r) => r.listing_key))
      : Promise.resolve(getAllFavoriteListingIds());

    loadKeys
      .then((keys) => getListingSummariesByKeys(keys, gameNames))
      .then((rows) => {
        if (!cancelled) setListings(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, games]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-ink-900 mb-2">Watchlist</h1>
      <p className="text-ink-500 mb-8 text-sm">
        {signedIn
          ? 'Saved listings, synced to your account.'
          : 'Saved on this device. Sign in to sync your watchlist across devices.'}
      </p>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-charcoal/35 bg-charcoal/45 aspect-[5/7] animate-pulse" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-ink-500 space-y-3">
          <p>Nothing saved yet.</p>
          <Link to="/browse" className="text-mint font-medium hover:underline">
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </main>
  );
}
