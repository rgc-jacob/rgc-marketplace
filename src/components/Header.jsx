import { Link } from 'react-router-dom';
import { useState } from 'react';
import { CATEGORIES } from '../data/games';
import { useGames } from '../hooks/useGames';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../hooks/useCart';
import NavSearch from './NavSearch';

export default function Header() {
  const [gamesOpen, setGamesOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { games } = useGames();
  const { user } = useAuth();
  const { count: cartCount } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-paper-100/95 backdrop-blur border-b-2 border-foil shadow-[0_2px_0_0_rgba(44,62,80,0.15),0_10px_20px_-14px_rgba(44,62,80,0.55)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="RGC Marketplace">
            <img
              src="/rgc-logo.png"
              alt="RGC"
              className="h-8 sm:h-9 w-auto rounded-md"
            />
            <span className="hidden sm:inline-block text-[1.25rem] md:text-sm font-extrabold tracking-[0.15em] text-ink-900 leading-none">
              MARKETPLACE
            </span>
          </Link>

          <NavSearch games={games} />

          <nav className="hidden md:flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                onMouseEnter={() => { setGamesOpen(true); setCategoriesOpen(false); }}
                onMouseLeave={() => setGamesOpen(false)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  gamesOpen ? 'text-foil' : 'text-ink-900 hover:text-foil'
                }`}
              >
                Games
              </button>
              {gamesOpen && (
                <div
                  onMouseEnter={() => setGamesOpen(true)}
                  onMouseLeave={() => setGamesOpen(false)}
                  className="absolute left-0 top-full mt-0.5 w-56 py-2 bg-white rounded-lg border border-paper-200 shadow-card"
                >
                  {games.map((g) => (
                    <Link
                      key={g.id}
                      to={`/browse?game=${g.slug}`}
                      className="block px-4 py-2 text-sm text-ink-900 hover:text-foil transition-colors"
                    >
                      {g.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onMouseEnter={() => { setCategoriesOpen(true); setGamesOpen(false); }}
                onMouseLeave={() => setCategoriesOpen(false)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  categoriesOpen ? 'text-foil' : 'text-ink-900 hover:text-foil'
                }`}
              >
                Categories
              </button>
              {categoriesOpen && (
                <div
                  onMouseEnter={() => setCategoriesOpen(true)}
                  onMouseLeave={() => setCategoriesOpen(false)}
                  className="absolute left-0 top-full mt-0.5 w-56 py-2 bg-white rounded-lg border border-paper-200 shadow-card"
                >
                  {CATEGORIES.map((c) => (
                    <Link
                      key={c.id}
                      to={`/browse?category=${c.slug}`}
                      className="block px-4 py-2 text-sm text-ink-900 hover:text-foil transition-colors"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              to="/sell"
              className="px-3 py-2 text-sm font-medium text-ink-900 hover:text-foil rounded-lg transition-colors"
            >
              Sell
            </Link>
            <Link
              to="/cart"
              className="relative p-2 text-ink-900 hover:text-foil rounded-lg"
              aria-label="Cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute top-1 right-0.5 min-w-[1rem] h-4 px-1 flex items-center justify-center rounded-full bg-mint text-[10px] font-bold text-white leading-none">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <Link
              to={user ? '/account/collection' : '/account'}
              className="p-2 text-ink-900 hover:text-foil rounded-lg"
              aria-label="Account"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
