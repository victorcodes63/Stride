/**
 * Class-name helpers for Stride UI primitives (RAV-115).
 * Prefer these in new React code; legacy CSS aliases remain for existing markup.
 */

export type StrideSurface = 'dashboard' | 'public' | 'ess';
export type StrideButtonVariant = 'primary' | 'secondary' | 'ghost';
export type StrideButtonSize = 'default' | 'sm';

function join(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const SURFACE_BUTTON_CLASS: Record<StrideSurface, Record<StrideButtonVariant, string>> = {
  dashboard: {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'stride-btn stride-btn--ghost stride-btn--dashboard',
  },
  public: {
    primary: 'pub-btn-primary',
    secondary: 'pub-btn-secondary',
    ghost: 'stride-btn stride-btn--ghost stride-btn--public',
  },
  ess: {
    primary: 'ess-btn-primary',
    secondary: 'ess-btn-secondary',
    ghost: 'ess-btn-ghost',
  },
};

export function strideButtonClass(options: {
  variant?: StrideButtonVariant;
  surface?: StrideSurface;
  size?: StrideButtonSize;
  className?: string;
}): string {
  const { variant = 'primary', surface = 'dashboard', size = 'default', className } = options;
  const base = SURFACE_BUTTON_CLASS[surface][variant];
  const sm = size === 'sm' && surface === 'public' ? 'pub-btn-primary--sm' : size === 'sm' ? 'stride-btn--sm' : null;
  return join(base, sm, className);
}

export function strideInputClass(options: {
  surface?: StrideSurface;
  className?: string;
}): string {
  const { surface = 'dashboard', className } = options;
  const base =
    surface === 'public' ? 'pub-input' : surface === 'ess' ? 'ess-field' : 'stride-input';
  return join(base, className);
}

export function strideCardClass(options: {
  surface?: StrideSurface;
  flat?: boolean;
  className?: string;
}): string {
  const { surface = 'dashboard', flat = false, className } = options;
  if (surface === 'ess') return join(flat ? 'ess-card-flat' : 'ess-card', className);
  if (surface === 'public') return join('pub-card', className);
  return join('stride-card', className);
}

/** @deprecated use strideButtonClass({ surface: 'ess', variant: 'primary' }) */
export const essPrimaryButtonClass = strideButtonClass({ surface: 'ess', variant: 'primary' });
/** @deprecated use strideButtonClass({ surface: 'ess', variant: 'secondary' }) */
export const essSecondaryButtonClass = strideButtonClass({ surface: 'ess', variant: 'secondary' });
/** @deprecated use strideButtonClass({ surface: 'ess', variant: 'ghost' }) */
export const essGhostButtonClass = strideButtonClass({ surface: 'ess', variant: 'ghost' });
/** @deprecated use strideInputClass({ surface: 'ess' }) */
export const essInputClass = strideInputClass({ surface: 'ess' });
