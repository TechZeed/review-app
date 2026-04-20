import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BillingPage from './BillingPage';
import { AuthContext, type AuthUser } from '../App';
import type { components } from '../api-types';

const activeSubscription: components['schemas']['SubscriptionMe'] = {
  tier: 'pro',
  status: 'active',
  capabilities: [{ capability: 'pro', source: 'subscription', expiresAt: null }],
};

let portalCalls = 0;
let checkoutCalls = 0;

const server = setupServer(
  http.get(/\/api\/v1\/subscriptions\/me$/, async () => HttpResponse.json(activeSubscription)),
  http.post(/\/api\/v1\/subscriptions\/portal$/, async () => {
    portalCalls += 1;
    return HttpResponse.json({ portalUrl: 'https://billing.stripe.com/p/session_123' }, { status: 201 });
  }),
  http.post(/\/api\/v1\/subscriptions\/checkout$/, async () => {
    checkoutCalls += 1;
    return HttpResponse.json(
      { checkoutUrl: 'https://checkout.stripe.com/c/pay_test', checkoutSessionId: 'cs_test', expiresAt: 1 },
      { status: 201 },
    );
  }),
);

function renderBillingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user: AuthUser = {
    id: '7cf30727-d026-4542-b2ff-2e3968d856f4',
    email: 'ramesh@reviewapp.demo',
    name: 'Ramesh Kumar',
    role: 'INDIVIDUAL',
    token: 'jwt-token-1',
    profile_slug: 'ramesh-kumar',
    capabilities: ['pro'],
  };

  return render(
    <AuthContext.Provider value={{ user, setUser: () => {}, logout: () => {} }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/billing']}>
          <Routes>
            <Route path="/billing" element={<BillingPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('BillingPage', () => {
  let assignMock: ReturnType<typeof vi.fn>;

  beforeAll(() => server.listen());
  afterAll(() => server.close());
  beforeEach(() => {
    portalCalls = 0;
    checkoutCalls = 0;
    assignMock = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      assign: assignMock,
    });
  });
  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllGlobals();
  });

  it('routes active users through Stripe customer portal when switching plans', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    const switchButtons = await screen.findAllByRole('button', { name: /switch plan/i });
    const switchBtn = switchButtons[0];
    await user.click(switchBtn);

    await waitFor(() => {
      expect(portalCalls).toBe(1);
    });
    expect(checkoutCalls).toBe(0);
    expect(assignMock).toHaveBeenCalledWith('https://billing.stripe.com/p/session_123');
  });
});
