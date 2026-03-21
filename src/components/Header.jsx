import { Link, useLocation } from 'react-router-dom';
import { publicUrl } from '../lib/publicUrl';
import { useEffect, useState } from 'react';
import { CATEGORIES } from '../data/games';
import { useGames } from '../hooks/useGames';
import { isComingSoonLibraryGame } from '../data/comingSoonGames';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../hooks/useCart';
import NavSearch from './NavSearch';

export default function Header() {
  const location = useLocation();
  const [gamesOpen, setGamesOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileGamesOpen, setMobileGamesOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const { games } = useGames();
  const { user } = useAuth();
  const { count: cartCount } = useCart();

  const closeMobileNav = () => {
    setMobileNavOpen(false);
    setMobileGamesOpen(false);
    setMobileCategoriesOpen(false);
  };

  useEffect(() => {
    setMobileNavOpen(false);
    setMobileGamesOpen(false);
    setMobileCategoriesOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setMobileGamesOpen(false);
        setMobileCategoriesOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  return (
    <header className="sticky top-0 z-50">
      {/* backdrop-blur on <header> traps fixed children to header height; blur only the bar. */}
      <div className="bg-paper-100/95 backdrop-blur border-b-2 border-foil shadow-[0_2px_0_0_rgba(44,62,80,0.15),0_10px_20px_-14px_rgba(44,62,80,0.55)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="RGC Marketplace">
            <img
              src={publicUrl('rgc-logo.png')}
              alt="RGC"
              className="h-8 sm:h-9 w-auto rounded-md"
            />
            <span className="hidden sm:inline-block text-[1.25rem] md:text-sm font-extrabold tracking-[0.15em] text-ink-900 leading-none">
              MARKETPLACE
            </span>
          </Link>

          <NavSearch games={games} />

          <button
            type="button"
            className="md:hidden p-2 -mr-1 text-ink-900 hover:text-foil rounded-lg shrink-0"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-main-nav"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            onClick={() => (mobileNavOpen ? closeMobileNav() : setMobileNavOpen(true))}
          >
            {mobileNavOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

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
                  className="absolute left-0 top-full mt-0.5 min-w-[14rem] w-max max-w-[20rem] py-2 bg-white rounded-lg border border-paper-200 shadow-card"
                >
                  {games.map((g) =>
                    isComingSoonLibraryGame(g.id) ? (
                      <span
                        key={g.id}
                        className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-ink-400 cursor-default select-none"
                        aria-disabled="true"
                      >
                        <span className="truncate">{g.name}</span>
                        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                          Coming soon
                        </span>
                      </span>
                    ) : (
                      <Link
                        key={g.id}
                        to={`/browse?game=${g.slug}`}
                        className="block px-4 py-2 text-sm text-ink-900 hover:text-foil transition-colors"
                      >
                        {g.name}
                      </Link>
                    ),
                  )}
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
      </div>

      {mobileNavOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-14 sm:top-16 z-[60] bg-ink-900/40 md:hidden"
            aria-label="Close menu"
            onClick={closeMobileNav}
          />
          <div
            id="mobile-main-nav"
            className="fixed top-14 sm:top-16 left-0 right-0 bottom-0 z-[70] md:hidden bg-paper-100 border-t border-paper-200 flex flex-col min-h-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <nav className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-1">
              <div className="border-b border-paper-200 pb-2 mb-1">
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm font-semibold text-ink-900 rounded-lg px-1 -mx-1 hover:text-foil"
                  aria-expanded={mobileGamesOpen}
                  onClick={() => {
                    setMobileGamesOpen((v) => !v);
                    setMobileCategoriesOpen(false);
                  }}
                >
                  Games
                  <svg
                    className={`w-5 h-5 shrink-0 text-ink-500 transition-transform ${mobileGamesOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mobileGamesOpen && (
                  <div className="mt-1 flex flex-col gap-0.5 border-l-2 border-foil/30 pl-3 ml-1">
                    {games.map((g) =>
                      isComingSoonLibraryGame(g.id) ? (
                        <span
                          key={g.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-ink-400 cursor-default select-none"
                          aria-disabled="true"
                        >
                          <span className="truncate">{g.name}</span>
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                            Coming soon
                          </span>
                        </span>
                      ) : (
                        <Link
                          key={g.id}
                          to={`/browse?game=${g.slug}`}
                          onClick={closeMobileNav}
                          className="rounded-lg px-2 py-2 text-sm text-ink-800 hover:bg-white hover:text-foil transition-colors"
                        >
                          {g.name}
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="border-b border-paper-200 pb-2 mb-1">
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm font-semibold text-ink-900 rounded-lg px-1 -mx-1 hover:text-foil"
                  aria-expanded={mobileCategoriesOpen}
                  onClick={() => {
                    setMobileCategoriesOpen((v) => !v);
                    setMobileGamesOpen(false);
                  }}
                >
                  Categories
                  <svg
                    className={`w-5 h-5 shrink-0 text-ink-500 transition-transform ${mobileCategoriesOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mobileCategoriesOpen && (
                  <div className="mt-1 flex flex-col gap-0.5 border-l-2 border-foil/30 pl-3 ml-1">
                    {CATEGORIES.map((c) => (
                      <Link
                        key={c.id}
                        to={`/browse?category=${c.slug}`}
                        onClick={closeMobileNav}
                        className="rounded-lg px-2 py-2 text-sm text-ink-800 hover:bg-white hover:text-foil transition-colors"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                to="/sell"
                onClick={closeMobileNav}
                className="flex items-center gap-3 rounded-lg py-2.5 px-1 -mx-1 text-sm font-semibold text-ink-900 hover:bg-white hover:text-foil transition-colors"
              >
                Sell
              </Link>
              <Link
                to="/cart"
                onClick={closeMobileNav}
                className="relative flex items-center gap-3 rounded-lg py-2.5 px-1 -mx-1 text-sm font-semibold text-ink-900 hover:bg-white hover:text-foil transition-colors"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Cart
                {cartCount > 0 && (
                  <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-mint text-xs font-bold text-white leading-none">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
              <Link
                to={user ? '/account/collection' : '/account'}
                onClick={closeMobileNav}
                className="flex items-center gap-3 rounded-lg py-2.5 px-1 -mx-1 text-sm font-semibold text-ink-900 hover:bg-white hover:text-foil transition-colors"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </Link>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
