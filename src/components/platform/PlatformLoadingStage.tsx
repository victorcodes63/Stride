import BrandLogo from '@/components/BrandLogo';
import { PlatformSpinner } from '@/components/platform/PlatformSpinner';

type PlatformLoadingStageProps = {
  compact?: boolean;
};

export function PlatformLoadingStage({ compact = false }: PlatformLoadingStageProps) {
  return (
    <div className={compact ? 'platform-loading-stage platform-loading-stage--compact' : 'platform-loading-stage'}>
      <div className="platform-loading-stage__halo" aria-hidden />
      <div className="platform-loading-stage__core">
        <PlatformSpinner size={compact ? 44 : 58} />
        <div className="platform-loading-stage__mark">
          <BrandLogo variant="markSm" priority />
        </div>
      </div>
    </div>
  );
}
