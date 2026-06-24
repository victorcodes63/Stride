import type { ComponentPropsWithoutRef, ElementType } from 'react';
import {
  strideButtonClass,
  type StrideButtonSize,
  type StrideButtonVariant,
  type StrideSurface,
} from '@/lib/stride-primitives';

function join(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type StrideButtonOwnProps = {
  variant?: StrideButtonVariant;
  surface?: StrideSurface;
  size?: StrideButtonSize;
};

type StrideButtonProps<T extends ElementType = 'button'> = StrideButtonOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof StrideButtonOwnProps | 'as'>;

export function StrideButton<T extends ElementType = 'button'>({
  as,
  variant = 'primary',
  surface = 'dashboard',
  size = 'default',
  className,
  type,
  ...props
}: StrideButtonProps<T>) {
  const Component = as ?? 'button';
  const isNativeButton = Component === 'button';

  return (
    <Component
      className={strideButtonClass({ variant, surface, size, className })}
      {...(isNativeButton ? { type: type ?? 'button' } : {})}
      {...props}
    />
  );
}

type StrideInputProps = ComponentPropsWithoutRef<'input'> & {
  surface?: StrideSurface;
};

export function StrideInput({ surface = 'dashboard', className, ...props }: StrideInputProps) {
  const base =
    surface === 'public' ? 'pub-input' : surface === 'ess' ? 'ess-field' : 'stride-input';
  return <input className={join(base, className)} {...props} />;
}

type StrideCardProps<T extends ElementType = 'div'> = {
  as?: T;
  surface?: StrideSurface;
  flat?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'surface' | 'flat' | 'className'>;

export function StrideCard<T extends ElementType = 'div'>({
  as,
  surface = 'dashboard',
  flat = false,
  className,
  ...props
}: StrideCardProps<T>) {
  const Component = as ?? 'div';
  const base =
    surface === 'ess'
      ? flat
        ? 'ess-card-flat'
        : 'ess-card'
      : surface === 'public'
        ? 'pub-card'
        : 'stride-card';
  return <Component className={join(base, className)} {...props} />;
}
