'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  ListChecks,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

type WizardStep = 'validate' | 'generate' | 'review' | 'approve' | 'pay';

type RunOverview = {
  scope: {
    employeeCount: number;
    payrollCount: number;
    draftCount: number;
    approvedCount: number;
    paidCount: number;
  };
  setup?: {
    staffCount: number;
    staffWithSalaryCount: number;
    staffMissingSalaryCount: number;
  };
  payMethods?: {
    mpesaCount: number;
    mpesaNet: number;
    bankCount: number;
    bankNet: number;
  };
  validation: {
    readyCount: number;
    issueCount: number;
    issues: Array<{
      employeeId: string;
      employeeName: string;
      employeeNumber: string | null;
      issues: Array<'missing_pin' | 'missing_nssf' | 'missing_bank'>;
    }>;
  };
  totals: {
    gross: number;
    net: number;
    paye: number;
    nssf: number;
    nhif: number;
    ahl: number;
    headcount: number;
  };
  variance: {
    priorMonth: number;
    priorYear: number;
    grossDelta: number;
    netDelta: number;
    grossDeltaPct: number | null;
    topMovers: Array<{
      employeeId: string;
      employeeName: string;
      grossDelta: number | null;
      netDelta: number | null;
    }>;
  };
  auditTrail: Array<{
    id: string;
    action: string;
    actorEmail: string | null;
    createdAt: string;
  }>;
};

type MpesaReadiness = {
  provider: string;
  env: string;
  ready: boolean;
};

const STEPS: Array<{ id: WizardStep; label: string; hint: string }> = [
  { id: 'validate', label: 'Validate', hint: 'Check staff readiness' },
  { id: 'generate', label: 'Generate', hint: 'Create draft run' },
  { id: 'review', label: 'Review', hint: 'Verify amounts' },
  { id: 'approve', label: 'Approve', hint: 'Sign off the run' },
  { id: 'pay', label: 'Pay', hint: 'M-Pesa & bank file' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ISSUE_LABELS: Record<string, string> = {
  missing_pin: 'KRA PIN',
  missing_nssf: 'NSSF number',
  missing_bank: 'Bank details',
};

function stepIndex(step: WizardStep): number {
  return STEPS.findIndex((s) => s.id === step);
}

function SensitiveReauthPanel({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/re-auth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code: code || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Re-authentication failed');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50">
      <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        Confirm your password to continue
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Approving and paying payroll is a sensitive action and requires re-authentication.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-amber-800 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-amber-800 mb-1">MFA code (if enabled)</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white w-28"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
        >
          {loading ? 'Verifying…' : 'Verify'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-amber-800 hover:underline">
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </form>
  );
}

/** Compact KPI used inside the wizard body. */
function MiniStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'neutral' | 'emerald' | 'amber' | 'primary';
}) {
  const valueClass =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : 'text-primary-900';
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

export interface PayrollRunWizardProps {
  month: number;
  year: number;
  scope: 'all' | 'department';
  clientId: string;
  departmentId: string;
  payrollCount: number;
  draftCount: number;
  approvedCount: number;
  formatCurrency: (amount: number) => string;
  onGenerate: () => Promise<void>;
  generating: boolean;
  onApproved: () => void;
  onBankExport: () => Promise<void>;
  bankExportEnabled: boolean;
  apiBase?: string;
  basePath?: string;
  employeesPath?: string;
}

export function PayrollRunWizard({
  month,
  year,
  scope,
  clientId,
  departmentId,
  payrollCount,
  draftCount,
  approvedCount,
  formatCurrency,
  onGenerate,
  generating,
  onApproved,
  onBankExport,
  bankExportEnabled,
  apiBase = '/api/outsourcing/payroll',
  basePath = '/dashboard/outsourcing/payroll',
  employeesPath = '/dashboard/outsourcing/employees',
}: PayrollRunWizardProps) {
  const [step, setStep] = useState<WizardStep>('validate');
  const [userNavigated, setUserNavigated] = useState(false);
  const [overview, setOverview] = useState<RunOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<MpesaReadiness | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [showReauth, setShowReauth] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'export' | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      if (clientId.trim()) params.set('clientId', clientId.trim());
      if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
      const res = await fetch(`${apiBase}/run/overview?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load run overview');
      setOverview(data);
    } catch (e) {
      setOverviewError(e instanceof Error ? e.message : 'Failed to load overview');
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [month, year, scope, clientId, departmentId, apiBase]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/mpesa-readiness', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setReadiness(data as MpesaReadiness);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Auto-advance the guided run to the most relevant step until the user takes over.
  useEffect(() => {
    if (userNavigated) return;
    if (payrollCount === 0) setStep('generate');
    else if (draftCount > 0) setStep('review');
    else if (approvedCount > 0) setStep('pay');
    else setStep('review');
  }, [payrollCount, draftCount, approvedCount, userNavigated]);

  const goToStep = (next: WizardStep) => {
    setUserNavigated(true);
    setStep(next);
  };

  const currentStepIndex = stepIndex(step);
  const isLive = readiness?.provider === 'daraja';
  const paidCount = overview?.scope.paidCount ?? 0;
  const fullyPaid = payrollCount > 0 && paidCount === payrollCount;

  async function runApprove() {
    setApproving(true);
    setApproveError(null);
    setApproveMessage(null);
    try {
      const res = await fetch(`${apiBase}/run/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          year,
          ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
          ...(scope === 'department' && departmentId.trim() ? { departmentId: departmentId.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && String(data.error || '').includes('re-authentication')) {
        setPendingAction('approve');
        setShowReauth(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      setApproveMessage(data.message || 'Payroll run approved.');
      onApproved();
      await loadOverview();
      goToStep('pay');
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setApproving(false);
    }
  }

  async function runExport() {
    setExporting(true);
    try {
      await onBankExport();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      if (msg.includes('re-authentication')) {
        setPendingAction('export');
        setShowReauth(true);
        return;
      }
      throw e;
    } finally {
      setExporting(false);
    }
  }

  function handleReauthSuccess() {
    setShowReauth(false);
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'approve') void runApprove();
    if (action === 'export') void runExport();
  }

  const stepStatus = (idx: number): 'done' | 'active' | 'upcoming' => {
    if (idx < currentStepIndex) return 'done';
    if (idx === currentStepIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Stepper header */}
      <div className="border-b border-neutral-100 px-4 py-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
            <ListChecks className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary-900">Guided payroll run</p>
            <p className="text-xs text-neutral-500">
              {MONTHS[month - 1]} {year}
              {scope === 'department' && departmentId ? ' · by department' : ' · all in scope'}
            </p>
          </div>
        </div>
        <ol className="flex items-center">
          {STEPS.map((s, idx) => {
            const status = stepStatus(idx);
            const isLast = idx === STEPS.length - 1;
            return (
              <li key={s.id} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  onClick={() => goToStep(s.id)}
                  className="group flex items-center gap-2.5 text-left"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      status === 'active'
                        ? 'bg-primary-900 text-white ring-4 ring-primary-100'
                        : status === 'done'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200'
                    }`}
                  >
                    {status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </span>
                  <span className="hidden sm:block">
                    <span
                      className={`block text-xs font-semibold ${
                        status === 'upcoming' ? 'text-neutral-500' : 'text-primary-900'
                      }`}
                    >
                      {s.label}
                    </span>
                    <span className="block text-[11px] text-neutral-400">{s.hint}</span>
                  </span>
                </button>
                {!isLast && (
                  <span
                    className={`mx-2 h-0.5 flex-1 rounded-full ${
                      idx < currentStepIndex ? 'bg-emerald-400' : 'bg-neutral-200'
                    }`}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step body */}
      <div className="px-4 py-5 sm:px-6">
        {step === 'validate' && (
          <div>
            {loadingOverview ? (
              <div className="flex items-center gap-2 py-4 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking employee readiness…
              </div>
            ) : overviewError ? (
              <p className="text-sm text-red-700">{overviewError}</p>
            ) : overview ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="In scope" value={overview.scope.employeeCount} tone="primary" />
                  <MiniStat label="Ready" value={overview.validation.readyCount} tone="emerald" />
                  <MiniStat label="Need attention" value={overview.validation.issueCount} tone={overview.validation.issueCount > 0 ? 'amber' : 'neutral'} />
                  <MiniStat label="Existing records" value={overview.scope.payrollCount} />
                </div>
                {overview.setup && overview.setup.staffMissingSalaryCount > 0 && (
                  <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {overview.setup.staffMissingSalaryCount} employee(s) have no base salary set — they will be
                    skipped or generate a zero run. Set salaries on the employee record first.
                  </p>
                )}
                {overview.validation.issueCount > 0 ? (
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
                      <AlertTriangle className="h-4 w-4" />
                      Missing PIN, NSSF, or bank details
                    </p>
                    <ul className="max-h-48 space-y-1 overflow-auto text-sm text-neutral-700">
                      {overview.validation.issues.slice(0, 20).map((row) => (
                        <li key={row.employeeId} className="flex flex-wrap gap-x-2">
                          <span className="font-medium">{row.employeeName}</span>
                          <span className="text-neutral-500">
                            {row.issues.map((i) => ISSUE_LABELS[i] ?? i).join(', ')}
                          </span>
                          <Link
                            href={`${employeesPath}?highlight=${row.employeeId}`}
                            className="text-xs text-primary-700 hover:underline"
                          >
                            Fix
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-neutral-500">
                      You can still generate draft payroll; fix gaps before you pay.
                    </p>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    All employees in scope have PIN, NSSF, and bank details on file.
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToStep('generate')}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
                  >
                    Continue to generate
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {step === 'generate' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              Create draft payroll records for employees who do not yet have one for{' '}
              <strong>{MONTHS[month - 1]} {year}</strong>. Amounts are calculated from each employee&apos;s
              salary and Kenyan statutory rates.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onGenerate()}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                {generating ? 'Generating…' : payrollCount > 0 ? 'Generate remaining' : 'Generate payroll'}
              </button>
              {payrollCount > 0 && (
                <button
                  type="button"
                  onClick={() => goToStep('review')}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Review existing run
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
            {payrollCount > 0 && (
              <p className="flex items-center gap-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {payrollCount} record(s) exist ({draftCount} draft, {approvedCount} approved).
              </p>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {loadingOverview && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading review summary…
              </div>
            )}
            {overview && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MiniStat label="Headcount" value={overview.totals.headcount} tone="primary" />
                  <MiniStat label="Gross" value={formatCurrency(overview.totals.gross)} />
                  <MiniStat label="Net pay" value={formatCurrency(overview.totals.net)} tone="emerald" />
                </div>
                <div className="border-t border-neutral-100 pt-4">
                  <p className="text-sm font-medium text-primary-900">Prior-month variance</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    vs {MONTHS[overview.variance.priorMonth - 1]} {overview.variance.priorYear}:{' '}
                    gross {overview.variance.grossDelta >= 0 ? '+' : ''}
                    {formatCurrency(overview.variance.grossDelta)}
                    {overview.variance.grossDeltaPct != null ? ` (${overview.variance.grossDeltaPct}%)` : ''}
                    {' · '}
                    net {overview.variance.netDelta >= 0 ? '+' : ''}
                    {formatCurrency(overview.variance.netDelta)}
                  </p>
                  {overview.variance.topMovers.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                      {overview.variance.topMovers.slice(0, 5).map((row) => (
                        <li key={row.employeeId}>
                          {row.employeeName}: gross{' '}
                          {row.grossDelta != null
                            ? `${row.grossDelta >= 0 ? '+' : ''}${formatCurrency(row.grossDelta)}`
                            : '—'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-sm text-neutral-500">
                  Review individual rows in the table below and edit amounts before approving.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToStep('approve')}
                    disabled={payrollCount === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
                  >
                    Continue to approve
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'approve' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
              <div>
                <p className="text-sm font-medium text-primary-900">Approve the run</p>
                <p className="mt-0.5 text-sm text-neutral-600">
                  Approving locks the {draftCount > 0 ? `${draftCount} draft record(s)` : 'run'} for{' '}
                  {MONTHS[month - 1]} {year} and enables payment. This is a sensitive action and, under
                  separation of duties, may require a second approver and re-authentication.
                </p>
              </div>
            </div>
            {overview && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MiniStat label="Net to pay" value={formatCurrency(overview.totals.net)} tone="emerald" />
                <MiniStat label="Headcount" value={overview.totals.headcount} tone="primary" />
                <MiniStat label="Drafts" value={draftCount} tone={draftCount > 0 ? 'amber' : 'neutral'} />
              </div>
            )}
            {approveMessage && (
              <p className="flex items-center gap-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {approveMessage}
              </p>
            )}
            {approveError && <p className="text-sm text-red-700">{approveError}</p>}
            {draftCount > 0 ? (
              <button
                type="button"
                onClick={() => void runApprove()}
                disabled={approving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Approve payroll run
              </button>
            ) : approvedCount > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Run is approved.
                </p>
                <button
                  type="button"
                  onClick={() => goToStep('pay')}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
                >
                  Continue to pay
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Generate a run before approving.</p>
            )}
          </div>
        )}

        {step === 'pay' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-neutral-700">
                Pay approved net pay via automated M-Pesa B2C or a bank transfer file.
              </p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
                title={
                  isLive
                    ? 'M-Pesa B2C is configured for live disbursements'
                    : 'Disbursements run in simulation mode until Daraja credentials are configured'
                }
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isLive ? 'Live payments' : 'Simulation mode'}
              </span>
            </div>

            {fullyPaid && (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Every record for this period is paid. Send payslips and file returns from Reports &amp; compliance.
              </p>
            )}

            {overview?.payMethods && (overview.payMethods.mpesaCount > 0 || overview.payMethods.bankCount > 0) && (
              <div className="grid grid-cols-1 gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-neutral-100">
                <div className="sm:pr-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary-900">
                    <Smartphone className="h-4 w-4 text-primary-600" />
                    M-Pesa B2C
                  </div>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary-900">
                    {formatCurrency(overview.payMethods.mpesaNet)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {overview.payMethods.mpesaCount} employee(s) without bank details
                  </p>
                  <Link
                    href={`${basePath}/disbursements?month=${month}&year=${year}${clientId.trim() ? `&clientId=${encodeURIComponent(clientId.trim())}` : ''}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
                  >
                    <Smartphone className="h-4 w-4" />
                    Disburse via M-Pesa
                  </Link>
                </div>
                <div className="sm:pl-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary-900">
                    <Building2 className="h-4 w-4 text-primary-600" />
                    Bank transfer
                  </div>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary-900">
                    {formatCurrency(overview.payMethods.bankNet)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {overview.payMethods.bankCount} employee(s) with bank details
                  </p>
                  <button
                    type="button"
                    onClick={() => void runExport()}
                    disabled={!bankExportEnabled || exporting}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    title={bankExportEnabled ? 'Download bank batch CSV' : 'Approve the run before exporting'}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    Download bank file
                  </button>
                </div>
              </div>
            )}

            {!isLive && (
              <p className="text-xs text-neutral-500">
                Disbursements will be simulated. To enable live M-Pesa B2C, set{' '}
                <code className="rounded bg-neutral-100 px-1">MPESA_PROVIDER=daraja</code> and Daraja credentials.
              </p>
            )}
          </div>
        )}

        {showReauth && (
          <SensitiveReauthPanel
            onSuccess={handleReauthSuccess}
            onCancel={() => {
              setShowReauth(false);
              setPendingAction(null);
            }}
          />
        )}

        {overview && overview.auditTrail.length > 0 && (step === 'approve' || step === 'pay') && (
          <div className="mt-6 border-t border-neutral-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Audit trail</p>
            <ul className="space-y-2">
              {overview.auditTrail.map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-xs text-neutral-600">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-300" aria-hidden />
                  <span>
                    <span className="font-medium text-neutral-700">{e.action}</span>
                    {' · '}
                    {new Date(e.createdAt).toLocaleString()}
                    {e.actorEmail ? ` · ${e.actorEmail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
