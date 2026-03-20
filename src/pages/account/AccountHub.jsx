import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoginForm from './LoginForm';
import CollectionPage from './CollectionPage';
import LibraryPage from './LibraryPage';
import SellerDashboardPage from './SellerDashboardPage';

export default function AccountHub() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <main className="min-h-[40vh] flex items-center justify-center bg-charcoal px-4 py-24 text-center text-sm font-medium text-white">
        Loading…
      </main>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 shrink-0 space-y-6">
          <div className="rounded-xl border border-paper-200 bg-white p-4">
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Signed in</p>
            <p className="text-sm text-ink-900 font-medium truncate mt-1">{user.email}</p>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-3 text-sm text-mint hover:underline"
            >
              Sign out
            </button>
          </div>
          <nav className="flex flex-row lg:flex-col gap-1 flex-wrap lg:flex-nowrap">
            <NavLink
              to="/account/collection"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  isActive ? 'bg-mint/15 text-mint' : 'text-ink-900 hover:bg-charcoal/10'
                }`
              }
            >
              My collection
            </NavLink>
            <NavLink
              to="/account/library"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  isActive ? 'bg-mint/15 text-mint' : 'text-ink-900 hover:bg-charcoal/10'
                }`
              }
            >
              Collectibles library
            </NavLink>
            <NavLink
              to="/account/seller"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  isActive ? 'bg-mint/15 text-mint' : 'text-ink-900 hover:bg-charcoal/10'
                }`
              }
            >
              Seller dashboard
            </NavLink>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <Routes>
            <Route index element={<Navigate to="collection" replace />} />
            <Route path="collection" element={<CollectionPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="seller" element={<SellerDashboardPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
