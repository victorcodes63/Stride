'use client';

import type { ReactNode } from 'react';

type Props = {
  percent: number;
  size?: number;
  stroke?: number;
  /** Render on the coral hero (white ring) or on a light surface (primary ring). */
  variant?: 'onHero' | 'default';
  label?: string;
  children?: ReactNode;
};

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Accessible circular progress ring. Uses an SVG stroke arc so it works on both
 * the coral hero and light surfaces without conic-gradient support concerns.
 */
export function EssOnboardingProgress({
  percent,
  size = 88,
  stroke = 9,
  variant = 'default',
  label,
  children,
}: Props) {
  const value = clampPercent(percent);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (value / 100) * circumference;

  const trackColor = variant === 'onHero' ? 'rgba(255,255,255,0.28)' : 'var(--ess-primary-soft)';
  const arcColor = variant === 'onHero' ? '#ffffff' : 'var(--ess-primary)';
  const textColor = variant === 'onHero' ? 'text-white' : 'text-[var(--ess-text)]';

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `Onboarding ${value}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${textColor}`}>
        {children ?? (
          <span className="text-lg font-black leading-none">{value}%</span>
        )}
      </div>
    </div>
  );
}
