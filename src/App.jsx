import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Browse from './pages/Browse';
import ListingDetail from './pages/ListingDetail';
import Sell from './pages/Sell';
import AccountHub from './pages/account/AccountHub';
import Cart from './pages/Cart';

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

function WatchlistPlaceholder() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
      <h1 className="text-2xl font-bold text-ink-900 mb-2">Watchlist</h1>
      <p className="text-ink-500">Save listings to track price and availability. (Coming soon.)</p>
    </main>
  );
}

function OrdersPlaceholder() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
      <h1 className="text-2xl font-bold text-ink-900 mb-2">Orders</h1>
      <p className="text-ink-500">View and track your orders. (Coming soon.)</p>
    </main>
  );
}

const routerBasename =
  import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/account/*" element={<AccountHub />} />
          <Route path="/watchlist" element={<WatchlistPlaceholder />} />
          <Route path="/orders" element={<OrdersPlaceholder />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
