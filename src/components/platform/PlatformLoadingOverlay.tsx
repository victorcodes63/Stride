import { PlatformLoadingStage } from '@/components/platform/PlatformLoadingStage';

export function PlatformLoadingOverlay() {
  return (
    <div className="platform-loading-overlay" role="status" aria-live="polite" aria-label="Loading">
      <PlatformLoadingStage />
    </div>
  );
}
