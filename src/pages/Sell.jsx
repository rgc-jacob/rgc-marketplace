import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { listingPath, LISTING_VIEW } from '../lib/listingView';
import { createSellerListing } from '../api/listings';

function parseCardRef(ref) {
  if (!ref) return null;
  const decoded = decodeURIComponent(ref.trim());
  const i = decoded.indexOf('|');
  if (i < 0) return { cardId: decoded, variantName: 'normal' };
  return {
    cardId: decoded.slice(0, i),
    variantName: decoded.slice(i + 1) || 'normal',
  };
}

const CONDITIONS = [
  'Near Mint',
  'Lightly Played',
  'Moderately Played',
  'Heavily Played',
  'Damaged',
];

/**
 * Publish a seller listing to Supabase `marketplace_listings`.
 * Auction-only flows are UI-only until a matching schema exists.
 */
export default function Sell() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const listingRef = searchParams.get('listing');
  const parsed = parseCardRef(listingRef || '');

  const [buyItNow, setBuyItNow] = useState(true);
  const [buyNowPrice, setBuyNowPrice] = useState('');
  const [bestOffer, setBestOffer] = useState(true);
  const [auction, setAuction] = useState(false);
  const [startingBid, setStartingBid] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('7');
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState('Near Mint');
  const [description, setDescription] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const handlePublish = async () => {
    setFormError('');
    setFormSuccess('');
    if (!parsed?.cardId) {
      setFormError('Open Sell from a card (e.g. My collection → List on marketplace) or include ?listing=cardId|variant in the URL.');
      return;
    }
    if (!buyItNow && !bestOffer && !auction) {
      setFormError('Select at least one option (Buy It Now, Best Offer, or Auction).');
      return;
    }
    if (buyNowPrice === '' || Number(buyNowPrice) < 0 || !Number.isFinite(Number(buyNowPrice))) {
      setFormError('Enter a valid list price in USD (required for every live listing).');
      return;
    }
    if (auction && !buyItNow) {
      setFormError('Auction-only listings are not saved yet. Enable Buy It Now, or turn off auction for now.');
      return;
    }

    setBusy(true);
    const res = await createSellerListing({
      cardId: parsed.cardId,
      variantName: parsed.variantName,
      titleOverride: titleOverride.trim() || null,
      description: description.trim() || null,
      conditionLabel: condition,
      priceUsd: buyNowPrice,
      quantity: Number(quantity) || 1,
      buyItNow,
      bestOffer,
      status: 'active',
    });
    setBusy(false);

    if (!res.ok) {
      setFormError(res.error || 'Could not create listing.');
      return;
    }
    setFormSuccess('Listing published.');
    navigate(`/listing/${res.data.id}`);
  };

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-ink-900 mb-2">List an item</h1>
      <p className="text-ink-500 text-sm mb-8">
        Set price and options. Listings are stored in Supabase and appear in browse (seller rows).
      </p>

      {listingRef && (
        <div className="mb-6 rounded-xl border border-mint/25 bg-mint/5 px-4 py-3 text-sm text-ink-700">
          <span className="font-medium text-mint">Card reference.</span>{' '}
          <Link
            to={listingPath(listingRef, LISTING_VIEW.collection)}
            className="text-mint font-medium hover:underline"
          >
            View card details
          </Link>
          {parsed?.cardId && (
            <span className="block text-xs text-ink-500 mt-1 font-mono">
              {parsed.cardId}|{parsed.variantName}
            </span>
          )}
        </div>
      )}

      {!listingRef && (
        <div className="mb-6 rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm text-ink-600">
          To list a specific card, open{' '}
          <Link to="/account/collection" className="text-mint font-medium hover:underline">My collection</Link>
          {' '}and use <strong>List on marketplace</strong>, or append{' '}
          <code className="text-xs bg-paper-200 px-1 rounded">?listing=YOUR_CARD_ID|normal</code> to this URL.
        </div>
      )}

      <section className="space-y-4 border border-paper-200 rounded-xl p-6 bg-white mb-6">
        <h2 className="text-lg font-semibold text-ink-900">Details</h2>
        <div>
          <label htmlFor="title-override" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
            Title override (optional)
          </label>
          <input
            id="title-override"
            type="text"
            value={titleOverride}
            onChange={(e) => setTitleOverride(e.target.value)}
            placeholder="Defaults to card name from catalog"
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="sell-desc" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
            Description (optional)
          </label>
          <textarea
            id="sell-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            placeholder="Condition notes, shipping, etc."
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sell-cond" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Condition
            </label>
            <select
              id="sell-cond"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sell-qty" className="block text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
              Quantity
            </label>
            <input
              id="sell-qty"
              type="number"
              min={1}
              max={9999}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="space-y-6 border border-paper-200 rounded-xl p-6 bg-white">
        <h2 className="text-lg font-semibold text-ink-900">Listing options</h2>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={buyItNow}
            onChange={(e) => setBuyItNow(e.target.checked)}
            className="mt-1 rounded border-paper-300 text-mint focus:ring-mint"
          />
          <div className="flex-1">
            <span className="font-medium text-ink-900">Buy It Now</span>
            <p className="text-sm text-ink-500 mt-0.5">Required to publish today — stored as the listing price.</p>
            {buyItNow && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-ink-600 text-sm">Price (USD)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={buyNowPrice}
                  onChange={(e) => setBuyNowPrice(e.target.value)}
                  className="w-28 rounded-lg border border-paper-200 px-3 py-2 text-sm font-mono text-ink-900"
                />
              </div>
            )}
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={bestOffer}
            onChange={(e) => setBestOffer(e.target.checked)}
            className="mt-1 rounded border-paper-300 text-foil focus:ring-foil"
          />
          <div className="flex-1">
            <span className="font-medium text-ink-900">Best Offer</span>
            <p className="text-sm text-ink-500 mt-0.5">Stored on the listing; offer workflow can be wired next.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={auction}
            onChange={(e) => setAuction(e.target.checked)}
            className="mt-1 rounded border-paper-300 text-ink-700 focus:ring-ink-500"
          />
          <div className="flex-1">
            <span className="font-medium text-ink-900">Auction (preview)</span>
            <p className="text-sm text-ink-500 mt-0.5">Not persisted yet — use Buy It Now to go live.</p>
            {auction && (
              <div className="mt-3 space-y-3 opacity-60 pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="text-ink-600 text-sm w-24">Starting bid</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={startingBid}
                    onChange={(e) => setStartingBid(e.target.value)}
                    className="w-28 rounded-lg border border-paper-200 px-3 py-2 text-sm font-mono text-ink-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-ink-600 text-sm w-24">Duration</span>
                  <select
                    value={auctionDuration}
                    onChange={(e) => setAuctionDuration(e.target.value)}
                    className="rounded-lg border border-paper-200 px-3 py-2 text-sm text-ink-900"
                  >
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </label>

        {!buyItNow && !bestOffer && !auction && (
          <p className="text-amber-700 text-sm">Select at least one option.</p>
        )}
      </section>

      {formError && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
      )}
      {formSuccess && (
        <p className="mt-4 text-sm text-mint bg-mint/10 border border-mint/20 rounded-lg px-3 py-2">{formSuccess}</p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={busy || (!buyItNow && !bestOffer && !auction)}
          className="px-6 py-3 rounded-xl bg-mint text-white font-medium hover:bg-mint-dark disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy ? 'Publishing…' : 'Publish listing'}
        </button>
        <Link to="/" className="px-6 py-3 rounded-xl border border-paper-200 text-ink-700 font-medium hover:bg-paper-100 transition">
          Cancel
        </Link>
      </div>

      <p className="text-xs text-ink-400 mt-8">
        You must be signed in. Duplicate active listings for the same card + variant + grading slot may be rejected by the database.
      </p>
    </main>
  );
}
