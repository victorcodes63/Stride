'use client';

import type React from 'react';

/** Shared Company setup / Branding form primitives so both surfaces render identically. */

export const inputClass = 'dash-setup-input';

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="dashboard-surface shadow-sm p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold dash-setup-heading flex items-center gap-2">
            {Icon ? <Icon className="w-5 h-5 dash-setup-heading-icon" /> : null}
            {title}
          </h2>
          {description ? <p className="text-sm dash-setup-muted mt-1">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium dash-setup-label mb-1">{label}</label>
      {children}
      {hint ? <p className="text-xs dash-setup-muted mt-1">{hint}</p> : null}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`dash-setup-toggle-row ${disabled ? 'dash-setup-toggle-row--disabled' : ''}`}>
      <span>
        <span className="block text-sm font-medium dash-setup-label">{label}</span>
        <span className="block text-xs dash-setup-muted mt-0.5">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="dash-setup-control mt-1 h-4 w-4 rounded border-[var(--dash-border)]"
      />
    </label>
  );
}

export function TierLockedNotice({ message }: { message: string }) {
  return <p className="dash-setup-notice">{message}</p>;
}

/** Distinguishes a capability granted as a per-customer add-on from a tier-included one. */
export function EntitlementBadge({ variant }: { variant: 'included' | 'addon' | 'locked' }) {
  const map = {
    included: { label: 'Included', className: 'dash-brand-badge dash-brand-badge--included' },
    addon: { label: 'Add-on', className: 'dash-brand-badge dash-brand-badge--addon' },
    locked: { label: 'Locked', className: 'dash-brand-badge dash-brand-badge--locked' },
  } as const;
  const { label, className } = map[variant];
  return <span className={className}>{label}</span>;
}
