'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import {
  DEFAULT_OUTSOURCING_REPORT_SECTIONS,
  OUTSOURCING_CLIENT_STATUSES,
  OUTSOURCING_REPORT_SECTIONS,
  type OutsourcingClientJson,
  type OutsourcingClientStatus,
  type OutsourcingReportSection,
} from '@/lib/outsourcing-client';

const inputClass =
  'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

export type EndClientFormValues = {
  name: string;
  status: OutsourcingClientStatus;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  county: string;
  postalAddress: string;
  contractStartDate: string;
  contractEndDate: string;
  contractNotes: string;
  paymentTerms: string;
  billingCycle: string;
  currency: string;
  kraPin: string;
  companyRegistrationNumber: string;
  clientLogoUrl: string;
  reportAccentColor: string;
  whiteLabelReports: boolean;
  reportRecipientEmails: string;
  reportSections: OutsourcingReportSection[];
};

export function endClientFormValuesFromJson(client?: Partial<OutsourcingClientJson> | null): EndClientFormValues {
  return {
    name: client?.name ?? '',
    status: client?.status ?? 'active',
    contactName: client?.contactName ?? '',
    contactEmail: client?.contactEmail ?? '',
    contactPhone: client?.contactPhone ?? '',
    county: client?.county ?? '',
    postalAddress: client?.postalAddress ?? '',
    contractStartDate: client?.contractStartDate ?? '',
    contractEndDate: client?.contractEndDate ?? '',
    contractNotes: client?.contractNotes ?? '',
    paymentTerms: client?.paymentTerms ?? '',
    billingCycle: client?.billingCycle ?? 'monthly',
    currency: client?.currency ?? 'KES',
    kraPin: client?.kraPin ?? '',
    companyRegistrationNumber: client?.companyRegistrationNumber ?? '',
    clientLogoUrl: client?.clientLogoUrl ?? '',
    reportAccentColor: client?.reportAccentColor ?? '',
    whiteLabelReports: client?.whiteLabelReports ?? false,
    reportRecipientEmails: (client?.reportRecipientEmails ?? []).join(', '),
    reportSections: client?.reportSections ?? [...DEFAULT_OUTSOURCING_REPORT_SECTIONS],
  };
}

export function endClientFormValuesToPayload(values: EndClientFormValues) {
  return {
    name: values.name.trim(),
    status: values.status,
    contactName: values.contactName.trim() || null,
    contactEmail: values.contactEmail.trim() || null,
    contactPhone: values.contactPhone.trim() || null,
    county: values.county.trim() || null,
    postalAddress: values.postalAddress.trim() || null,
    contractStartDate: values.contractStartDate || null,
    contractEndDate: values.contractEndDate || null,
    contractNotes: values.contractNotes.trim() || null,
    paymentTerms: values.paymentTerms.trim() || null,
    billingCycle: values.billingCycle || null,
    currency: values.currency.trim() || 'KES',
    kraPin: values.kraPin.trim() || null,
    companyRegistrationNumber: values.companyRegistrationNumber.trim() || null,
    clientLogoUrl: values.clientLogoUrl.trim() || null,
    reportAccentColor: values.reportAccentColor.trim() || null,
    whiteLabelReports: values.whiteLabelReports,
    reportRecipientEmails: values.reportRecipientEmails
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean),
    reportSections: values.reportSections,
  };
}

type EndClientFormProps = {
  initial?: Partial<OutsourcingClientJson> | null;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (payload: ReturnType<typeof endClientFormValuesToPayload>) => Promise<void>;
};

export function EndClientForm({ initial, submitLabel, cancelHref, onSubmit }: EndClientFormProps) {
  const [values, setValues] = useState<EndClientFormValues>(() => endClientFormValuesFromJson(initial));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EndClientFormValues>(key: K, value: EndClientFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const toggleSection = (section: OutsourcingReportSection) => {
    setValues((current) => {
      const has = current.reportSections.includes(section);
      const reportSections = has
        ? current.reportSections.filter((s) => s !== section)
        : [...current.reportSections, section];
      return { ...current, reportSections };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) {
      setError('End-client name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(endClientFormValuesToPayload(values));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save end-client');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <section className="dashboard-surface p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-primary-900">Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">End-client name</span>
            <input className={inputClass} value={values.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Status</span>
            <select className={inputClass} value={values.status} onChange={(e) => set('status', e.target.value as OutsourcingClientStatus)}>
              {OUTSOURCING_CLIENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Currency</span>
            <input className={inputClass} value={values.currency} onChange={(e) => set('currency', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Primary contact</span>
            <input className={inputClass} value={values.contactName} onChange={(e) => set('contactName', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Contact email</span>
            <input type="email" className={inputClass} value={values.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Contact phone</span>
            <input className={inputClass} value={values.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">County</span>
            <input className={inputClass} value={values.county} onChange={(e) => set('county', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="dashboard-surface p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-primary-900">Service contract</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Contract start</span>
            <input type="date" className={inputClass} value={values.contractStartDate} onChange={(e) => set('contractStartDate', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Contract end</span>
            <input type="date" className={inputClass} value={values.contractEndDate} onChange={(e) => set('contractEndDate', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Billing cycle</span>
            <select className={inputClass} value={values.billingCycle} onChange={(e) => set('billingCycle', e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="bi_weekly">Bi-weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Payment terms</span>
            <input className={inputClass} value={values.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="Net 30" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Contract notes</span>
            <textarea className={inputClass} rows={3} value={values.contractNotes} onChange={(e) => set('contractNotes', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="dashboard-surface p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-primary-900">Registration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">KRA PIN</span>
            <input className={inputClass} value={values.kraPin} onChange={(e) => set('kraPin', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Company registration no.</span>
            <input className={inputClass} value={values.companyRegistrationNumber} onChange={(e) => set('companyRegistrationNumber', e.target.value)} />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Postal address</span>
            <input className={inputClass} value={values.postalAddress} onChange={(e) => set('postalAddress', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="dashboard-surface p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-primary-900">Client-facing reports</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Branding and delivery settings for monthly report packs (OUT-08). Use the end-client logo for white-label PDFs.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={values.whiteLabelReports}
            onChange={(e) => set('whiteLabelReports', e.target.checked)}
          />
          White-label reports with this end-client&apos;s branding
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Client logo URL</span>
            <input className={inputClass} value={values.clientLogoUrl} onChange={(e) => set('clientLogoUrl', e.target.value)} placeholder="https://..." />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Report accent colour</span>
            <input className={inputClass} value={values.reportAccentColor} onChange={(e) => set('reportAccentColor', e.target.value)} placeholder="#E85D4C" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">Report recipients</span>
            <input
              className={inputClass}
              value={values.reportRecipientEmails}
              onChange={(e) => set('reportRecipientEmails', e.target.value)}
              placeholder="hr@client.co.ke, finance@client.co.ke"
            />
          </label>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-800">Report sections</p>
          <div className="flex flex-wrap gap-2">
            {OUTSOURCING_REPORT_SECTIONS.map((section) => {
              const active = values.reportSections.includes(section);
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => toggleSection(section)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    active
                      ? 'border-primary-300 bg-primary-50 text-primary-900'
                      : 'border-neutral-200 bg-white text-neutral-600'
                  }`}
                >
                  {section}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </button>
        <Link href={cancelHref} className="text-sm font-medium text-neutral-600 hover:text-primary-700">
          Cancel
        </Link>
      </div>
    </form>
  );
}
