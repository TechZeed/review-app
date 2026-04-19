import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { signInWithGoogle, signInWithEmailPassword, type ExchangeTokenResponse } from '../lib/auth-service';

const EMAIL_LOGIN_ENABLED = import.meta.env.VITE_FEATURE_EMAIL_LOGIN === 'true';

export default function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'google' | 'password' | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const homeForRole = (role: string) => (role === 'ADMIN' ? '/admin' : '/dashboard');

  if (user) {
    navigate(homeForRole(user.role), { replace: true });
    return null;
  }

  const completeSignIn = (res: ExchangeTokenResponse) => {
    setUser({
      token: res.accessToken,
      id: res.user.id,
      email: res.user.email,
      role: res.user.role,
      name: res.user.name,
      profile_slug: '',
    });
    navigate(homeForRole(res.user.role), { replace: true });
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading('google');
    try {
      completeSignIn(await signInWithGoogle());
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setLoading(null);
        return;
      }
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(null);
    }
  };

  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading('password');
    try {
      completeSignIn(await signInWithEmailPassword(email, password));
    } catch (err: any) {
      // API throws Error("API error 401: {body}") on invalid credentials.
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('401')) {
        setError('Invalid email or password');
      } else {
        setError(msg || 'Sign in failed');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ReviewApp</h1>
          <p className="mt-2 text-gray-600">Every individual is a brand</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
            >
              {error}
            </div>
          )}

          {showEmailForm ? (
            <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Sign in with email</h2>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading === 'password'}
                className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading === 'password' ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(false);
                  setError('');
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700 underline"
              >
                ← Back to sign-in options
              </button>
            </form>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>

              <button
                onClick={handleGoogleSignIn}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
              </button>

              <p className="mt-4 text-center text-xs text-gray-400">🔒 Secured with Firebase Authentication</p>

              {EMAIL_LOGIN_ENABLED && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => {
                      setShowEmailForm(true);
                      setError('');
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                  >
                    Sign in with email and password
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
