import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { getListingById, isSellerListingId } from '../api/listings';
import { addToCart } from '../lib/cart';
import { useGames, gamesToDisplayNames } from '../hooks/useGames';
import { getListingViewFromSearch, LISTING_VIEW, listingPath } from '../lib/listingView';
import { isFavoriteListingId, toggleFavoriteListingId } from '../lib/favorites';
import { addCardToUserCollection } from '../api/userCardActions';

const DEFAULT_LISTING_OPTIONS = {
  buyItNow: true,
  bestOffer: true,
  auction: false,
  quantity: 1,
  currentBid: null,
  startingBid: null,
  endTime: null,
  bidCount: 0,
};

function parseListingCompositeId(decodedId) {
  if (isSellerListingId(decodedId)) {
    return { cardId: '', variantName: 'normal' };
  }
  const parts = decodedId.split('|');
  return { cardId: parts[0] || '', variantName: parts[1] || 'normal' };
}

export default function ListingDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const view = getListingViewFromSearch(searchParams);

  const decodedId = id ? decodeURIComponent(id) : '';
  const { cardId, variantName } = parseListingCompositeId(decodedId);

  const { games } = useGames();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [listingOptions, setListingOptions] = useState(DEFAULT_LISTING_OPTIONS);
  const [offerAmount, setOfferAmount] = useState('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [showBidModal, setShowBidModal] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [collectionMsg, setCollectionMsg] = useState('');
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [cartMsg, setCartMsg] = useState('');

  useEffect(() => {
    setFavorited(isFavoriteListingId(decodedId));
  }, [decodedId]);

  useEffect(() => {
    if (!decodedId) {
      setLoading(false);
      setError(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    const gameNames = gamesToDisplayNames(games);
    getListingById(decodedId, gameNames)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) {
          setListing(res.data);
          if (res.data.listing_options) {
            setListingOptions((prev) => ({ ...prev, ...res.data.listing_options }));
          }
          setError(false);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [decodedId, games]);

  const toggleFavorite = useCallback(() => {
    const next = toggleFavoriteListingId(decodedId);
    setFavorited(next);
  }, [decodedId]);

  const goSearchMarketplace = useCallback(() => {
    if (!listing) return;
    const q = encodeURIComponent(listing.title || '');
    const g = listing.gameSlug ? `&game=${encodeURIComponent(listing.gameSlug)}` : '';
    navigate(`/browse?q=${q}${g}`);
  }, [listing, navigate]);

  const handleAddToCollection = useCallback(async () => {
    const cid = listing?.card_id || cardId;
    const vn = listing?.variantName || variantName;
    if (!cid) return;
    setCollectionBusy(true);
    setCollectionMsg('');
    const res = await addCardToUserCollection({ cardId: cid, variantName: vn });
    setCollectionBusy(false);
    if (res.ok) {
      setCollectionMsg('Added to your collection.');
    } else {
      setCollectionMsg(res.error || 'Could not add card.');
    }
  }, [listing, cardId, variantName]);

  const handleAddToCart = useCallback(
    (qty = 1) => {
      if (!listing) return;
      const source = listing.source === 'seller' ? 'seller' : 'reference';
      const maxQ = listing.quantityAvailable ?? 1;
      const q = Math.min(Math.max(1, qty), maxQ);
      addToCart({
        listingId: listing.id,
        source,
        title: listing.title,
        price: Number(listing.price),
        image: listing.image,
        quantity: q,
      });
      setCartMsg(`Added ${q} to cart.`);
      setTimeout(() => setCartMsg(''), 3500);
    },
    [listing]
  );

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="h-5 w-64 rounded bg-charcoal/50 animate-pulse mb-6" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 aspect-[5/7] max-w-lg rounded-xl border border-charcoal/30 bg-charcoal/45 animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 w-32 rounded bg-charcoal/50 animate-pulse" />
            <div className="h-6 w-full rounded bg-charcoal/50 animate-pulse" />
            <div className="h-12 w-full rounded bg-charcoal/50 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
        <p className="text-ink-500">Listing not found.</p>
        <Link to="/browse" className="text-mint hover:underline mt-2 inline-block">Back to browse</Link>
      </main>
    );
  }

  const {
    title,
    price,
    condition,
    game,
    gameSlug,
    set,
    setCode,
    rarity,
    graded,
    grade,
    image,
    number,
    source: listingSource,
    sellerUsername,
    compositeCatalogId,
    quantityAvailable,
  } = listing;
  const priceNum = Number(price);
  const opts = listingOptions;

  const isMarketplace = view === LISTING_VIEW.marketplace;
  const isCollection = view === LISTING_VIEW.collection;
  const isLibrary = view === LISTING_VIEW.library;
  const isTrending = view === LISTING_VIEW.trending;
  const isCatalogLike = isLibrary || isTrending;

  const catalogIdForLinks = compositeCatalogId || decodedId;
  const marketplaceLink = listingPath(catalogIdForLinks, LISTING_VIEW.marketplace);
  const libraryLink = listingPath(catalogIdForLinks, LISTING_VIEW.library);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Contextual breadcrumb */}
      <nav className="text-sm text-ink-500 mb-2" aria-label="Breadcrumb">
        {isMarketplace && (
          <>
            <Link to="/browse" className="hover:text-ink-900">Collectible Card Games</Link>
            <span className="mx-2">›</span>
            <Link to="/browse?category=singles" className="hover:text-ink-900">Single Cards</Link>
            <span className="mx-2">›</span>
            <Link to={`/browse?game=${gameSlug}`} className="hover:text-ink-900">{game}</Link>
          </>
        )}
        {isCollection && (
          <>
            <Link to="/account/collection" className="hover:text-ink-900">Account</Link>
            <span className="mx-2">›</span>
            <Link to="/account/collection" className="hover:text-ink-900">My collection</Link>
          </>
        )}
        {isLibrary && (
          <>
            <Link to="/account/library" className="hover:text-ink-900">Account</Link>
            <span className="mx-2">›</span>
            <Link to="/account/library" className="hover:text-ink-900">Collectibles library</Link>
          </>
        )}
        {isTrending && (
          <>
            <Link to="/" className="hover:text-ink-900">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-ink-700">Top movers</span>
          </>
        )}
        <span className="mx-2">›</span>
        <span className="text-ink-900 truncate max-w-[200px] inline-block align-bottom" title={title}>{title}</span>
      </nav>

      {/* View mode badge */}
      <div className="mb-4">
        {isMarketplace && (
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-mint/15 text-mint border border-mint/25">
              Marketplace
            </span>
            {listingSource === 'seller' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-foil/15 text-foil-dark border border-foil/30">
                Seller listing
              </span>
            )}
            {listingSource === 'reference' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-paper-200 text-ink-700 border border-paper-300">
                Market reference
              </span>
            )}
          </span>
        )}
        {isCollection && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-foil/15 text-foil-dark border border-foil/30">
            Your collection
          </span>
        )}
        {isLibrary && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-paper-200 text-ink-800 border border-paper-300">
            Collectibles library
          </span>
        )}
        {isTrending && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-mint/10 text-mint border border-mint/20">
            Top movers · catalog
          </span>
        )}
        <p className="text-xs text-ink-500 mt-2 max-w-xl">
          {isMarketplace && listingSource === 'seller' && 'Live seller listing — price and quantity are set by the seller. Checkout runs when payments are connected.'}
          {isMarketplace && listingSource === 'reference' && 'Market reference price from aggregated data — use Buy / cart to start a checkout draft; final price may follow seller listings.'}
          {isCollection && 'You opened this card from your synced collection. List it or save it without leaving your inventory context.'}
          {isLibrary && 'Catalog reference — add to your collection or jump to marketplace search for this card.'}
          {isTrending && 'Opened from 7-day movers. Same tools as the library: add to collection or search the marketplace.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <div className="rounded-xl overflow-hidden border border-paper-200 bg-charcoal/20 aspect-[5/7] max-w-md">
              {image ? (
                <img src={image} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/90 text-sm font-medium bg-charcoal/35">No image</div>
              )}
            </div>
            <p className="text-xs text-ink-400 mt-2">Picture 1 of 1</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold text-ink-900">
                {isMarketplace && opts.buyItNow
                  ? `US $${priceNum.toFixed(2)}`
                  : isMarketplace && opts.auction
                    ? `US $${(opts.currentBid ?? opts.startingBid ?? priceNum).toFixed(2)}`
                    : `US $${priceNum.toFixed(2)}`}
              </span>
              {isMarketplace && opts.buyItNow && opts.bestOffer && (
                <span className="text-ink-500 text-sm">or Best Offer</span>
              )}
              {!isMarketplace && (
                <span className="text-ink-500 text-sm">reference price</span>
              )}
            </div>
            <p className="text-sm text-ink-500">
              Condition: <span className="text-ink-700">{condition}</span>
              {graded && grade && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-foil/20 text-foil-dark font-mono text-xs">{grade}</span>
              )}
            </p>
            {isMarketplace && listingSource === 'seller' && sellerUsername && (
              <p className="text-sm text-ink-600 mt-1">
                Seller: <span className="font-medium text-ink-900">@{sellerUsername}</span>
              </p>
            )}
            {isMarketplace && opts.quantity != null && (
              <p className="text-sm text-ink-500 mt-0.5">
                {listingSource === 'seller'
                  ? `Quantity available: ${quantityAvailable ?? opts.quantity}`
                  : opts.quantity > 10
                    ? 'More than 10 available'
                    : `${opts.quantity} available`}
              </p>
            )}
          </div>

          {isMarketplace && (
            <>
              <div className="flex flex-wrap gap-2">
                {opts.buyItNow && (
                  <span className="px-2 py-1 rounded bg-mint/15 text-mint text-xs font-medium">Buy It Now</span>
                )}
                {opts.bestOffer && (
                  <span className="px-2 py-1 rounded bg-foil/15 text-foil-dark text-xs font-medium">Best Offer</span>
                )}
                {opts.auction && (
                  <span className="px-2 py-1 rounded bg-ink-200 text-ink-700 text-xs font-medium">Auction</span>
                )}
              </div>

              <div className="space-y-3">
                {opts.buyItNow && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(1)}
                      className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-mint text-white font-medium hover:bg-mint-dark transition"
                    >
                      Buy It Now
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(1)}
                      className="flex-1 min-w-[140px] px-4 py-3 rounded-xl border-2 border-mint text-mint font-medium hover:bg-mint/10 transition"
                    >
                      Add to cart
                    </button>
                  </div>
                )}
                {cartMsg && (
                  <p className="text-sm text-mint font-medium">{cartMsg}</p>
                )}
                {opts.bestOffer && (
                  <button
                    type="button"
                    onClick={() => setShowOfferModal(true)}
                    className="w-full px-4 py-3 rounded-xl border border-paper-200 text-ink-700 font-medium hover:bg-paper-100 transition"
                  >
                    Make offer
                  </button>
                )}
                {opts.auction && (
                  <div className="space-y-2">
                    <p className="text-sm text-ink-500">
                      Current bid:{' '}
                      <span className="font-mono font-semibold text-ink-900">
                        US ${(opts.currentBid ?? opts.startingBid ?? priceNum).toFixed(2)}
                      </span>
                      {opts.bidCount != null && opts.bidCount > 0 && (
                        <span className="ml-2">({opts.bidCount} bid{opts.bidCount !== 1 ? 's' : ''})</span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowBidModal(true)}
                      className="w-full px-4 py-3 rounded-xl bg-ink-900 text-white font-medium hover:bg-ink-800 transition"
                    >
                      Place bid
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                    favorited
                      ? 'border-mint bg-mint/10 text-mint'
                      : 'border-paper-200 text-ink-600 hover:bg-paper-100'
                  }`}
                >
                  {favorited ? 'Saved to watchlist' : 'Add to watchlist'}
                </button>
              </div>

              <p className="text-xs text-ink-500 border-t border-paper-200 pt-4">
                Market reference price. When sellers list here, you’ll see “X sold” and “X watching.”
              </p>
            </>
          )}

          {isCollection && (
            <div className="space-y-3 rounded-xl border border-paper-200 bg-paper-50 p-4">
              <h2 className="text-sm font-semibold text-ink-900">Your card</h2>
              <p className="text-xs text-ink-600">
                Manage how this copy shows up in the marketplace. Favorites are saved on this device.
              </p>
              <Link
                to={`/sell?listing=${encodeURIComponent(decodedId)}`}
                className="block w-full text-center px-4 py-3 rounded-xl bg-mint text-white font-medium hover:bg-mint-dark transition"
              >
                List on marketplace
              </Link>
              <button
                type="button"
                onClick={toggleFavorite}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition ${
                  favorited
                    ? 'border-foil bg-foil/10 text-foil-dark'
                    : 'border-paper-200 text-ink-700 hover:bg-white'
                }`}
              >
                {favorited ? 'Favorited' : 'Add to favorites'}
              </button>
              <Link
                to={marketplaceLink}
                className="block w-full text-center px-4 py-2.5 rounded-xl border border-paper-200 text-sm text-mint font-medium hover:bg-white"
              >
                View as marketplace listing
              </Link>
            </div>
          )}

          {isCatalogLike && (
            <div className="space-y-3 rounded-xl border border-paper-200 bg-paper-50 p-4">
              <h2 className="text-sm font-semibold text-ink-900">Catalog actions</h2>
              <p className="text-xs text-ink-600">
                {isTrending
                  ? 'This card is trending by price change. Add it to your collection or open marketplace results for the same name.'
                  : 'This is a catalog card, not a seller listing. Add it to your synced collection or search priced listings.'}
              </p>
              <button
                type="button"
                disabled={collectionBusy}
                onClick={handleAddToCollection}
                className="w-full px-4 py-3 rounded-xl bg-mint text-white font-medium hover:bg-mint-dark transition disabled:opacity-50"
              >
                {collectionBusy ? 'Adding…' : 'Add to my collection'}
              </button>
              {collectionMsg && (
                <p className={`text-xs ${collectionMsg.startsWith('Added') ? 'text-mint' : 'text-red-600'}`}>
                  {collectionMsg}
                </p>
              )}
              <button
                type="button"
                onClick={goSearchMarketplace}
                className="w-full px-4 py-3 rounded-xl border-2 border-mint text-mint font-medium hover:bg-mint/10 transition"
              >
                Search marketplace for this card
              </button>
              <Link
                to={marketplaceLink}
                className="block w-full text-center px-4 py-2.5 rounded-xl border border-paper-200 text-sm text-ink-700 font-medium hover:bg-white"
              >
                Open marketplace-style detail
              </Link>
            </div>
          )}
        </div>
      </div>

      {isMarketplace && (
        <section className="mt-10 pt-8 border-t border-paper-200">
          <h2 className="text-lg font-semibold text-ink-900 mb-3">Shipping and returns</h2>
          <p className="text-sm text-ink-600">
            <strong>Shipping:</strong> Calculated at checkout. Free shipping on orders over $50 (when available).
          </p>
          <p className="text-sm text-ink-600 mt-1">
            <strong>Returns:</strong> 30 days returns. Buyer pays for return shipping unless the item is not as described.
          </p>
        </section>
      )}

      {(isCollection || isCatalogLike) && (
        <section className="mt-10 pt-8 border-t border-paper-200">
          <h2 className="text-lg font-semibold text-ink-900 mb-3">Checkout & shipping</h2>
          <p className="text-sm text-ink-600">
            Purchase flow and shipping apply to{' '}
            <Link to={marketplaceLink} className="text-mint font-medium hover:underline">marketplace listings</Link>
            . This view is for managing or discovering the card, not completing a sale.
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink-900 mb-3">Item specifics</h2>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex gap-2 py-1.5 border-b border-paper-200">
            <dt className="text-ink-500 w-36 shrink-0">Condition</dt>
            <dd className="text-ink-900">{condition}</dd>
          </div>
          <div className="flex gap-2 py-1.5 border-b border-paper-200">
            <dt className="text-ink-500 w-36 shrink-0">Card Size</dt>
            <dd className="text-ink-900">Standard</dd>
          </div>
          {set && (
            <div className="flex gap-2 py-1.5 border-b border-paper-200">
              <dt className="text-ink-500 w-36 shrink-0">Set</dt>
              <dd className="text-ink-900">
                {set}{' '}
                {setCode && <span className="font-mono text-ink-600">({setCode})</span>}
              </dd>
            </div>
          )}
          {rarity && (
            <div className="flex gap-2 py-1.5 border-b border-paper-200">
              <dt className="text-ink-500 w-36 shrink-0">Rarity</dt>
              <dd className="text-ink-900">{rarity}</dd>
            </div>
          )}
          <div className="flex gap-2 py-1.5 border-b border-paper-200">
            <dt className="text-ink-500 w-36 shrink-0">Game</dt>
            <dd className="text-ink-900">{game}</dd>
          </div>
          <div className="flex gap-2 py-1.5 border-b border-paper-200">
            <dt className="text-ink-500 w-36 shrink-0">Card Name</dt>
            <dd className="text-ink-900">{title}</dd>
          </div>
          {number && (
            <div className="flex gap-2 py-1.5 border-b border-paper-200">
              <dt className="text-ink-500 w-36 shrink-0">Number</dt>
              <dd className="text-ink-900 font-mono">{number}</dd>
            </div>
          )}
          <div className="flex gap-2 py-1.5 border-b border-paper-200">
            <dt className="text-ink-500 w-36 shrink-0">Graded</dt>
            <dd className="text-ink-900">
              {graded ? 'Yes' : 'No'}
              {grade ? ` (${grade})` : ''}
            </dd>
          </div>
        </dl>
      </section>

      {isMarketplace && (
        <section className="mt-10 pt-8 border-t border-paper-200">
          <h2 className="text-lg font-semibold text-ink-900 mb-3">About the seller</h2>
          <p className="text-sm text-ink-600">
            This view shows market price data. When you list items, buyers will see your username, feedback, and “Message seller” / “Seller’s other items” here.
          </p>
        </section>
      )}

      {(isCollection || isCatalogLike) && (
        <section className="mt-10 pt-8 border-t border-paper-200">
          <h2 className="text-lg font-semibold text-ink-900 mb-3">Seller information</h2>
          <p className="text-sm text-ink-600">
            Seller profiles appear on{' '}
            <Link to={marketplaceLink} className="text-mint font-medium hover:underline">marketplace</Link>
            {' '}listings. Use “List on marketplace” from your collection when you are ready to sell.
          </p>
        </section>
      )}

      <section className="mt-10 pt-8 border-t border-paper-200">
        <h2 className="text-lg font-semibold text-ink-900 mb-3">More to explore</h2>
        <ul className="flex flex-wrap gap-3 text-sm">
          <li>
            <Link to={`/browse?game=${gameSlug}`} className="text-mint hover:underline">
              {game} cards
            </Link>
          </li>
          <li>
            <Link to={libraryLink} className="text-mint hover:underline">
              Open in library view
            </Link>
          </li>
          <li>
            <Link to="/browse?category=singles" className="text-mint hover:underline">
              Single cards
            </Link>
          </li>
          <li>
            <Link to="/account/library" className="text-mint hover:underline">
              Collectibles library
            </Link>
          </li>
        </ul>
      </section>

      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50" onClick={() => setShowOfferModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900 mb-2">Make an offer</h3>
            <p className="text-sm text-ink-500 mb-4">
              Buy It Now price: ${priceNum.toFixed(2)}. Enter your offer (seller may accept, decline, or counter).
            </p>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Your offer (USD)"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-ink-900 mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowOfferModal(false)} className="flex-1 py-2 rounded-lg border border-paper-200 text-ink-700">Cancel</button>
              <button type="button" className="flex-1 py-2 rounded-lg bg-mint text-white font-medium">Submit offer</button>
            </div>
          </div>
        </div>
      )}

      {showBidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50" onClick={() => setShowBidModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900 mb-2">Place bid</h3>
            <p className="text-sm text-ink-500 mb-4">
              Current bid: US ${(opts.currentBid ?? opts.startingBid ?? priceNum).toFixed(2)}. Enter your bid (minimum increment applies).
            </p>
            <input
              type="number"
              step="0.01"
              min={(opts.currentBid ?? opts.startingBid ?? priceNum) + 0.01}
              placeholder="Your bid (USD)"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-ink-900 mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowBidModal(false)} className="flex-1 py-2 rounded-lg border border-paper-200 text-ink-700">Cancel</button>
              <button type="button" className="flex-1 py-2 rounded-lg bg-ink-900 text-white font-medium">Place bid</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
