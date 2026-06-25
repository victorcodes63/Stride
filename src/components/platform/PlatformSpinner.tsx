'use client';

import { useId } from 'react';

type PlatformSpinnerProps = {
  size?: number;
  className?: string;
};

export function PlatformSpinner({ size = 56, className }: PlatformSpinnerProps) {
  const gradientId = useId().replace(/:/g, '');
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * 0.68;

  return (
    <div
      className={['platform-spinner', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 56 56" className="platform-spinner__svg">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand-primary, #ff5436)" />
            <stop offset="45%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.28)" />
          </linearGradient>
        </defs>
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          className="platform-spinner__track"
          strokeWidth="3.5"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="platform-spinner__arc"
        />
      </svg>
    </div>
  );
}
