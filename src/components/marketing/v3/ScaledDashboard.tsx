'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const DEFAULT_DESIGN_WIDTH = 896;

type ScaledDashboardProps = {
  children: ReactNode;
  /** Fixed layout width before scale-to-fit (default 896). */
  designWidth?: number;
};

export function ScaledDashboard({
  children,
  designWidth = DEFAULT_DESIGN_WIDTH,
}: ScaledDashboardProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      const nextScale = outer.clientWidth / designWidth;
      setScale(nextScale);
      setHeight(inner.offsetHeight * nextScale);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [designWidth]);

  return (
    <div ref={outerRef} className="w-full" style={{ height: height || undefined }}>
      <div
        ref={innerRef}
        className="origin-top-left"
        style={{ width: designWidth, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
