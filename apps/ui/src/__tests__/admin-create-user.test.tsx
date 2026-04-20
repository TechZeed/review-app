import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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

const usersState: components['schemas']['AuthUser'][] = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'existing@example.com',
    name: 'Existing User',
    role: 'INDIVIDUAL',
    status: 'active',
    provider: 'internal',
    isApproved: true,
    isActive: true,
  },
];

const server = setupServer(
  http.get(/\/api\/v1\/auth\/admin\/role-requests$/, () => HttpResponse.json({ roleRequests: [] })),
  http.get(/\/api\/v1\/auth\/admin\/users$/, () => HttpResponse.json({ users: usersState })),
  http.post(/\/api\/v1\/auth\/admin\/create-user$/, async ({ request }) => {
    const payload = (await request.json()) as components['schemas']['CreateUser'];
    const createdUser: components['schemas']['AuthUser'] = {
      id: '33333333-3333-4333-8333-333333333333',
      email: payload.email,
      name: payload.name,
      role: payload.role,
      status: 'active',
      provider: 'internal',
      isApproved: true,
      isActive: true,
    };
    usersState.push(createdUser);
    const responseBody: components['schemas']['CreateUserResponse'] = {
      user: createdUser,
      accessToken: 'new-user-token',
    };
    return HttpResponse.json(responseBody, { status: 201 });
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

describe('Admin create user flow', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    usersState.splice(1);
    server.resetHandlers();
  });
  afterAll(() => server.close());

  it('creates a user from modal and shows the new row', async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(screen.getByTestId('admin-tab-users'));
    await user.click(await screen.findByTestId('admin-create-user-btn'));

    await user.type(screen.getByLabelText(/email/i), 'new.user@example.com');
    await user.type(screen.getByLabelText(/name/i), 'New User');
    await user.selectOptions(screen.getByLabelText(/role/i), 'RECRUITER');
    await user.type(screen.getByLabelText(/password/i), 'Secret_1234');
    await user.type(screen.getByLabelText(/phone/i), '+6590001122');
    await user.click(screen.getByTestId('admin-create-user-submit'));

    await waitFor(() => {
      expect(screen.queryByTestId('admin-create-user-form')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('new.user@example.com')).toBeInTheDocument();
  });
});
