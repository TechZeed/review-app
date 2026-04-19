import { Navigate } from 'react-router-dom';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';

// STUB — to be implemented by the Stripe-checkout UI agent (spec 11).
// Allowed roles: any authenticated user can view plans; picking a plan
// calls POST /api/v1/subscriptions/checkout and redirects to Stripe Checkout.
export default function BillingPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="billing-root">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Billing & plans</h1>
        <p className="text-gray-600">TODO — plan picker + Stripe Checkout wiring. See spec 11.</p>
      </main>
    </div>
  );
}
