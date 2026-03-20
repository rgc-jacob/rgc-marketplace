import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { setLineQuantity, removeFromCart, clearCart } from '../lib/cart';

export default function Cart() {
  const { lines, subtotal, refresh } = useCart();

  if (lines.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="text-2xl font-bold text-ink-900 mb-2">Your cart</h1>
        <p className="text-ink-500 mb-6">Your cart is empty.</p>
        <Link to="/browse" className="text-mint font-medium hover:underline">
          Browse listings
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-ink-900">Your cart</h1>
        <button
          type="button"
          onClick={() => { clearCart(); refresh(); }}
          className="text-sm text-ink-500 hover:text-red-600"
        >
          Clear all
        </button>
      </div>

      <ul className="space-y-4 mb-8">
        {lines.map((line) => (
          <li
            key={`${line.listingId}-${line.source}`}
            className="flex gap-4 p-4 rounded-xl border border-paper-200 bg-white"
          >
            <div className="w-16 h-24 shrink-0 rounded-lg bg-charcoal/25 overflow-hidden">
              {line.image ? (
                <img src={line.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-300 text-xs">—</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                to={`/listing/${encodeURIComponent(line.listingId)}`}
                className="font-medium text-ink-900 hover:text-mint line-clamp-2"
              >
                {line.title}
              </Link>
              <p className="text-xs text-ink-500 mt-0.5">
                {line.source === 'seller' ? 'Seller listing' : 'Market reference'}
              </p>
              <p className="font-mono text-sm text-ink-900 mt-2">
                ${Number(line.price).toFixed(2)} each
              </p>
              <div className="flex items-center gap-3 mt-2">
                <label className="text-xs text-ink-500 flex items-center gap-2">
                  Qty
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity}
                    onChange={(e) => {
                      setLineQuantity(line.listingId, line.source, e.target.value);
                      refresh();
                    }}
                    className="w-14 rounded border border-paper-200 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { removeFromCart(line.listingId, line.source); refresh(); }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-paper-200 pt-6 flex items-center justify-between">
        <span className="text-lg font-semibold text-ink-900">Subtotal</span>
        <span className="text-xl font-mono font-bold text-ink-900">${subtotal.toFixed(2)}</span>
      </div>
      <p className="text-xs text-ink-500 mt-4">
        Checkout and payment capture are not connected yet — this cart persists on this device for demo flows.
      </p>
      <Link
        to="/browse"
        className="mt-6 inline-block text-sm font-medium text-mint hover:underline"
      >
        Continue shopping
      </Link>
    </main>
  );
}
