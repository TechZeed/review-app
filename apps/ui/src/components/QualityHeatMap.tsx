interface QualityBar {
  name: string;
  percentage: number;
  color: string;
}

const DEFAULT_QUALITIES: QualityBar[] = [
  { name: 'Expertise', percentage: 0, color: '#3B82F6' },
  { name: 'Care', percentage: 0, color: '#EC4899' },
  { name: 'Delivery', percentage: 0, color: '#22C55E' },
  { name: 'Initiative', percentage: 0, color: '#F97316' },
  { name: 'Trust', percentage: 0, color: '#8B5CF6' },
];

interface QualityHeatMapProps {
  qualities?: QualityBar[];
  onQualityClick?: (name: string) => void;
  interactive?: boolean;
}

export default function QualityHeatMap({
  qualities,
  onQualityClick,
  interactive = false,
}: QualityHeatMapProps) {
  const bars = qualities && qualities.length > 0 ? qualities : DEFAULT_QUALITIES;

  const sorted = [...bars].sort((a, b) => b.percentage - a.percentage);

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      role="img"
      aria-label={sorted
        .map((q) => `${q.name}: ${q.percentage}%`)
        .join(', ')}
    >
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
        Quality Breakdown
      </h3>
      <div className="space-y-3">
        {sorted.map((q) => (
          <button
            key={q.name}
            type="button"
            disabled={!interactive}
            onClick={() => onQualityClick?.(q.name)}
            className={`w-full group ${
              interactive
                ? 'cursor-pointer hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors'
                : 'cursor-default'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                {q.name}
              </span>
              <span className="text-sm font-bold" style={{ color: q.color }}>
                {q.percentage}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(q.percentage, 2)}%`,
                  backgroundColor: q.color,
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export type { QualityBar };
