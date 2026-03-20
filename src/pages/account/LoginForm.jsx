import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) setError(err.message);
      } else {
        const { error: err } = await signUp(email.trim(), password, username.trim() || undefined);
        if (err) setError(err.message);
        else {
          setMessage(
            'Check your email to confirm your account, if your project requires email verification.'
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-2xl font-bold text-ink-900 mb-1">Account</h1>
      <p className="text-sm text-ink-500 mb-8">
        Sign in to manage your collection, browse the full catalog, and view marketplace insights.
      </p>

      <div className="flex rounded-lg border border-paper-200 bg-white p-1 mb-6">
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            mode === 'signin' ? 'bg-mint/15 text-mint' : 'text-ink-600 hover:bg-paper-100'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            mode === 'signup' ? 'bg-mint/15 text-mint' : 'text-ink-600 hover:bg-paper-100'
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-ink-700 mb-1">
              Username (optional)
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm text-ink-900 focus:ring-2 focus:ring-foil/30 focus:border-foil"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-mint bg-mint/10 border border-mint/20 rounded-lg px-3 py-2">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-mint text-white text-sm font-semibold hover:bg-mint-dark disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-500">
        <Link to="/" className="text-mint font-medium hover:underline">
          Back to marketplace
        </Link>
      </p>
    </main>
  );
}
