export function EssSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--ess-muted)_18%,transparent)] ${className}`}
      aria-hidden
    />
  );
}

export function EssCardSkeleton() {
  return (
    <div className="ess-card-flat space-y-3 p-4">
      <EssSkeleton className="h-4 w-1/3" />
      <EssSkeleton className="h-3 w-full" />
      <EssSkeleton className="h-3 w-2/3" />
    </div>
  );
}
