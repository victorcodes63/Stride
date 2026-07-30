'use client';

import { Loader2 } from 'lucide-react';

type BrandLoaderProps = {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'contain' | 'page';
  fullPage?: boolean;
  overlay?: boolean;
  className?: string;
  'aria-label'?: string;
};

/** Compact spinner used while calendar feeds load. */
export default function BrandLoader({
  label = 'Loading…',
  size = 'md',
  variant = 'inline',
  fullPage,
  overlay,
  className = '',
  'aria-label': ariaLabel,
}: BrandLoaderProps) {
  const resolved = fullPage ? 'page' : overlay ? 'contain' : variant;
  const iconClass = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';

  const body = (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-neutral-600 ${className}`.trim()}
      role="status"
      aria-label={ariaLabel ?? label}
    >
      <Loader2 className={`${iconClass} animate-spin text-primary-700`} aria-hidden />
      {label ? <p className="text-sm font-medium">{label}</p> : null}
    </div>
  );

  if (resolved === 'page') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
        {body}
      </div>
    );
  }

  if (resolved === 'contain') {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
        {body}
      </div>
    );
  }

  return body;
}
