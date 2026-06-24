'use client';

import type { ReactNode } from 'react';
import {
  MARKETING_BRAND,
  MARKETING_VERTICAL_SCREENSHOTS,
  marketingAppHostLabel,
  type MarketingVerticalScreenshotId,
} from '@/lib/marketing-config';
import { CoreDashboardWireframe } from './CoreDashboardWireframe';

type MarketingScreenshotFrameProps = {
  moduleLabel: string;
  screenTitle: string;
  path: string;
  className?: string;
  children: ReactNode;
};

function WireframeShell({
  moduleLabel,
  screenTitle,
  path,
  children,
}: {
  moduleLabel: string;
  screenTitle: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border shadow-[0_16px_40px_-20px_rgba(26,23,20,0.2)]"
      style={{
        borderColor: `${MARKETING_BRAND.line}33`,
        backgroundColor: MARKETING_BRAND.ink,
      }}
    >
      <div
        className="flex items-center gap-1.5 border-b px-2.5 py-1.5"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          backgroundColor: MARKETING_BRAND.inkMuted,
        }}
      >
        <span className="h-2 w-2 rounded-full bg-[#FF5F57]" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-[#28C840]" aria-hidden />
        <span className="ml-1 flex-1 truncate text-center text-[9px] text-white/45">
          {marketingAppHostLabel(path)}
        </span>
      </div>
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          backgroundColor: MARKETING_BRAND.inkMuted,
        }}
      >
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--sc-coral)]">
            {moduleLabel}
          </p>
          <p className="truncate text-xs font-medium text-[var(--sc-paper)]">{screenTitle}</p>
        </div>
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: MARKETING_BRAND.coral }}
          aria-hidden
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-2.5" style={{ backgroundColor: MARKETING_BRAND.ink }}>
        {children}
      </div>
    </div>
  );
}

/** Branded product screenshot frame — shared by architecture stack and industry cards. */
export function MarketingScreenshotFrame({
  moduleLabel,
  screenTitle,
  path,
  className = '',
  children,
}: MarketingScreenshotFrameProps) {
  return (
    <div className={`h-full min-h-0 w-full ${className}`.trim()}>
      <WireframeShell moduleLabel={moduleLabel} screenTitle={screenTitle} path={path}>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-white/[0.08]">
          {children}
        </div>
      </WireframeShell>
    </div>
  );
}

export function CoreDashboardWireframePreview({ className = '' }: { className?: string }) {
  return (
    <MarketingScreenshotFrame
      moduleLabel="Stride Core"
      screenTitle="Operations overview"
      path="/dashboard"
      className={className}
    >
      <CoreDashboardWireframe className="h-full p-2" />
    </MarketingScreenshotFrame>
  );
}

type IndustryWireframePreviewProps = {
  industryId: MarketingVerticalScreenshotId;
  className?: string;
};

/** Live product screengrab inside the marketing chrome frame. */
export function IndustryWireframePreview({ industryId, className = '' }: IndustryWireframePreviewProps) {
  const shot = MARKETING_VERTICAL_SCREENSHOTS[industryId];

  return (
    <MarketingScreenshotFrame
      moduleLabel={shot.moduleLabel}
      screenTitle={shot.screenTitle}
      path={shot.path}
      className={className}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shot.src}
        alt={shot.alt}
        className="absolute inset-0 h-full w-full object-cover object-top"
        decoding="async"
        loading="lazy"
      />
    </MarketingScreenshotFrame>
  );
}
