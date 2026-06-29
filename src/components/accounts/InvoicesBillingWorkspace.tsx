'use client';

import { FileText, Receipt, Wallet } from 'lucide-react';
import useEntityConfig, { useDisplayMoney } from '@/hooks/useEntityConfig';

type InvoiceStats = {
  total: number;
  open: number;
  paid: number;
  partial: number;
  totalIncVat: number;
  currency: string;
};

type Props = {
  invoices: InvoiceStats;
  filteredCount: number;
};

export function InvoicesBillingWorkspace({ invoices, filteredCount }: Props) {
  const entityConfig = useEntityConfig();
  const displayMoney = useDisplayMoney();

  return (
    <section className="dashboard-surface shadow-sm overflow-hidden mb-6">
      <div className="bg-primary-900 text-white px-5 sm:px-6 py-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary-200/90">Billing workspace</p>
        <p className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums">
          {invoices.total} invoice{invoices.total === 1 ? '' : 's'}
        </p>
        <p className="mt-1 text-sm text-primary-100/90">
          {invoices.open} open · {invoices.paid} paid
          {invoices.partial > 0 ? ` · ${invoices.partial} partial` : ''}
          {filteredCount !== invoices.total ? ` · ${filteredCount} in view` : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-neutral-100">
        <StatCell
          icon={FileText}
          label="In list"
          value={String(filteredCount)}
          hint={filteredCount !== invoices.total ? 'Filtered' : 'Matching filters'}
        />
        <StatCell icon={Wallet} label="Open" value={String(invoices.open)} hint="Awaiting payment" />
        <StatCell icon={Receipt} label="Paid" value={String(invoices.paid)} hint="Fully settled" />
        <StatCell
          icon={FileText}
          label="Total (incl. VAT)"
          value={displayMoney(invoices.totalIncVat, invoices.currency)}
          hint={entityConfig.currency.code}
        />
      </div>
    </section>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="px-4 sm:px-5 py-4 flex gap-3 items-start">
      <div className="rounded-lg bg-primary-50 p-2 text-primary-800 shrink-0">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
        <p className="text-lg font-semibold text-neutral-900 tabular-nums truncate">{value}</p>
        <p className="text-xs text-neutral-500">{hint}</p>
      </div>
    </div>
  );
}
