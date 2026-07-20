'use client';

import { Loader2 } from 'lucide-react';
import type { PaymentAccountDetails, PaymentAccountRow } from '@/lib/payment-accounts';
import { StrideSelect } from '@/components/ui/stride-select';

export function InvoiceBankDisplay({ details }: { details: PaymentAccountDetails }) {
  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/90 print:border-neutral-300 print:bg-neutral-100 print:p-3 text-left print:[print-color-adjust:exact]">
      <p className="text-sm font-bold text-primary-900 mb-3 print:text-xs">Payment details</p>
      <div className="text-sm text-neutral-700 space-y-2 print:text-[9px]">
        <p>Account name: {details.accountName}</p>
        <p>Bank: {details.bank}</p>
        <p className="tabular-nums">Account number: {details.accountNumber}</p>
        {details.bankCode ? <p className="tabular-nums">Bank code: {details.bankCode}</p> : null}
        {details.branchCode ? <p className="tabular-nums">Branch code: {details.branchCode}</p> : null}
        {details.swiftCode ? <p className="tabular-nums">SWIFT: {details.swiftCode}</p> : null}
      </div>
    </div>
  );
}

type SelectProps = {
  accounts: PaymentAccountRow[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  saving?: boolean;
  compact?: boolean;
  loading?: boolean;
};

export function InvoicePaymentAccountSelect({
  accounts,
  value,
  onChange,
  disabled,
  saving,
  compact,
  loading,
}: SelectProps) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 print:hidden">
        Payment account on invoice
      </label>
      <div className="relative print:hidden">
        <StrideSelect
          className="w-full"
          ariaLabel="Payment account on invoice"
          value={value}
          disabled={disabled || saving || loading || accounts.length === 0}
          onChange={(id) => onChange(id)}
          options={
            accounts.length === 0
              ? [{ value: '', label: 'No payment accounts configured' }]
              : accounts.map((account) => ({
                  value: account.id,
                  label: `${account.label}${account.isPayrollOnly ? ' (payroll)' : ''}`,
                }))
          }
        />
        {(saving || loading) && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2 text-neutral-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}
      </div>
      <p className="text-[11px] text-neutral-500 print:hidden">
        Chooses which company bank account appears on the PDF and when printing.{' '}
        <a href="/dashboard/accounts/invoicing-setup" className="font-medium text-primary-800 hover:underline">
          Invoicing setup
        </a>
      </p>
    </div>
  );
}
