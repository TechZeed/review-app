import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import LoginPage from '../pages/LoginPage';
import { AuthContext, useAuth, type AuthUser } from '../App';
import type { components } from '../api-types';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const loginResponse: components['schemas']['ExchangeTokenResponse'] = {
  accessToken: 'jwt-token-1',
  user: {
    id: '7cf30727-d026-4542-b2ff-2e3968d856f4',
    email: 'admin@reviewapp.com',
    name: 'Admin User',
    role: 'ADMIN',
  },
};

const subscriptionResponse: components['schemas']['SubscriptionMe'] = {
  tier: 'employer',
  status: 'active',
  capabilities: [
    { capability: 'employer', source: 'subscription', expiresAt: null },
    { capability: 'pro', source: 'admin-grant', expiresAt: null },
  ],
};

const server = setupServer(
  http.post(/\/api\/v1\/auth\/login$/, async () => HttpResponse.json(loginResponse)),
  http.get(/\/api\/v1\/subscriptions\/me$/, async () => HttpResponse.json(subscriptionResponse)),
);

function AuthStateProbe() {
  const { user } = useAuth();

  if (!user) return <div data-testid="auth-user">no-user</div>;

  return (
    <div data-testid="auth-user">
      {user.role}:{user.capabilities.join(',')}
    </div>
  );
}

function TestAuthProvider() {
  const [user, setUser] = useState<AuthUser | null>(null);
  return (
    <AuthContext.Provider value={{ user, setUser, logout: () => {} }}>
      <LoginPage />
      <AuthStateProbe />
    </AuthContext.Provider>
  );
}

describe('LoginPage', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('signs in with email/password and applies capabilities from /subscriptions/me', async () => {
    const user = userEvent.setup();

    render(<TestAuthProvider />);

    await user.click(screen.getByRole('button', { name: /sign in with email and password/i }));
    await user.type(screen.getByLabelText(/email/i), 'admin@reviewapp.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-user')).toHaveTextContent('ADMIN:employer,pro');
    });
  });
});
