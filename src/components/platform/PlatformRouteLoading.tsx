import { PlatformLoadingStage } from '@/components/platform/PlatformLoadingStage';

export function PlatformRouteLoading() {
  return (
    <div className="platform-route-loading" role="status" aria-live="polite" aria-label="Loading">
      <PlatformLoadingStage />
    </div>
  );
}
