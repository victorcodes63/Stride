'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  CalendarOff,
  Clock4,
  Download,
  FileText,
  FolderOpen,
  Mail,
  Pencil,
  Phone,
  Receipt,
  Scale,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StrideSelect } from '@/components/ui/stride-select';
import {
  outsourcingClientStatusLabel,
  type OutsourcingClientJson,
  type OutsourcingRateCardJson,
} from '@/lib/outsourcing-client';
import { withOutsourcingClientQuery } from '@/lib/outsourcing-client-context';
import { PayslipDomainCard } from '@/components/outsourcing/PayslipDomainCard';

interface Department {
  id: string;
  name: string;
  employeeCount: number;
}

interface ClientDetailViewProps {
  clientId: string;
}

function statusTone(status: OutsourcingClientJson['status']) {
  if (status === 'active') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'suspended') return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-neutral-700 bg-neutral-100 border-neutral-200';
}

export default function ClientDetailView({ clientId }: ClientDetailViewProps) {
  const searchParams = useSearchParams();
  const showWelcome = searchParams.get('welcome') === '1';
  const [dismissWelcome, setDismissWelcome] = useState(false);
  const [client, setClient] = useState<OutsourcingClientJson | null>(null);
  const [rateCards, setRateCards] = useState<OutsourcingRateCardJson[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateAmount, setRateAmount] = useState('');
  const [ratePricingModel, setRatePricingModel] = useState<'per_head' | 'flat' | 'percentage'>('per_head');
  const [ratePercentage, setRatePercentage] = useState('');
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [rateEffectiveTo, setRateEffectiveTo] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [billMonth, setBillMonth] = useState(String(new Date().getMonth() + 1));
  const [billYear, setBillYear] = useState(String(new Date().getFullYear()));
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [rpoJobs, setRpoJobs] = useState<{ id: string; title: string; isActive: boolean; applicationCount: number }[]>([]);

  const fetchClient = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/clients/${id}`);
      if (!res.ok) throw new Error('Failed to load client');
      const data = (await res.json()) as OutsourcingClientJson;
      setClient(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load client');
      setClient(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchRateCards = async (id: string) => {
    try {
      const res = await fetch(`/api/outsourcing/clients/${id}/rate-cards`);
      if (!res.ok) return;
      const data = await res.json();
      setRateCards(Array.isArray(data) ? data : []);
    } catch {
      setRateCards([]);
    }
  };

  const fetchDepartments = async (id: string) => {
    try {
      const res = await fetch(`/api/outsourcing/clients/${id}/departments`);
      if (!res.ok) return;
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
    }
  };

  const fetchRpoJobs = async (id: string) => {
    try {
      const res = await fetch(`/api/outsourcing/clients/${id}/jobs`);
      if (!res.ok) return;
      const data = (await res.json()) as { jobs?: { id: string; title: string; isActive: boolean; applicationCount: number }[] };
      setRpoJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch {
      setRpoJobs([]);
    }
  };

  useEffect(() => {
    void fetchClient(clientId);
    void fetchDepartments(clientId);
    void fetchRateCards(clientId);
    void fetchRpoJobs(clientId);
  }, [clientId]);

  const generateBill = async (mode: 'monthly' | 'payroll') => {
    setBillingBusy(true);
    setBillingError(null);
    setBillingMessage(null);
    try {
      const month = Number(billMonth);
      const year = Number(billYear);
      const res = await fetch('/api/outsourcing/billing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outsourcingClientId: clientId, month, year, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate invoice');
      setBillingMessage(
        `Draft invoice ${data.invoiceNumber} created (${data.headcount} employees, ${data.lines?.length ?? 0} lines).`,
      );
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : 'Billing failed');
    } finally {
      setBillingBusy(false);
    }
  };

  const reportUrl = (format: 'html' | 'json' | 'pdf') => {
    const params = new URLSearchParams({
      month: billMonth,
      year: billYear,
      format,
    });
    return `/api/outsourcing/clients/${clientId}/reports/monthly?${params.toString()}`;
  };

  const emailReport = async () => {
    setReportBusy(true);
    setReportError(null);
    setReportMessage(null);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/reports/monthly/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: Number(billMonth), year: Number(billYear) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to email report');
      setReportMessage(`Report emailed to ${(data.recipients as string[]).join(', ')}.`);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Failed to email report');
    } finally {
      setReportBusy(false);
    }
  };

  const addRateCard = async () => {
    const amount = Number(rateAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setRateError('Enter a valid amount.');
      return;
    }
    if (ratePricingModel === 'percentage') {
      const pct = Number(ratePercentage);
      if (!Number.isFinite(pct) || pct <= 0) {
        setRateError('Enter a valid percentage of payroll.');
        return;
      }
    } else if (amount <= 0) {
      setRateError('Enter a valid amount greater than zero.');
      return;
    }
    if (!rateEffectiveFrom) {
      setRateError('Effective from date is required.');
      return;
    }
    setRateError(null);
    setRateSaving(true);
    try {
      const percentageBps =
        ratePricingModel === 'percentage'
          ? Math.round(Number(ratePercentage) * 100)
          : undefined;
      const label =
        ratePricingModel === 'per_head'
          ? 'Per employee / month'
          : ratePricingModel === 'flat'
            ? 'Flat monthly fee'
            : 'Percentage of payroll';
      const res = await fetch(`/api/outsourcing/clients/${clientId}/rate-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Standard rate card',
          effectiveFrom: rateEffectiveFrom,
          effectiveTo: rateEffectiveTo || null,
          currency: client?.currency ?? 'KES',
          isActive: true,
          lines: [
            {
              serviceKey: ratePricingModel === 'flat' ? 'fixed_monthly' : 'per_head',
              label,
              pricingModel: ratePricingModel,
              unitAmount: ratePricingModel === 'percentage' ? Number(ratePercentage) : amount,
              percentageBps,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save rate card');
      setRateAmount('');
      setRatePercentage('');
      if (data.client) setClient(data.client as OutsourcingClientJson);
      await fetchRateCards(clientId);
    } catch (e) {
      setRateError(e instanceof Error ? e.message : 'Failed to save rate card');
    } finally {
      setRateSaving(false);
    }
  };

  if (loading || !client) {
    return (
      <div className="w-full min-w-0">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-200 rounded w-1/3" />
          <div className="h-10 bg-neutral-100 rounded w-full" />
          <div className="h-10 bg-neutral-100 rounded w-full" />
        </div>
      </div>
    );
  }

  const departmentCount = departments.length;
  const totalStaff = departments.reduce((s, d) => s + d.employeeCount, 0);
  const currency = client.currency ?? 'KES';
  const activeRateCard = client.activeRateCard ?? rateCards.find((card) => card.isActive) ?? null;

  return (
    <div className="w-full min-w-0">
      <nav className="mb-4 sm:mb-5" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
          <li>
            <Link href="/dashboard/outsourcing/clients" className="hover:text-primary-700 transition-colors">
              End clients
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-primary-900 font-medium" aria-current="page">
            {client.name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <DashboardPageHeader
            title={client.name}
            description="End-client profile, contract, rate card, and workforce shortcuts."
            className="!mb-0"
          />
          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone(client.status)}`}>
            {outsourcingClientStatusLabel(client.status)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href={`/dashboard/outsourcing/departments?clientId=${encodeURIComponent(clientId)}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-900 text-white rounded-xl font-semibold hover:bg-primary-800 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Departments
          </Link>
          <Link
            href={`/dashboard/outsourcing/employees/new?clientId=${encodeURIComponent(clientId)}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-900 text-white rounded-xl font-semibold hover:bg-primary-800 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add employee
          </Link>
          <Link
            href={withOutsourcingClientQuery('/dashboard/outsourcing/payroll', clientId)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-300 bg-white rounded-xl font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors"
          >
            <Receipt className="w-4 h-4" />
            Run payroll
          </Link>
          <Link
            href={withOutsourcingClientQuery('/dashboard/outsourcing/leave', clientId)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-300 bg-white rounded-xl font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors"
          >
            <CalendarOff className="w-4 h-4" />
            Leave
          </Link>
          <Link
            href={withOutsourcingClientQuery('/dashboard/outsourcing/attendance', clientId)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-300 bg-white rounded-xl font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors"
          >
            <Clock4 className="w-4 h-4" />
            Attendance
          </Link>
          <Link
            href={withOutsourcingClientQuery('/dashboard/outsourcing/disciplinary', clientId)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-300 bg-white rounded-xl font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors"
          >
            <Scale className="w-4 h-4" />
            Disciplinary
          </Link>
          <Link
            href={`/dashboard/outsourcing/employees?clientId=${encodeURIComponent(clientId)}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-300 bg-white rounded-xl font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </Link>
          <Link
            href={`/dashboard/outsourcing/clients/${clientId}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-200 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit end-client
          </Link>
        </div>
      </div>

      {showWelcome && !dismissWelcome ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-emerald-950">End-client created</p>
            <p className="text-sm text-emerald-900/90 mt-1">
              Add a rate card, create departments, then add or import the outsourced workforce.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissWelcome(true)}
            className="p-2 rounded-lg text-emerald-800 hover:bg-emerald-100/80 shrink-0 self-start"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      ) : null}

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Departments</p>
            <p className="text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums">{departmentCount}</p>
          </div>
          <div className="dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Workforce</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">{totalStaff}</p>
          </div>
          <div className="dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Currency</p>
            <p className="text-2xl sm:text-3xl font-bold text-primary-700 tabular-nums">{currency}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="dashboard-surface shadow-sm p-4 sm:p-6">
            <h2 className="text-base font-semibold text-primary-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-600" />
              Profile & contract
            </h2>
            <div className="space-y-4 text-sm text-neutral-700">
              {(client.contactName || client.contactEmail || client.contactPhone) && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Contact</p>
                  {client.contactName ? <p>{client.contactName}</p> : null}
                  {client.contactEmail ? (
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-neutral-400" />
                      <a href={`mailto:${client.contactEmail}`} className="text-primary-600 hover:underline">
                        {client.contactEmail}
                      </a>
                    </p>
                  ) : null}
                  {client.contactPhone ? (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-neutral-400" />
                      <a href={`tel:${client.contactPhone}`} className="text-primary-600 hover:underline">
                        {client.contactPhone}
                      </a>
                    </p>
                  ) : null}
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Contract</p>
                <p>
                  {client.contractStartDate
                    ? `${client.contractStartDate}${client.contractEndDate ? ` → ${client.contractEndDate}` : ' → ongoing'}`
                    : 'Not set'}
                </p>
                {client.paymentTerms ? <p className="text-neutral-600 mt-1">Payment terms: {client.paymentTerms}</p> : null}
                {client.contractNotes ? <p className="text-neutral-600 mt-2 whitespace-pre-wrap">{client.contractNotes}</p> : null}
              </div>
              {client.kraPin ? (
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">KRA PIN</p>
                  <p>{client.kraPin}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="dashboard-surface shadow-sm p-4 sm:p-6">
            <h2 className="text-base font-semibold text-primary-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Client-facing reports
            </h2>
            <div className="space-y-3 text-sm text-neutral-700">
              <p>
                White-label:{' '}
                <span className="font-medium">{client.whiteLabelReports ? 'Enabled' : 'Disabled'}</span>
              </p>
              {client.reportRecipientEmails.length > 0 ? (
                <p>Recipients: {client.reportRecipientEmails.join(', ')}</p>
              ) : (
                <p className="text-neutral-500">No report recipients configured yet.</p>
              )}
              <p>
                Sections: {client.reportSections.length > 0 ? client.reportSections.join(', ') : 'Default pack'}
              </p>
              {client.clientLogoUrl ? (
                <p className="truncate">Logo: {client.clientLogoUrl}</p>
              ) : null}
            </div>
          </div>
        </div>

        <PayslipDomainCard
          clientId={clientId}
          client={client}
          onUpdated={(updated) => setClient(updated)}
        />

        <div className="dashboard-surface shadow-sm p-4 sm:p-6">
          <h2 className="text-base font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary-600" />
            Rate card
          </h2>
          {activeRateCard ? (
            <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-medium text-neutral-900">
                {activeRateCard.name || 'Active rate card'} · effective {activeRateCard.effectiveFrom}
              </p>
              <ul className="mt-3 space-y-2">
                {activeRateCard.lines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between text-sm text-neutral-700">
                    <span>{line.label}</span>
                    <span className="font-medium tabular-nums">
                      {activeRateCard.currency} {line.unitAmount}
                      {line.pricingModel === 'percentage' && line.percentageBps != null
                        ? ` (${line.percentageBps / 100}%)`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-neutral-600 mb-4">
              No active rate card yet. Add a per-head, flat, or percentage-of-payroll fee to enable billing.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label>
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Pricing model</span>
              <StrideSelect
                value={ratePricingModel}
                onChange={(value) =>
                  setRatePricingModel(value as 'per_head' | 'flat' | 'percentage')
                }
                options={[
                  { value: 'per_head', label: 'Per employee / month' },
                  { value: 'flat', label: 'Flat monthly fee' },
                  { value: 'percentage', label: 'Percentage of payroll' },
                ]}
                ariaLabel="Pricing model"
                className="w-full"
              />
            </label>
            {ratePricingModel === 'percentage' ? (
              <label>
                <span className="mb-1.5 block text-sm font-medium text-neutral-800">Percentage (%)</span>
                <input
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                  value={ratePercentage}
                  onChange={(e) => setRatePercentage(e.target.value)}
                  placeholder="8.5"
                />
              </label>
            ) : (
              <label>
                <span className="mb-1.5 block text-sm font-medium text-neutral-800">
                  Amount ({currency})
                </span>
                <input
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                  value={rateAmount}
                  onChange={(e) => setRateAmount(e.target.value)}
                  placeholder={ratePricingModel === 'flat' ? '50000' : '3500'}
                />
              </label>
            )}
            <label>
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Effective from</span>
              <input
                type="date"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                value={rateEffectiveFrom}
                onChange={(e) => setRateEffectiveFrom(e.target.value)}
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Effective to (optional)</span>
              <input
                type="date"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                value={rateEffectiveTo}
                onChange={(e) => setRateEffectiveTo(e.target.value)}
              />
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={() => void addRateCard()}
                disabled={rateSaving}
                className="w-full rounded-xl bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {rateSaving ? 'Saving…' : activeRateCard ? 'Replace active rate card' : 'Add rate card'}
              </button>
            </div>
          </div>
          {rateError ? <p className="mt-2 text-sm text-red-700">{rateError}</p> : null}
          {rateCards.length > 1 ? (
            <div className="mt-4 border-t border-neutral-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                Rate card history
              </p>
              <ul className="space-y-2 text-sm text-neutral-700">
                {rateCards.map((card) => (
                  <li key={card.id} className="flex items-center justify-between gap-3">
                    <span>
                      {card.name || 'Rate card'} · {card.effectiveFrom}
                      {card.effectiveTo ? ` → ${card.effectiveTo}` : ''}
                      {card.isActive ? ' (active)' : ''}
                    </span>
                    <span className="tabular-nums text-neutral-500">
                      {card.lines.length} line{card.lines.length === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="dashboard-surface shadow-sm p-4 sm:p-6">
          <h2 className="text-base font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Billing &amp; reports (OUT-07 / OUT-08)
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-4">
            <label className="flex-1">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Billing month</span>
              <input
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                type="number"
                min={1}
                max={12}
                value={billMonth}
                onChange={(e) => setBillMonth(e.target.value)}
              />
            </label>
            <label className="flex-1">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Year</span>
              <input
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                type="number"
                min={2000}
                max={2100}
                value={billYear}
                onChange={(e) => setBillYear(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={billingBusy}
              onClick={() => void generateBill('monthly')}
              className="rounded-xl bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
            >
              {billingBusy ? 'Working…' : 'Generate monthly invoice'}
            </button>
            <button
              type="button"
              disabled={billingBusy}
              onClick={() => void generateBill('payroll')}
              className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-900 hover:bg-primary-100 disabled:opacity-60"
            >
              Payroll pass-through bill
            </button>
            <a
              href={reportUrl('html')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" />
              Monthly report (HTML)
            </a>
            <a
              href={reportUrl('pdf')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" />
              Monthly report (PDF)
            </a>
            <button
              type="button"
              disabled={reportBusy}
              onClick={() => void emailReport()}
              className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-900 hover:bg-primary-100 disabled:opacity-60"
            >
              <Mail className="h-4 w-4" />
              {reportBusy ? 'Sending…' : 'Email PDF report'}
            </button>
            <a
              href={reportUrl('json')}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Report JSON
            </a>
          </div>
          {billingMessage ? <p className="mt-3 text-sm text-emerald-800">{billingMessage}</p> : null}
          {billingError ? <p className="mt-3 text-sm text-red-700">{billingError}</p> : null}
          {reportMessage ? <p className="mt-3 text-sm text-emerald-800">{reportMessage}</p> : null}
          {reportError ? <p className="mt-3 text-sm text-red-700">{reportError}</p> : null}
        </div>

        <div className="dashboard-surface shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-600" />
                RPO jobs (OUT-06)
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                Recruitment roles scoped to this end-client workforce.
              </p>
            </div>
            <Link
              href={`/dashboard/outsourcing/jobs/new?clientId=${encodeURIComponent(clientId)}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-primary-200 bg-primary-50 text-primary-900 rounded-xl font-semibold text-sm hover:bg-primary-100 shrink-0"
            >
              Post RPO job
            </Link>
          </div>
          {rpoJobs.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {rpoJobs.map((job) => (
                <li key={job.id} className="flex justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2">
                  <span className="font-medium text-neutral-900">{job.title}</span>
                  <span className="text-neutral-600">
                    {job.isActive ? 'Active' : 'Closed'} · {job.applicationCount} applicants
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-600 mt-4">No RPO jobs linked to this end-client yet.</p>
          )}
        </div>

        <div className="dashboard-surface shadow-sm p-4 sm:p-6" id="departments">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                Workforce setup
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                Add departments, then assign or import employees for this end-client.
              </p>
            </div>
            <Link
              href={`/dashboard/outsourcing/departments?clientId=${encodeURIComponent(clientId)}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-primary-200 bg-primary-50 text-primary-900 rounded-xl font-semibold text-sm hover:bg-primary-100 shrink-0"
            >
              Open departments
            </Link>
          </div>
          {departments.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {departments.map((d) => (
                <li
                  key={d.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-sm text-neutral-800"
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="text-neutral-500 text-xs">({d.employeeCount} staff)</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-amber-800 mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
              No departments yet. Add departments before importing employees.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
