'use client';

import { createElement, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION_EASE, MOTION_TWEEN, VIEWPORT_REVEAL } from './motion-tokens';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: 'div' | 'section' | 'article' | 'li' | 'header' | 'p' | 'h2' | 'h3';
  once?: boolean;
};

export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  as = 'div',
  once = true,
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  if (reduceMotion) {
    return createElement(as, { className }, children);
  }

  if (!Component) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ ...VIEWPORT_REVEAL, once }}
      transition={{ ...MOTION_TWEEN, delay, ease: MOTION_EASE }}
    >
      {children}
    </Component>
  );
}
