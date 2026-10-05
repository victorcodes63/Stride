'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type ProductFrameProps = {
  /** Describes what the preview shows, for screen readers (the preview itself is inert). */
  label: string;
  /** Path shown in the browser bar, e.g. "/dashboard". Omit to hide the bar. */
  path?: string;
  /**
   * Width the product UI is laid out at, in px. The preview is scaled down to fit narrower
   * containers (never up), so it keeps the product's real proportions on every screen.
   */
  designWidth?: number;
  /** Paint the dashboard canvas behind the content (soft coral wash, like the app). */
  canvas?: boolean;
  /** Fill a fixed-height parent and crop the bottom, like a cropped screenshot. */
  fill?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Frame for real dashboard components rendered on the marketing site.
 * - Scopes the product's own typography and tokens (see `.stride-product-frame` in public-theme.css).
 * - Makes the content inert: no focus, no clicks, no links followed.
 * - Scales the product layout to the available width.
 */
export function ProductFrame({
  label,
  path,
  designWidth = 720,
  canvas = true,
  fill = false,
  className = '',
  children,
}: ProductFrameProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(designWidth);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const available = outer.clientWidth;
      // Wider than the design: let the product layout fill it. Narrower: scale the design down.
      const width = Math.max(designWidth, available);
      const next = Math.min(1, available / designWidth);
      setLayoutWidth(width);
      setScale(next);
      setHeight(inner.offsetHeight * next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <figure
      role="img"
      aria-label={label}
      className={`stride-product-frame overflow-hidden rounded-[18px] ${fill ? 'flex h-full flex-col' : ''} border border-[var(--sc-line)] bg-white shadow-[0_1px_2px_rgba(26,23,20,0.04),0_30px_70px_-34px_rgba(26,23,20,0.35)] ${className}`.trim()}
    >
      {path ? (
        <div className="flex items-center gap-1.5 border-b border-[var(--dash-border)] bg-[#FAFAFB] px-4 py-2.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#E7E7EB]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E7E7EB]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E7E7EB]" />
          <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-[var(--dash-text-muted)] ring-1 ring-[var(--dash-border)]">
            app.getstride.co.ke{path}
          </span>
        </div>
      ) : null}
      <div
        ref={outerRef}
        className={`relative w-full overflow-hidden ${fill ? 'min-h-0 flex-1' : ''} ${canvas ? 'dashboard-canvas' : 'bg-[var(--dash-surface-solid)]'}`}
        style={!fill && height != null ? { height } : undefined}
      >
        <div
          ref={innerRef}
          inert
          aria-hidden
          className="origin-top-left p-4 sm:p-5"
          style={{ width: layoutWidth, transform: scale < 1 ? `scale(${scale})` : undefined }}
        >
          {children}
        </div>
      </div>
    </figure>
  );
}
