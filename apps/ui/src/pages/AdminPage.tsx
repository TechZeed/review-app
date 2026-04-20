import { FormEvent, Fragment, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';
import type { components } from '../api-types';

const API_URL = import.meta.env.VITE_API_URL || 'https://review-api.teczeed.com';
const ADMIN_USERS_QUERY_KEY = ['admin:users'] as const;

interface RoleRequest {
  id: string;
  userId: string;
  requestedRole: string;
  companyName: string;
  companyWebsite: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
type AdminUser = components['schemas']['AuthUser'] & {
  capabilities?: components['schemas']['Capability'][];
};
type AdminRole = components['schemas']['CreateUser']['role'];
type AdminStatus = NonNullable<components['schemas']['AuthUser']['status']>;
type CapabilityName = components['schemas']['GrantCapability']['capability'];
type CreateUserResponse = components['schemas']['CreateUserResponse'];
type GrantCapabilityResponse = components['schemas']['GrantCapabilityResponse'];
type RevokeCapabilityResponse = components['schemas']['RevokeCapabilityResponse'];

const ADMIN_ROLES: AdminRole[] = ['INDIVIDUAL', 'EMPLOYER', 'RECRUITER', 'ADMIN'];
const CAPABILITY_OPTIONS: CapabilityName[] = ['pro', 'employer', 'recruiter'];

function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLES.includes(value as AdminRole);
}

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function normalizeUser(user: components['schemas']['AuthUser']): AdminUser {
  return {
    ...user,
    status: user.status ?? 'active',
    provider: user.provider ?? 'internal',
  };
}

export default function AdminPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  const [tab, setTab] = useState<'requests' | 'users'>('requests');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    role: 'INDIVIDUAL' as AdminRole,
    password: '',
    phone: '',
  });
  const [capabilityByUser, setCapabilityByUser] = useState<Record<string, components['schemas']['Capability'][]>>({});
  const [selectedCapabilityByUser, setSelectedCapabilityByUser] = useState<Record<string, CapabilityName>>({});

  const qc = useQueryClient();

  const roleRequests = useQuery({
    queryKey: ['admin', 'role-requests'],
    queryFn: () => api<{ roleRequests: RoleRequest[] }>('/api/v1/auth/admin/role-requests', user.token),
  });

  const users = useQuery({
    queryKey: ADMIN_USERS_QUERY_KEY,
    queryFn: async () => {
      const res = await api<{ users: components['schemas']['AuthUser'][] }>('/api/v1/auth/admin/users', user.token);
      return { users: res.users.map(normalizeUser) };
    },
    enabled: tab === 'users',
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      api<{ id: string }>(`/api/v1/auth/admin/role-requests/${id}/approve`, user.token, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'role-requests'] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      api<{ id: string }>(`/api/v1/auth/admin/role-requests/${id}/reject`, user.token, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'role-requests'] }),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) =>
      api<{ user: components['schemas']['AuthUser'] }>(`/api/v1/auth/admin/users/${id}`, user.token, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onMutate: ({ id }) => {
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
    onError: (error, { id }) => {
      setRowErrors((prev) => ({ ...prev, [id]: error instanceof Error ? error.message : 'Failed to update role' }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminStatus }) =>
      api<{ user: components['schemas']['AuthUser'] }>(`/api/v1/auth/admin/users/${id}/status`, user.token, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onMutate: ({ id }) => {
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
    onError: (error, { id }) => {
      setRowErrors((prev) => ({ ...prev, [id]: error instanceof Error ? error.message : 'Failed to update user status' }));
    },
  });

  const createUser = useMutation({
    mutationFn: (payload: components['schemas']['CreateUser']) =>
      api<CreateUserResponse>('/api/v1/auth/admin/create-user', user.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      const created = normalizeUser(result.user);
      qc.setQueryData<{ users: AdminUser[] }>(ADMIN_USERS_QUERY_KEY, (prev) => {
        if (!prev) return { users: [created] };
        if (prev.users.some((existing) => existing.id === created.id)) return prev;
        return { users: [created, ...prev.users] };
      });
      setCreateForm({ email: '', name: '', role: 'INDIVIDUAL', password: '', phone: '' });
      setCreateError(null);
      setIsCreateModalOpen(false);
      qc.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      setCreateError(error instanceof Error ? error.message : 'Failed to create user');
    },
  });

  const grantCapability = useMutation({
    mutationFn: ({ id, capability }: { id: string; capability: CapabilityName }) =>
      api<GrantCapabilityResponse>(`/api/v1/auth/admin/users/${id}/capabilities`, user.token, {
        method: 'POST',
        body: JSON.stringify({ capability }),
      }),
    onMutate: ({ id }) => {
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    onSuccess: (result, { id }) => {
      setCapabilityByUser((prev) => ({ ...prev, [id]: result.capabilities }));
      qc.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error, { id }) => {
      setRowErrors((prev) => ({ ...prev, [id]: error instanceof Error ? error.message : 'Failed to grant capability' }));
    },
  });

  const revokeCapability = useMutation({
    mutationFn: ({ id, capability }: { id: string; capability: CapabilityName }) =>
      api<RevokeCapabilityResponse>(`/api/v1/auth/admin/users/${id}/capabilities/${capability}`, user.token, {
        method: 'DELETE',
      }),
    onMutate: ({ id }) => {
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    onSuccess: (result, { id }) => {
      setCapabilityByUser((prev) => ({ ...prev, [id]: result.capabilities }));
      qc.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error, { id }) => {
      setRowErrors((prev) => ({ ...prev, [id]: error instanceof Error ? error.message : 'Failed to revoke capability' }));
    },
  });

  const handleCreateUserSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: components['schemas']['CreateUser'] = {
      email: createForm.email.trim(),
      name: createForm.name.trim(),
      role: createForm.role,
      password: createForm.password,
      ...(createForm.phone.trim() ? { phone: createForm.phone.trim() } : {}),
    };
    createUser.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="admin-root">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin</h1>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            data-testid="admin-tab-requests"
            onClick={() => setTab('requests')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Role requests
          </button>
          <button
            data-testid="admin-tab-users"
            onClick={() => setTab('users')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Users
          </button>
        </div>

        {tab === 'requests' && (
          <section data-testid="admin-role-requests">
            {roleRequests.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {roleRequests.error && <p className="text-sm text-red-600">Failed to load role requests.</p>}
            {roleRequests.data && roleRequests.data.roleRequests.length === 0 && (
              <p className="text-sm text-gray-500">No pending role requests.</p>
            )}
            <ul className="space-y-3">
              {roleRequests.data?.roleRequests.map((r) => (
                <li
                  key={r.id}
                  data-testid="admin-role-request-row"
                  className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col md:flex-row md:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      User <code className="text-sm bg-gray-100 px-1 rounded">{r.userId.slice(0, 8)}</code>
                    </p>
                    <p className="text-sm text-gray-600">
                      Wants: <span className="font-medium">{r.requestedRole}</span> at{' '}
                      <span className="font-medium">{r.companyName}</span>
                      <span className="text-gray-400"> · {r.companyWebsite}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{r.reason}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Status: {r.status} · Requested {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        data-testid="admin-approve-btn"
                        onClick={() => approve.mutate(r.id)}
                        disabled={approve.isPending}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        data-testid="admin-reject-btn"
                        onClick={() => reject.mutate(r.id)}
                        disabled={reject.isPending}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'users' && (
          <section data-testid="admin-users">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Users</h2>
              <button
                type="button"
                data-testid="admin-create-user-btn"
                onClick={() => {
                  setCreateError(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Create user
              </button>
            </div>
            {users.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {users.error && <p className="text-sm text-red-600">Failed to load users.</p>}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Provider</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.users.map((u) => {
                    const rolePending = updateRole.isPending && updateRole.variables?.id === u.id;
                    const statusPending = updateStatus.isPending && updateStatus.variables?.id === u.id;
                    const grantPending = grantCapability.isPending && grantCapability.variables?.id === u.id;
                    const revokePending = revokeCapability.isPending && revokeCapability.variables?.id === u.id;
                    const isPending = rolePending || statusPending || grantPending || revokePending;
                    const nextStatus: AdminStatus = u.status === 'active' ? 'suspended' : 'active';
                    const statusLabel = u.status === 'active' ? 'Suspend' : 'Activate';
                    const isSelf = u.id === user.id;
                    const selectedCapability = selectedCapabilityByUser[u.id] ?? 'pro';
                    const activeCapabilities = capabilityByUser[u.id] ?? u.capabilities ?? [];

                    return (
                      <Fragment key={u.id}>
                        <tr data-testid="admin-user-row" className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-900">{u.name}</td>
                          <td className="px-4 py-2 text-gray-600">{u.email}</td>
                          <td className="px-4 py-2">
                            <select
                              data-testid="admin-role-select"
                              value={u.role}
                              disabled={isPending}
                              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 disabled:opacity-50"
                              onChange={(e) => {
                                const selectedValue = e.currentTarget.value;
                                if (!isAdminRole(selectedValue)) return;
                                const role = selectedValue;
                                if (role === u.role) return;
                                updateRole.mutate({ id: u.id, role });
                              }}
                            >
                              {ADMIN_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">{u.status}</td>
                          <td className="px-4 py-2 text-gray-500">{u.provider}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                data-testid="admin-status-toggle"
                                type="button"
                                disabled={isPending || isSelf}
                                onClick={() => {
                                  if (window.confirm(`${statusLabel} ${u.email}?`)) {
                                    updateStatus.mutate({ id: u.id, status: nextStatus });
                                  }
                                }}
                                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                              >
                                {statusLabel}
                              </button>
                              <select
                                data-testid="admin-grant-cap-select"
                                value={selectedCapability}
                                disabled={isPending}
                                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 disabled:opacity-50"
                                onChange={(e) => {
                                  const capability = e.currentTarget.value as CapabilityName;
                                  setSelectedCapabilityByUser((prev) => ({
                                    ...prev,
                                    [u.id]: capability,
                                  }));
                                }}
                              >
                                {CAPABILITY_OPTIONS.map((capability) => (
                                  <option key={capability} value={capability}>
                                    {capability}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                data-testid="admin-grant-cap-btn"
                                disabled={isPending}
                                onClick={() => grantCapability.mutate({ id: u.id, capability: selectedCapability })}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                              >
                                Grant
                              </button>
                              <div className="flex flex-wrap items-center gap-1">
                                {activeCapabilities.map((capability) => (
                                  <span
                                    key={`${u.id}-${capability.capability}`}
                                    data-testid={`admin-cap-chip-${capability.capability}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                                  >
                                    {capability.capability}
                                    <button
                                      type="button"
                                      data-testid={`admin-revoke-cap-btn-${capability.capability}`}
                                      disabled={isPending}
                                      onClick={() =>
                                        revokeCapability.mutate({ id: u.id, capability: capability.capability })
                                      }
                                      className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                                      aria-label={`Revoke ${capability.capability}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                              {isSelf && <span className="text-xs text-gray-500">Current user</span>}
                              {isPending && <span className="text-xs text-gray-500">Saving…</span>}
                            </div>
                          </td>
                        </tr>
                        {rowErrors[u.id] && (
                          <tr className="border-t border-gray-100">
                            <td className="px-4 pb-2 text-sm text-red-600" colSpan={6}>
                              {rowErrors[u.id]}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Create user</h3>
            <form data-testid="admin-create-user-form" className="mt-4 space-y-3" onSubmit={handleCreateUserSubmit}>
              <label className="block text-sm text-gray-700">
                Email
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setCreateForm((prev) => ({ ...prev, email: value }));
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Name
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setCreateForm((prev) => ({ ...prev, name: value }));
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Role
                <select
                  value={createForm.role}
                  onChange={(e) => {
                    const selectedValue = e.currentTarget.value;
                    if (!isAdminRole(selectedValue)) return;
                    setCreateForm((prev) => ({ ...prev, role: selectedValue }));
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {ADMIN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-gray-700">
                Password
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setCreateForm((prev) => ({ ...prev, password: value }));
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Phone (optional)
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setCreateForm((prev) => ({ ...prev, phone: value }));
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="admin-create-user-submit"
                  disabled={createUser.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
