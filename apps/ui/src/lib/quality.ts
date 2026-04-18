import type { QualityBar } from '../components/QualityHeatMap';
import type { Profile } from './api';

const QUALITY_ORDER: Array<{
  key: keyof NonNullable<Profile['qualityBreakdown']>;
  name: string;
  color: string;
}> = [
  { key: 'expertise', name: 'Expertise', color: '#3B82F6' },
  { key: 'care', name: 'Care', color: '#EC4899' },
  { key: 'delivery', name: 'Delivery', color: '#22C55E' },
  { key: 'initiative', name: 'Initiative', color: '#F97316' },
  { key: 'trust', name: 'Trust', color: '#8B5CF6' },
];

export function buildQualityBarsFromProfile(
  profile: Profile | undefined,
): QualityBar[] {
  const breakdown = profile?.qualityBreakdown;
  return QUALITY_ORDER.map(({ key, name, color }) => ({
    name,
    percentage:
      breakdown && typeof breakdown[key] === 'number' ? breakdown[key] : 0,
    color,
  }));
}
