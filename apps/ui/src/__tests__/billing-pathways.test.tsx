import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    consistent: true,
    issues: [],
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

describe('Billing role pathways', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('shows capability-truth "You are" and role-pathway CTA states', async () => {
    renderBilling();

    const youAre = await screen.findByTestId('billing-you-are');
    expect(await within(youAre).findByText('Recruiter')).toBeInTheDocument();

    const recruiterPathway = screen.getByTestId('billing-pathway-recruiter');
    expect(within(recruiterPathway).getByRole('button', { name: 'Change plan' })).toBeInTheDocument();
    expect(within(recruiterPathway).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(recruiterPathway).queryByText('Become a Recruiter')).not.toBeInTheDocument();

    expect(screen.getByTestId('billing-pathway-individual')).toHaveTextContent('Become a Pro Individual');
    expect(screen.getByTestId('billing-pathway-employer')).toHaveTextContent('Become a Company');
  });
});
