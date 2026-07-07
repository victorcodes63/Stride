'use client';

import { Building2 } from 'lucide-react';
import type { OutsourcingClientOption } from '@/lib/outsourcing-client-context';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';

type OutsourcingClientSwitcherProps = {
  clients: OutsourcingClientOption[];
  value: string;
  onChange: (clientId: string) => void;
  allowAll?: boolean;
  allLabel?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

export function OutsourcingClientSwitcher({
  clients,
  value,
  onChange,
  allowAll = false,
  allLabel = 'All end-clients',
  className,
  disabled = false,
  'aria-label': ariaLabel = 'End-client',
}: OutsourcingClientSwitcherProps) {
  if (clients.length <= 1 && !allowAll) return null;

  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--dash-text-muted)]">
        <Building2 className="h-3.5 w-3.5" aria-hidden />
        End-client
      </span>
      <select
        value={allowAll && value === '' ? 'all' : value}
        onChange={(e) => onChange(e.target.value === 'all' ? 'all' : e.target.value)}
        disabled={disabled || clients.length === 0}
        className={dashboardFilterSelectClass}
        aria-label={ariaLabel}
      >
        {allowAll ? <option value="all">{allLabel}</option> : null}
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </label>
  );
}
