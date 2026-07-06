import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../contexts/AuthContext';

function describeNotification(n) {
  const p = n.payload || {};
  const title = p.listing_title || 'a listing';
  switch (n.type) {
    case 'offer_received':
      return `New offer of $${Number(p.amount ?? 0).toFixed(2)} on "${title}"`;
    case 'offer_accepted':
      return `Your offer on "${title}" was accepted`;
    case 'offer_declined':
      return `Your offer on "${title}" was declined`;
    case 'offer_countered':
      return `Seller countered your offer on "${title}"`;
    case 'auction_outbid':
      return `You were outbid on "${title}"`;
    case 'auction_won':
      return `You won the auction for "${title}" -- complete checkout`;
    case 'auction_reserve_not_met':
      return `Your auction for "${title}" ended without meeting reserve`;
    case 'order_paid':
      return `Payment received for "${title}"`;
    default:
      return n.type.replaceAll('_', ' ');
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { rows, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-ink-900 hover:text-foil rounded-lg"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-0.5 min-w-[1rem] h-4 px-1 flex items-center justify-center rounded-full bg-mint text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-w-[90vw] max-h-[70vh] overflow-y-auto rounded-lg border border-paper-200 bg-white shadow-card py-1 z-[60]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-paper-200">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-medium text-mint hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-sm text-ink-500 text-center">No notifications yet.</p>
          ) : (
            rows.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={`block w-full text-left px-3 py-2.5 text-sm border-b border-paper-100 last:border-0 transition-colors ${
                  n.read_at ? 'text-ink-500' : 'text-ink-900 bg-mint/5'
                }`}
              >
                <span className="block line-clamp-2">{describeNotification(n)}</span>
                <span className="block text-xs text-ink-400 mt-0.5">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
