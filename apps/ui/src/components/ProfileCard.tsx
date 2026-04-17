import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Profile } from '../lib/api';
import ShareQRButton from './ShareQRButton';

interface ProfileCardProps {
  profile: Profile;
  showQR?: boolean;
}

function buildPublicUrl(slug: string): string {
  const base =
    import.meta.env.VITE_PUBLIC_REVIEW_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  // Strip trailing slash on base so we don't get // in the middle.
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/r/${slug}`;
}

export default function ProfileCard({ profile, showQR = false }: ProfileCardProps) {
  const qrSvgRef = useRef<SVGSVGElement | null>(null);

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const publicUrl = buildPublicUrl(profile.slug);

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
          <div
            data-testid="reviewee-qr"
            data-qr-url={publicUrl}
            className="bg-white p-2 rounded-lg border border-gray-200 w-60 h-60 sm:w-[180px] sm:h-[180px] flex items-center justify-center"
          >
            <QRCodeSVG
              ref={qrSvgRef}
              value={publicUrl}
              size={512}
              level="M"
              marginSize={0}
              className="w-full h-full"
            />
          </div>
          <p className="text-xs font-mono text-slate-500 select-all break-all mt-2">
            {publicUrl}
          </p>
          <ShareQRButton
            svgRef={qrSvgRef}
            publicUrl={publicUrl}
            slug={profile.slug}
          />
        </div>
      )}
    </div>
  );
}
