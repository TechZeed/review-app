import { Navigate } from 'react-router-dom';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';

// STUB — to be implemented by the Recruiter-search agent (spec 12).
// Allowed roles: RECRUITER, ADMIN.
export default function RecruiterPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'RECRUITER' && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="recruiter-root">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Recruiter search</h1>
        <p className="text-gray-600">TODO — candidate search, filters, ranking, contact flow. See spec 12.</p>
      </main>
    </div>
  );
}
