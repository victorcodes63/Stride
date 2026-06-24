'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { MOTION_EASE } from './motion-tokens';

type CountUpProps = {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
  /** When true, renders at `value` immediately (for static marketing mocks / screenshots). */
  seeded?: boolean;
};

export function CountUp({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  className,
  duration = 1.4,
  seeded = false,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const reduceMotion = useReducedMotion();
  const seedFrom = value <= 1 ? value : Math.max(1, Math.round(value * 0.55));
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (seeded || reduceMotion) {
      setDisplay(value);
      return;
    }

    if (!isInView) {
      setDisplay(value);
      return;
    }

    setDisplay(seedFrom);
    const controls = animate(seedFrom, value, {
      duration,
      ease: MOTION_EASE,
      onUpdate: (latest) => {
        setDisplay(latest);
      },
    });

    return () => controls.stop();
  }, [isInView, reduceMotion, seeded, value, seedFrom, duration]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
