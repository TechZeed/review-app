import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, createContext, useContext } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import { signOutUser } from './lib/auth-service';
import { getDashboardHomePath, getUiHostMode } from './lib/domain';

export interface AuthUser {
  token: string;
  id: string;
  email: string;
  role: string;
  name: string;
  profile_slug: string;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Admins don't have an individual profile to render; redirect to /admin.
function DashboardRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <DashboardPage />;
}

function HomeRoute() {
  const mode = getUiHostMode();
  return <Navigate to={getDashboardHomePath(mode)} replace />;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('auth_user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleSetUser = (u: AuthUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem('auth_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('auth_user');
    }
  };

  const logout = () => {
    signOutUser().catch(() => {});
    handleSetUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, setUser: handleSetUser, logout }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardRoute />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="/profile/:slug" element={<ProfilePage />} />
            <Route path="/" element={<HomeRoute />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}
