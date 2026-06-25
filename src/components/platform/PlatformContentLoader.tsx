import { PlatformLoadingStage } from '@/components/platform/PlatformLoadingStage';

type PlatformContentLoaderProps = {
  label?: string;
  compact?: boolean;
};

export function PlatformContentLoader({ label, compact = false }: PlatformContentLoaderProps) {
  return (
    <div className="platform-content-loader" role="status" aria-live="polite" aria-label={label ?? 'Loading'}>
      <PlatformLoadingStage compact={compact} />
      {label ? <p className="platform-content-loader__label">{label}</p> : null}
    </div>
  );
}
