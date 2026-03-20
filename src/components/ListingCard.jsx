import { Link } from 'react-router-dom';
import { listingPath, LISTING_VIEW } from '../lib/listingView';

export default function ListingCard({ listing, detailView = LISTING_VIEW.marketplace }) {
  const {
    id,
    title,
    price,
    condition,
    game,
    setCode,
    rarity,
    graded,
    grade,
    image,
    source,
  } = listing;
  const to = listingPath(id, detailView);
  const isSeller = source === 'seller';

  return (
    <Link
      to={to}
      className="group block bg-white rounded-xl border border-paper-200 overflow-hidden shadow-card hover:shadow-cardHover transition-shadow"
    >
      <div className="aspect-[5/7] bg-charcoal/25 relative overflow-hidden">
        {isSeller && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-foil text-ink-900 z-10">
            Seller
          </span>
        )}
        <img
          src={image}
          alt=""
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
        />
        {graded && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-mono font-medium bg-foil text-ink-900">
            {grade}
          </span>
        )}
        {setCode && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-mono bg-ink-900/80 text-white">
            {setCode}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-medium text-mint mb-0.5">{game}</p>
        <h3 className="font-medium text-ink-900 text-sm line-clamp-2 mb-1.5">{title}</h3>
        {rarity && (
          <p className="text-xs text-ink-500 mb-1">{rarity}</p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-mono font-semibold text-ink-900">${price.toFixed(2)}</span>
          <span className="text-xs text-ink-400">{condition}</span>
        </div>
      </div>
    </Link>
  );
}
