import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import AdminPage from '../pages/AdminPage';
import { AuthContext, type AuthUser } from '../App';
import type { components } from '../api-types';

const adminUser: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'ADMIN',
  token: 'admin-token',
  profile_slug: 'admin-user',
  capabilities: ['pro'],
};

const usersState: Array<components['schemas']['AuthUser'] & { capabilities: components['schemas']['Capability'][] }> = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'seeded@example.com',
    name: 'Seeded User',
    role: 'INDIVIDUAL',
    status: 'active',
    provider: 'internal',
    isApproved: true,
    isActive: true,
    capabilities: [{ capability: 'recruiter', source: 'admin-grant', expiresAt: null }],
  },
];

const server = setupServer(
  http.get(/\/api\/v1\/auth\/admin\/role-requests$/, () => HttpResponse.json({ roleRequests: [] })),
  http.get(/\/api\/v1\/auth\/admin\/users$/, () => HttpResponse.json({ users: usersState })),
  http.delete(/\/api\/v1\/auth\/admin\/users\/[^/]+\/capabilities\/recruiter$/, async () => {
    const responseBody: components['schemas']['RevokeCapabilityResponse'] = {
      capabilities: [],
    };
    return HttpResponse.json(responseBody);
  }),
);

function renderAdminPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthContext.Provider value={{ user: adminUser, setUser: () => {}, logout: () => {} }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin']}>
          <AdminPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Admin revoke capability flow', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('revokes recruiter capability and removes capability chip', async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByTestId('admin-tab-users'));
    const row = await screen.findByTestId('admin-user-row');
    expect(within(row).getByTestId('admin-cap-chip-recruiter')).toBeInTheDocument();

    await user.click(within(row).getByTestId('admin-revoke-cap-btn-recruiter'));
    await waitFor(() => {
      expect(within(row).queryByTestId('admin-cap-chip-recruiter')).not.toBeInTheDocument();
    });
  });
});
