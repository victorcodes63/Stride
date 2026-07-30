'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const BASE_CLASS =
  'inline-flex items-center justify-center rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed';

const SIZE_CLASS: Record<NonNullable<AppActionButtonProps['size']>, string> = {
  md: 'gap-2 px-4 py-2.5 min-h-[44px] sm:min-h-0 text-sm',
  sm: 'gap-1.5 px-3 py-1.5 text-xs',
};

const ICON_CLASS: Record<NonNullable<AppActionButtonProps['size']>, string> = {
  md: 'h-4 w-4',
  sm: 'h-3.5 w-3.5',
};

const VARIANT_CLASS: Record<NonNullable<AppActionButtonProps['variant']>, string> = {
  accent: 'bg-secondary-500 text-primary-950 hover:bg-secondary-400 shadow-md shadow-secondary-500/25',
  solid: 'bg-primary-900 text-white hover:bg-primary-800 shadow-sm',
  outline: 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50',
  glass: 'bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/25 backdrop-blur-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  'danger-outline': 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
};

export type AppActionButtonProps = {
  variant?: 'accent' | 'solid' | 'outline' | 'glass' | 'danger' | 'danger-outline';
  size?: 'md' | 'sm';
  label: string;
  icon?: LucideIcon;
  href?: string;
  target?: '_blank' | '_self';
  download?: boolean | string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  form?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  'aria-haspopup'?: 'dialog' | 'menu' | 'true';
  'aria-expanded'?: boolean;
  title?: string;
};

export default function AppActionButton({
  variant = 'accent',
  size = 'md',
  label,
  icon: Icon,
  href,
  target,
  download,
  onClick,
  type = 'button',
  form,
  disabled,
  loading,
  fullWidth,
  className,
  'aria-haspopup': ariaHasPopup,
  'aria-expanded': ariaExpanded,
  title,
}: AppActionButtonProps) {
  const classes = [
    BASE_CLASS,
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    fullWidth ? 'w-full sm:w-auto' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconClass = ICON_CLASS[size];
  const inner = (
    <>
      {loading ? (
        <Loader2 className={`${iconClass} animate-spin`} />
      ) : Icon ? (
        <Icon className={iconClass} />
      ) : null}
      {label}
    </>
  );

  if (href) {
    if (disabled || loading) {
      return (
        <span className={`${classes} pointer-events-none opacity-50`} aria-disabled="true" title={title}>
          {inner}
        </span>
      );
    }
    const isInternal =
      href.startsWith('/') && !href.startsWith('/api/') && !download && !target;
    if (isInternal) {
      return (
        <Link
          href={href}
          className={classes}
          onClick={onClick}
          aria-haspopup={ariaHasPopup}
          aria-expanded={ariaExpanded}
          title={title}
        >
          {inner}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        download={download}
        className={classes}
        onClick={onClick}
        aria-haspopup={ariaHasPopup}
        aria-expanded={ariaExpanded}
        title={title}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      title={title}
    >
      {inner}
    </button>
  );
}
