import { Navigate } from 'react-router-dom';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';

// STUB — to be implemented by the Employer-dashboard agent (spec 13).
// Allowed roles: EMPLOYER, ADMIN.
export default function EmployerPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'EMPLOYER' && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="employer-root">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Employer dashboard</h1>
        <p className="text-gray-600">TODO — verifiable references inbox, org roster, team review feed. See spec 13.</p>
      </main>
    </div>
  );
}
