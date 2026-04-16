import { Link } from 'react-router-dom';
import { getDashboardHomePath, getUiHostMode } from '../lib/domain';

export default function NotFoundPage() {
  const mode = getUiHostMode();
  const homePath = getDashboardHomePath(mode);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-gray-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Page Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to={homePath}
            className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {mode === 'profile' ? 'Go to Sign In' : 'Go to Dashboard'}
          </Link>
          <Link
            to="/login"
            className="px-5 py-2.5 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
