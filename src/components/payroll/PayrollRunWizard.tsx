'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

type WizardStep = 'period' | 'validate' | 'generate' | 'review' | 'approve' | 'export';

type RunOverview = {
  scope: {
    employeeCount: number;
    payrollCount: number;
    draftCount: number;
    approvedCount: number;
    paidCount: number;
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

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 'period', label: 'Period' },
  { id: 'validate', label: 'Validate' },
  { id: 'generate', label: 'Generate' },
  { id: 'review', label: 'Review' },
  { id: 'approve', label: 'Approve' },
  { id: 'export', label: 'Export' },
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
    <form onSubmit={handleSubmit} className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50">
      <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        Confirm your password to continue
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
}: PayrollRunWizardProps) {
  const [step, setStep] = useState<WizardStep>('period');
  const [overview, setOverview] = useState<RunOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
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
      const res = await fetch(`/api/outsourcing/payroll/run/overview?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load run overview');
      setOverview(data);
    } catch (e) {
      setOverviewError(e instanceof Error ? e.message : 'Failed to load overview');
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [month, year, scope, clientId, departmentId]);

  useEffect(() => {
    if (step !== 'period') void loadOverview();
  }, [step, loadOverview]);

  useEffect(() => {
    if (payrollCount === 0 && step !== 'period' && step !== 'validate' && step !== 'generate') {
      setStep('generate');
    } else if (draftCount > 0 && step === 'export') {
      setStep('approve');
    }
  }, [payrollCount, draftCount, step]);

  const currentStepIndex = stepIndex(step);

  const canAdvance = useMemo(() => {
    if (step === 'validate') return overview != null;
    if (step === 'generate') return payrollCount > 0 || !generating;
    if (step === 'review') return payrollCount > 0;
    if (step === 'approve') return draftCount === 0 && approvedCount > 0;
    return true;
  }, [step, overview, payrollCount, generating, draftCount, approvedCount]);

  async function runApprove() {
    setApproving(true);
    setApproveError(null);
    setApproveMessage(null);
    try {
      const res = await fetch('/api/outsourcing/payroll/run/approve', {
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
      setStep('export');
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

  function nextStep() {
    const idx = stepIndex(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!.id);
  }

  function prevStep() {
    const idx = stepIndex(step);
    if (idx > 0) setStep(STEPS[idx - 1]!.id);
  }

  return (
    <div className="dashboard-surface shadow-sm p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-primary-900 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary-600" />
            Payroll run wizard
          </h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            Period → validate → generate → review → approve → export or disburse
          </p>
        </div>
      </div>

      <ol className="flex flex-wrap gap-1 sm:gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const done = idx < currentStepIndex;
          const active = s.id === step;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary-900 text-white'
                    : done
                      ? 'bg-primary-50 text-primary-800 hover:bg-primary-100'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {step === 'period' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            Run payroll for <strong>{MONTHS[month - 1]} {year}</strong>
            {scope === 'department' && departmentId ? ' · filtered by department' : ' · all employees in scope'}.
          </p>
          <p className="text-sm text-neutral-500">
            Adjust month, year, and scope using the controls below, then continue to validate employee readiness.
          </p>
        </div>
      )}

      {step === 'validate' && (
        <div>
          {loadingOverview ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking employee readiness…
            </div>
          ) : overviewError ? (
            <p className="text-sm text-red-700">{overviewError}</p>
          ) : overview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                  <p className="text-xs text-neutral-500">In scope</p>
                  <p className="text-lg font-semibold text-primary-900">{overview.scope.employeeCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-xs text-emerald-700">Ready</p>
                  <p className="text-lg font-semibold text-emerald-900">{overview.validation.readyCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs text-amber-700">Need attention</p>
                  <p className="text-lg font-semibold text-amber-900">{overview.validation.issueCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                  <p className="text-xs text-neutral-500">Existing records</p>
                  <p className="text-lg font-semibold text-primary-900">{overview.scope.payrollCount}</p>
                </div>
              </div>
              {overview.validation.issueCount > 0 ? (
                <div>
                  <p className="text-sm font-medium text-amber-900 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Missing PIN, NSSF, or bank details
                  </p>
                  <ul className="text-sm text-neutral-700 space-y-1 max-h-48 overflow-auto">
                    {overview.validation.issues.slice(0, 20).map((row) => (
                      <li key={row.employeeId} className="flex flex-wrap gap-x-2">
                        <span className="font-medium">{row.employeeName}</span>
                        <span className="text-neutral-500">
                          {row.issues.map((i) => ISSUE_LABELS[i] ?? i).join(', ')}
                        </span>
                        <Link
                          href={`/dashboard/outsourcing/employees?highlight=${row.employeeId}`}
                          className="text-primary-700 hover:underline text-xs"
                        >
                          Fix
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-neutral-500 mt-2">
                    You can still generate draft payroll; fix gaps before export/disbursement.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  All employees in scope have PIN, NSSF, and bank details on file.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {step === 'generate' && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Generate draft payroll records for employees who do not yet have a record for this period.
          </p>
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {generating ? 'Generating…' : 'Generate payroll'}
          </button>
          {payrollCount > 0 && (
            <p className="text-sm text-emerald-800">
              {payrollCount} record(s) exist for this period ({draftCount} draft, {approvedCount} approved).
            </p>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          {loadingOverview && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading review summary…
            </div>
          )}
          {overview && (
            <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-neutral-50 border">
              <p className="text-xs text-neutral-500">Gross</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(overview.totals.gross)}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-50 border">
              <p className="text-xs text-neutral-500">Net</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(overview.totals.net)}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-50 border">
              <p className="text-xs text-neutral-500">Headcount</p>
              <p className="text-lg font-semibold">{overview.totals.headcount}</p>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50">
            <p className="text-sm font-medium text-primary-900">Prior-month variance</p>
            <p className="text-sm text-neutral-600 mt-1">
              vs {MONTHS[overview.variance.priorMonth - 1]} {overview.variance.priorYear}:{' '}
              gross {overview.variance.grossDelta >= 0 ? '+' : ''}
              {formatCurrency(overview.variance.grossDelta)}
              {overview.variance.grossDeltaPct != null ? ` (${overview.variance.grossDeltaPct}%)` : ''}
              {' · '}
              net {overview.variance.netDelta >= 0 ? '+' : ''}
              {formatCurrency(overview.variance.netDelta)}
            </p>
            {overview.variance.topMovers.length > 0 && (
              <ul className="mt-2 text-xs text-neutral-600 space-y-1">
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
            Review individual rows in the table below. Edit amounts before approving the run.
          </p>
            </>
          )}
        </div>
      )}

      {step === 'approve' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            Approve all draft records in scope for {MONTHS[month - 1]} {year}.
            {draftCount > 0 ? ` ${draftCount} draft record(s) pending.` : ' No drafts remaining.'}
          </p>
          {approveMessage && (
            <p className="text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {approveMessage}
            </p>
          )}
          {approveError && <p className="text-sm text-red-700">{approveError}</p>}
          {draftCount > 0 && (
            <button
              type="button"
              onClick={() => void runApprove()}
              disabled={approving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Approve payroll run
            </button>
          )}
          {draftCount === 0 && approvedCount > 0 && (
            <p className="text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Run is approved — continue to export or M-Pesa disbursement.
            </p>
          )}
        </div>
      )}

      {step === 'export' && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Download the bank CSV or submit an M-Pesa disbursement batch for approved net pay.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runExport()}
              disabled={!bankExportEnabled || exporting}
              className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download bank file
            </button>
            <Link
              href={`/dashboard/payroll/disbursements?month=${month}&year=${year}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800"
            >
              <Smartphone className="w-4 h-4" />
              M-Pesa disbursement
            </Link>
          </div>
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

      {overview && overview.auditTrail.length > 0 && (step === 'approve' || step === 'export') && (
        <div className="mt-6 pt-4 border-t border-neutral-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Audit trail</p>
          <ul className="text-xs text-neutral-600 space-y-1">
            {overview.auditTrail.map((e) => (
              <li key={e.id}>
                {new Date(e.createdAt).toLocaleString()} · {e.action}
                {e.actorEmail ? ` · ${e.actorEmail}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-neutral-100">
        <button
          type="button"
          onClick={prevStep}
          disabled={currentStepIndex === 0}
          className="text-sm text-neutral-600 hover:text-primary-800 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={nextStep}
          disabled={currentStepIndex >= STEPS.length - 1 || !canAdvance}
          className="inline-flex items-center gap-1 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
