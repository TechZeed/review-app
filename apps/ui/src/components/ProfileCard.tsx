import type { Profile } from '../lib/api';

interface ProfileCardProps {
  profile: Profile;
  showQR?: boolean;
}

export default function ProfileCard({ profile, showQR = false }: ProfileCardProps) {
  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start gap-4">
        {profile.photo_url ? (
          <img
            src={profile.photo_url}
            alt={profile.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
            {initials}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
          {profile.role && (
            <p className="text-sm text-gray-600">{profile.role}</p>
          )}
          {profile.org_name && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
              {profile.org_name}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {profile.total_reviews}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Reviews</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {profile.verifiable_references}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">References</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {profile.industry || '--'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Industry</div>
        </div>
      </div>

      {showQR && (
        <div className="mt-6 flex flex-col items-center">
          <div className="w-48 h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
            QR Code
            <br />
            (scan to review)
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Share this QR code with customers
          </p>
        </div>
      )}
    </div>
  );
}
