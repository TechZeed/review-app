import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';

const API_URL = import.meta.env.VITE_API_URL || 'https://review-api.teczeed.com';

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

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  provider: string;
  createdAt: string;
}

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export default function AdminPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  const [tab, setTab] = useState<'requests' | 'users'>('requests');
  const qc = useQueryClient();

  const roleRequests = useQuery({
    queryKey: ['admin', 'role-requests'],
    queryFn: () => api<{ roleRequests: RoleRequest[] }>('/api/v1/auth/admin/role-requests', user.token),
  });

  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api<{ users: AdminUser[] }>('/api/v1/auth/admin/users', user.token),
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
                  </tr>
                </thead>
                <tbody>
                  {users.data?.users.map((u) => (
                    <tr key={u.id} data-testid="admin-user-row" className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-900">{u.name}</td>
                      <td className="px-4 py-2 text-gray-600">{u.email}</td>
                      <td className="px-4 py-2">{u.role}</td>
                      <td className="px-4 py-2">{u.status}</td>
                      <td className="px-4 py-2 text-gray-500">{u.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
