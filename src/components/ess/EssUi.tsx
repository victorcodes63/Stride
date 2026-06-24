'use client';

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Inbox, Loader2 } from 'lucide-react';

type PolymorphicProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function EssCard<T extends ElementType = 'section'>({
  as,
  children,
  className,
  ...props
}: PolymorphicProps<T>) {
  const Component = as || 'section';
  return (
    <Component className={cx('ess-card p-4', className)} {...props}>
      {children}
    </Component>
  );
}

export function EssPanel<T extends ElementType = 'div'>({
  as,
  children,
  className,
  ...props
}: PolymorphicProps<T>) {
  const Component = as || 'div';
  return (
    <Component className={cx('ess-card-flat p-4', className)} {...props}>
      {children}
    </Component>
  );
}

export function EssSectionTitle({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="ess-section-kicker">{eyebrow}</p> : null}
        <h2 className="mt-0.5 text-base font-bold text-[var(--ess-text)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--ess-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EssMetricCard({
  label,
  value,
  helper,
  icon,
  href,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  href?: string;
  tone?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]'
      : tone === 'success'
        ? 'bg-emerald-500/10 text-emerald-600'
        : tone === 'warning'
          ? 'bg-amber-500/10 text-amber-600'
          : 'bg-[var(--ess-secondary-soft)] text-[var(--ess-secondary)]';
  const body = (
    <div className="ess-card h-full min-h-[136px] p-4 transition-transform active:scale-[0.99]">
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[var(--ess-muted)]">{label}</p>
            <p className="mt-3 break-words text-2xl font-black leading-tight tracking-tight text-[var(--ess-text)]">{value}</p>
          </div>
          {icon ? (
            <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneClass)}>
              {icon}
            </span>
          ) : null}
        </div>
        {helper ? <p className="text-sm leading-5 text-[var(--ess-muted)]">{helper}</p> : null}
      </div>
    </div>
  );
  return href ? <Link className="block h-full" href={href}>{body}</Link> : body;
}

export function EssHeroMetric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="ess-card relative overflow-hidden p-5">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[var(--ess-primary-soft)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ess-muted)]">{label}</p>
          <p className="mt-3 text-3xl font-black leading-none tracking-tight text-[var(--ess-text)]">{value}</p>
          {helper ? <p className="mt-3 text-sm text-[var(--ess-muted)]">{helper}</p> : null}
        </div>
        {icon ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]">
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function EssListItem({
  title,
  subtitle,
  meta,
  icon,
  href,
  trailing,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  href?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  const body = (
    <div className={cx('flex min-h-[76px] items-center gap-3 rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-4 py-3', className)}>
      {icon ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[var(--ess-text)]">{title}</p>
        {subtitle ? <p className="mt-0.5 text-sm text-[var(--ess-muted)]">{subtitle}</p> : null}
        {meta ? <p className="mt-1 text-xs text-[var(--ess-subtle)]">{meta}</p> : null}
      </div>
      {trailing ?? (href ? <ArrowRight className="h-4 w-4 text-[var(--ess-subtle)]" /> : null)}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EssEmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="ess-card-flat px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ess-secondary-soft)] text-[var(--ess-secondary)]">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="mt-4 font-bold text-[var(--ess-text)]">{title}</p>
      {message ? <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--ess-muted)]">{message}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function EssAlert({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
      : tone === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
        : tone === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
          : 'border-[var(--ess-border)] bg-[var(--ess-secondary-soft)] text-[var(--ess-text)]';
  return (
    <div className={cx('flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm', toneClass)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EssLoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="ess-card-flat flex items-center justify-center gap-2 px-4 py-8 text-sm text-[var(--ess-muted)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export const essInputClass = 'ess-field';
export const essPrimaryButtonClass = 'ess-btn-primary';
export const essSecondaryButtonClass = 'ess-btn-secondary';
export const essGhostButtonClass = 'ess-btn-ghost';
