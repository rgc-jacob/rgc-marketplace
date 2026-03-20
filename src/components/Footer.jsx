import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data/games';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/25 bg-foil text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold text-white mb-3">Shop by category</h3>
            <ul className="space-y-2">
              {CATEGORIES.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link to={`/browse?category=${c.slug}`} className="text-sm text-white/90 hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-3">Sell & support</h3>
            <ul className="space-y-2">
              <li><Link to="/sell" className="text-sm text-white/90 hover:text-white">Sell on RGC</Link></li>
              <li><a href="#authenticity" className="text-sm text-white/90 hover:text-white">Authenticity</a></li>
              <li><a href="#help" className="text-sm text-white/90 hover:text-white">Help</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-3">Account</h3>
            <ul className="space-y-2">
              <li><Link to="/account/collection" className="text-sm text-white/90 hover:text-white">My collection</Link></li>
              <li><Link to="/account/library" className="text-sm text-white/90 hover:text-white">Collectibles library</Link></li>
              <li><Link to="/account/seller" className="text-sm text-white/90 hover:text-white">Seller dashboard</Link></li>
              <li><Link to="/cart" className="text-sm text-white/90 hover:text-white">Cart</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm text-white/90">
              <strong className="text-white">RGC Marketplace</strong> — for collectors, by collectors. Singles, sealed, graded.
            </p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/25 text-center text-sm text-white/80">
          © {new Date().getFullYear()} RGC Marketplace. Not affiliated with any TCG publisher.
        </div>
      </div>
    </footer>
  );
}
