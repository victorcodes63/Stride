/** Shared motion tokens for Stride marketing surfaces. */

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export const MOTION_SPRING = {
  type: 'spring' as const,
  stiffness: 150,
  damping: 20,
};

export const MOTION_SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 180,
  damping: 18,
};

export const MOTION_TWEEN = {
  duration: 0.55,
  ease: MOTION_EASE,
};

export const VIEWPORT_REVEAL = {
  once: true,
  margin: '0px 0px -12% 0px' as const,
};

export const STAGGER_CHILD_MS = 0.028;
