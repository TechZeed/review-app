import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import BillingPage from '../pages/BillingPage';
import { AuthContext, type AuthUser } from '../App';
import type { components } from '../api-types';

const subscriptionResponse: components['schemas']['SubscriptionMe'] = {
  tier: 'recruiter',
  status: 'active',
  capabilities: [{ capability: 'recruiter', source: 'subscription', expiresAt: null }],
  reconciliation: {
    consistent: false,
    issues: ['tier-without-capability'],
  },
};

const server = setupServer(
  http.get(/\/api\/v1\/subscriptions\/me$/, () => HttpResponse.json(subscriptionResponse)),
);

function renderBilling() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user: AuthUser = {
    id: 'user-1',
    token: 'token-1',
    email: 'user@test.local',
    role: 'INDIVIDUAL',
    name: 'Billing User',
    profile_slug: 'billing-user',
    capabilities: [],
  };

  return render(
    <AuthContext.Provider value={{ user, setUser: () => {}, logout: () => {} }}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BillingPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Billing reconciliation warning', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('renders reconciliation warning banner when API reports inconsistency', async () => {
    renderBilling();
    expect(await screen.findByTestId('billing-reconciliation-warning')).toBeInTheDocument();
  });
});
