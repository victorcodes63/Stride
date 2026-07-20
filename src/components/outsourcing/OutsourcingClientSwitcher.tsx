'use client';

import { Building2 } from 'lucide-react';
import type { OutsourcingClientOption } from '@/lib/outsourcing-client-context';
import { StrideSelect } from '@/components/ui/stride-select';

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
      <StrideSelect
        value={allowAll && value === '' ? 'all' : value}
        onChange={(next) => onChange(next === 'all' ? 'all' : next)}
        disabled={disabled || clients.length === 0}
        ariaLabel={ariaLabel}
        options={[
          ...(allowAll ? [{ value: 'all', label: allLabel }] : []),
          ...clients.map((client) => ({ value: client.id, label: client.name })),
        ]}
      />
    </label>
  );
}
