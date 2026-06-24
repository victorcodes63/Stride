import { PlatformModulesWireframe } from '@/components/marketing/mockups/PlatformModulesWireframe';

type PlatformModulesShowcaseProps = {
  className?: string;
};

/** Platform overview for marketing hero — seeded module grid and business snapshot. */
export function PlatformModulesShowcase({ className = '' }: PlatformModulesShowcaseProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-[#E6DED4]/90 bg-[#12100E] shadow-[0_28px_80px_-16px_rgba(26,23,20,0.22),0_8px_24px_-8px_rgba(26,23,20,0.12)] ring-1 ring-[#1A1714]/[0.04] ${className}`.trim()}
    >
      <PlatformModulesWireframe />
    </div>
  );
}
