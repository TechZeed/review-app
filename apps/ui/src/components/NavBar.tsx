import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { getPublicProfileHref } from '../lib/domain';

export default function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const role = user?.role;
  // Spec 28 §10 — Employer/Recruiter nav driven by capabilities, not role.
  // ADMIN keeps unconditional bypass (mirrors backend requireCapability).
  const caps = user?.capabilities ?? [];
  const navItems: { path: string; label: string }[] = [];
  if (role === 'ADMIN') {
    navItems.push({ path: '/admin', label: 'Admin' });
  } else if (role) {
    navItems.push({ path: '/dashboard', label: 'Dashboard' });
  }
  if (caps.includes('employer') || role === 'ADMIN') navItems.push({ path: '/employer', label: 'Employer' });
  if (caps.includes('recruiter') || role === 'ADMIN') navItems.push({ path: '/recruiter', label: 'Recruiter' });
  if (role) navItems.push({ path: '/billing', label: 'Billing' });

  return (
    <nav
      className="bg-white border-b border-gray-200 sticky top-0 z-50"
      data-testid="nav-bar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          <div className="flex items-center gap-4 md:gap-8 min-w-0">
            <Link
              to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'}
              className="text-xl font-bold text-gray-900 shrink-0"
            >
              ReviewApp
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <span className="text-sm text-gray-600 hidden sm:block truncate max-w-[120px]">
                {user.name}
              </span>
              <Link
                to={getPublicProfileHref(user.profile_slug)}
                className="text-sm text-blue-600 hover:text-blue-800 shrink-0"
              >
                <span className="hidden sm:inline">Public Profile</span>
                <span className="sm:hidden">Profile</span>
              </Link>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700 px-2 sm:px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors shrink-0"
              >
                <span className="hidden sm:inline">Sign Out</span>
                <span className="sm:hidden">Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
