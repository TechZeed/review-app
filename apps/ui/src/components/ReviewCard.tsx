import type { Review } from '../lib/api';

const QUALITY_COLORS: Record<string, string> = {
  expertise: 'bg-blue-100 text-blue-700',
  care: 'bg-pink-100 text-pink-700',
  delivery: 'bg-green-100 text-green-700',
  initiative: 'bg-orange-100 text-orange-700',
  trust: 'bg-purple-100 text-purple-700',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ReviewCardProps {
  review: Review;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const dateText = formatDate(review.createdAt);
  const isVerifiedInteraction = review.badgeTier === 'verified_interaction';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{dateText}</span>
        <div className="flex items-center gap-2">
          {isVerifiedInteraction && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
              <svg
                className="w-3 h-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Verified
            </span>
          )}
          {review.verifiable && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
              Reference
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {review.qualities.map((q) => {
          const colorClass =
            QUALITY_COLORS[q.toLowerCase()] || 'bg-gray-100 text-gray-700';
          return (
            <span
              key={q}
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}
            >
              {q}
            </span>
          );
        })}
      </div>
    </div>
  );
}
