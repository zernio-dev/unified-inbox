import { BadgeCheck } from 'lucide-react';

// X/Twitter verified tiers with platform-correct colors:
// blue (Premium), government (gray), business (gold).
const BADGE_COLORS = {
  blue: '#1d9bf0',
  government: '#829aab',
  business: '#e2b719',
} as const;

export type VerifiedType = keyof typeof BADGE_COLORS;

export function isVerifiedType(type: string | null | undefined): type is VerifiedType {
  return type === 'blue' || type === 'government' || type === 'business';
}

export function XVerifiedBadge({ type }: { type: VerifiedType }) {
  return (
    <BadgeCheck
      aria-label={`Verified (${type})`}
      className="size-3.5 flex-none"
      style={{ color: BADGE_COLORS[type] }}
    />
  );
}
