'use client';

/**
 * Marketing previews built from the dashboard's real components, fed the demo tenant.
 * Only import presentational dashboard components here. Nothing that fetches data,
 * reads the session or touches the database.
 */
import {
  BookOpen,
  Building2,
  CheckCircle2,
  FileText,
  Home,
  Landmark,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatBadge, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { ModuleKpiSnapshotCard } from '@/components/dashboard/overview/ModuleKpiSnapshotCard';
import { NeedsAttentionSection } from '@/components/dashboard/overview/NeedsAttentionSection';
import { OverviewModuleCommandCenter } from '@/components/dashboard/overview/OverviewModuleCommandCenter';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { DEMO_STATUTORY, DEMO_TENANT } from '@/components/marketing/mockups/demo-data';
import {
  DEMO_ATTENTION_ITEMS,
  DEMO_DOMAINS,
  DEMO_DOMAIN_SNAPSHOTS,
  DEMO_KPIS,
  DEMO_TEAM_SIZE,
  demoAttentionByDomain,
} from './demo-tenant';
import { ProductFrame } from './ProductFrame';

type FrameOptions = {
  className?: string;
  /** Fill a fixed-height parent (crops the bottom like a screenshot). */
  fill?: boolean;
  designWidth?: number;
};

function domainIcon(id: DashboardModuleDomainId) {
  return DEMO_DOMAINS.find((d) => d.id === id)!.icon;
}

/** Row of "Across the business" KPI cards. */
function KpiRow({ domains }: { domains?: DashboardModuleDomainId[] }) {
  const kpis = domains ? DEMO_KPIS.filter((k) => domains.includes(k.domainId)) : DEMO_KPIS;
  return (
    <div className={`grid gap-3 ${kpis.length >= 4 ? 'grid-cols-4' : kpis.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {kpis.map((kpi) => (
        <ModuleKpiSnapshotCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          note={kpi.note}
          icon={domainIcon(kpi.domainId)}
          href="#"
          chartSegments={kpi.segments}
        />
      ))}
    </div>
  );
}

/**
 * The dashboard home: KPI cards plus "Needs attention now".
 * Pass `domains` to narrow it to one area (e.g. HR & Payroll).
 */
export function ProductOverviewSlice({
  domains,
  ...frame
}: FrameOptions & { domains?: DashboardModuleDomainId[] }) {
  const items = domains ? DEMO_ATTENTION_ITEMS.filter((i) => domains.includes(i.domainId)) : DEMO_ATTENTION_ITEMS;
  const visibleDomains = domains ? DEMO_DOMAINS.filter((d) => domains.includes(d.id)) : DEMO_DOMAINS;
  return (
    <ProductFrame
      label="Stride dashboard: today's numbers and the items that need attention"
      path="/dashboard"
      designWidth={frame.designWidth ?? 720}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        <KpiRow domains={domains} />
        <NeedsAttentionSection
          items={items}
          domains={visibleDomains}
          attentionByDomain={demoAttentionByDomain(items)}
        />
      </div>
    </ProductFrame>
  );
}

/** "Business pulse": one-line status for every module switched on, optionally under the KPI row. */
export function ProductBusinessPulseSlice({ withKpis = false, ...frame }: FrameOptions & { withKpis?: boolean }) {
  return (
    <ProductFrame
      label="Stride business pulse: one status line per module"
      path="/dashboard"
      designWidth={frame.designWidth ?? 720}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        {withKpis ? <KpiRow /> : null}
        <OverviewModuleCommandCenter
          domains={DEMO_DOMAINS}
          attentionByDomain={demoAttentionByDomain()}
          domainSnapshots={DEMO_DOMAIN_SNAPSHOTS}
        />
      </div>
    </ProductFrame>
  );
}

const WHY_OBLIGATIONS = [
  { label: 'PAYE', portal: 'KRA iTax', icon: Building2, amount: DEMO_STATUTORY.rows[0]!.amount },
  { label: 'NSSF', portal: 'NSSF eServices', icon: ShieldCheck, amount: DEMO_STATUTORY.rows[1]!.amount },
  { label: 'SHIF', portal: 'SHA portal', icon: Landmark, amount: DEMO_STATUTORY.rows[2]!.amount },
  { label: 'Housing Levy', portal: 'KRA iTax', icon: Home, amount: DEMO_STATUTORY.rows[3]!.amount },
] as const;

/**
 * Homepage "Why we built it": the real statutory returns surface, telling the Kenya-native story
 * (PAYE / NSSF / SHIF / Housing Levy filed in one run, then M-Pesa on the same pay cycle).
 */
export function ProductWhyStrideSlice(frame: FrameOptions = {}) {
  const filedCount = WHY_OBLIGATIONS.length;

  return (
    <ProductFrame
      label="Stride Kenya payroll statutory returns: PAYE, NSSF, SHIF and Housing Levy filed, with M-Pesa disbursement on the same run"
      path="/dashboard/payroll/statutory"
      designWidth={frame.designWidth ?? 780}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        <DashboardPageHeader
          eyebrow="Payroll (Kenya)"
          title={`Statutory · ${DEMO_STATUTORY.period}`}
          description={`${DEMO_TENANT.name} · ${DEMO_STATUTORY.employeeCount} employees across ${DEMO_TENANT.entityCount} entities`}
          titleAs="p"
          badges={[{ label: 'Filed', icon: CheckCircle2 }]}
        />

        <div className="dashboard-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-[var(--dash-text-strong)]">
                {filedCount} of {filedCount} obligations filed
              </p>
              <p className="mt-0.5 text-xs text-[var(--dash-text-subtle)]">
                Same pay run. Same employee records. No bolt-ons.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dash-success-fg)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Ready for KRA
            </span>
          </div>
          <div className="h-1 bg-[var(--dash-surface-muted)]">
            <div className="h-full w-full bg-primary-600" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {WHY_OBLIGATIONS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="dashboard-panel flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-2 border-b border-[var(--dash-border)] px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)]">
                      <Icon className="h-4 w-4 text-[var(--dash-text-muted)]" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--dash-text-strong)]">{item.label}</p>
                      <p className="truncate text-[11px] text-[var(--dash-text-subtle)]">{item.portal}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--dash-success-fg)]">
                    Filed
                  </span>
                </div>
                <div className="flex items-end justify-between px-3.5 py-3">
                  <span className="text-xs text-[var(--dash-text-muted)]">Total due</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--dash-text-strong)]">
                    {item.amount}
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="dashboard-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
              <Smartphone className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--dash-text-strong)]">M-Pesa B2C disbursement</p>
              <p className="text-xs text-[var(--dash-text-muted)]">
                {DEMO_STATUTORY.employeeCount} paid on the same cycle as statutory filing
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dash-success-fg)]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Disbursed
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {['Kenya + Uganda entities', 'Logistics pack on', 'HR & Finance core'].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-1 text-[11px] font-medium text-[var(--dash-text-muted)]"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </ProductFrame>
  );
}

const COMPLIANCE_OBLIGATIONS = [
  { label: 'PAYE', detail: 'KRA income tax', icon: Building2 },
  { label: 'NSSF', detail: 'Pension contribution', icon: ShieldCheck },
  { label: 'SHIF', detail: 'Health insurance', icon: Landmark },
  { label: 'Housing Levy', detail: 'Affordable housing', icon: Home },
] as const;

const COMPLIANCE_LEDGER: { account: string; side: 'Dr' | 'Cr' }[] = [
  { account: 'Salaries & wages', side: 'Dr' },
  { account: 'PAYE payable', side: 'Cr' },
  { account: 'NSSF payable', side: 'Cr' },
  { account: 'SHIF payable', side: 'Cr' },
  { account: 'Housing Levy payable', side: 'Cr' },
  { account: 'Net pay clearing', side: 'Cr' },
];

/** Homepage compliance scroll: payroll run approved with synced inputs. */
export function ProductComplianceRunSlice(frame: FrameOptions = {}) {
  return (
    <ProductFrame
      label="Stride payroll run: September pay run approved with leave, attendance and allowances synced"
      path="/dashboard/payroll"
      designWidth={frame.designWidth ?? 640}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        <DashboardPageHeader
          eyebrow="Payroll"
          title="September pay run"
          description={`${DEMO_TEAM_SIZE} employees · ${DEMO_TENANT.hq} head office`}
          titleAs="p"
          badges={[{ label: 'Approved', icon: CheckCircle2 }]}
        />
        <DashboardStatGrid columns={3}>
          <DashboardStatBadge label="Staff on run" value={DEMO_TEAM_SIZE} hint="All records active" icon={Users} size="compact" />
          <DashboardStatBadge label="Leave" value="Synced" hint="Applied to payslips" size="compact" />
          <DashboardStatBadge label="Attendance" value="Synced" hint="Overtime included" size="compact" />
        </DashboardStatGrid>
        <div className="dashboard-panel divide-y divide-[var(--dash-border)] overflow-hidden">
          {['Leave applied', 'Attendance & overtime', 'Allowances & deductions'].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-[var(--dash-text-strong)]">{row}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--dash-success-fg)]">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Synced
              </span>
            </div>
          ))}
        </div>
      </div>
    </ProductFrame>
  );
}

/**
 * Homepage compliance scroll: statutory deductions computed on every payslip
 * (compact dashboard surface; pairs with the Why section's fuller ProductWhyStrideSlice).
 */
export function ProductComplianceStatutorySlice(frame: FrameOptions = {}) {
  return (
    <ProductFrame
      label="Stride statutory deductions: PAYE, NSSF, SHIF and Housing Levy applied to every payslip"
      path="/dashboard/payroll/statutory"
      designWidth={frame.designWidth ?? 640}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        <DashboardPageHeader
          eyebrow="Payroll (Kenya)"
          title="Statutory deductions"
          description={`Applied to every payslip · ${DEMO_STATUTORY.period}`}
          titleAs="p"
          badges={[{ label: '4 of 4', icon: CheckCircle2 }]}
        />
        <div className="grid grid-cols-2 gap-3">
          {COMPLIANCE_OBLIGATIONS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="dashboard-panel flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-2 px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)]">
                      <Icon className="h-4 w-4 text-[var(--dash-text-muted)]" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--dash-text-strong)]">{item.label}</p>
                      <p className="truncate text-[11px] text-[var(--dash-text-subtle)]">{item.detail}</p>
                    </div>
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] text-[var(--dash-success-fg)]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </ProductFrame>
  );
}

/** Homepage compliance scroll: M-Pesa B2C bulk payout. */
export function ProductCompliancePayoutSlice(frame: FrameOptions = {}) {
  return (
    <ProductFrame
      label="Stride M-Pesa bulk payout: salaries disbursed in one batch and reconciled to payroll"
      path="/dashboard/payroll/disbursements"
      designWidth={frame.designWidth ?? 640}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        <DashboardPageHeader
          eyebrow="Disbursements"
          title="M-Pesa bulk payout"
          description={`Salaries · ${DEMO_STATUTORY.period}`}
          titleAs="p"
          badges={[{ label: 'Sent', icon: CheckCircle2 }]}
        />
        <div className="dashboard-panel overflow-hidden px-4 py-4 sm:px-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--dash-text-strong)]">
                {DEMO_TEAM_SIZE}
              </p>
              <p className="mt-1.5 text-xs text-[var(--dash-text-muted)]">payouts in one batch</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
              <Smartphone className="h-5 w-5" strokeWidth={1.75} />
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
            <div className="h-full w-full rounded-full bg-primary-600" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-[var(--dash-text-subtle)]">
            <span>Batch submitted</span>
            <span className="tabular-nums">
              {DEMO_TEAM_SIZE} / {DEMO_TEAM_SIZE} delivered
            </span>
          </div>
        </div>
        <div className="dashboard-panel flex items-center justify-between gap-3 px-4 py-3.5">
          <p className="text-sm text-[var(--dash-text-strong)]">Reconciled against payroll</p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--dash-success-fg)]">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Matched
          </span>
        </div>
      </div>
    </ProductFrame>
  );
}

/** Homepage compliance scroll: payroll journal auto-posted to the ledger. */
export function ProductComplianceLedgerSlice(frame: FrameOptions = {}) {
  return (
    <ProductFrame
      label="Stride payroll journal: expenses, statutory liabilities and net pay posted to the general ledger"
      path="/dashboard/finance/ledger"
      designWidth={frame.designWidth ?? 640}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        <DashboardPageHeader
          eyebrow="Finance"
          title="Payroll journal"
          description="General ledger · auto-posted"
          titleAs="p"
          badges={[{ label: 'Posted', icon: BookOpen }]}
        />
        <div className="dashboard-panel overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] border-b border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-text-subtle)]">
            <span>Account</span>
            <span>Entry</span>
          </div>
          {COMPLIANCE_LEDGER.map((line) => (
            <div
              key={line.account}
              className="grid grid-cols-[1fr_auto] items-center border-t border-[var(--dash-border)] px-4 py-3 first:border-t-0"
            >
              <span className={`text-sm text-[var(--dash-text-strong)] ${line.side === 'Cr' ? 'pl-4' : ''}`}>
                {line.account}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  line.side === 'Dr'
                    ? 'bg-[var(--dash-text-strong)] text-white'
                    : 'bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]'
                }`}
              >
                {line.side}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ProductFrame>
  );
}

/** Homepage compliance scroll: payslips issued and statutory returns ready to file. */
export function ProductComplianceFiledSlice(frame: FrameOptions = {}) {
  const files = [
    { name: 'Payslips', detail: `${DEMO_TEAM_SIZE} sent to self-service`, status: 'Done' as const },
    { name: 'PAYE return', detail: 'Exported for iTax', status: 'iTax-ready' as const },
    { name: 'Statutory schedules', detail: 'NSSF · SHIF · Housing Levy', status: 'Done' as const },
  ];

  return (
    <ProductFrame
      label="Stride payroll outputs: payslips issued and PAYE return ready for iTax"
      path="/dashboard/payroll/exports"
      designWidth={frame.designWidth ?? 640}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        <DashboardPageHeader
          eyebrow="Payroll"
          title="Ready to file"
          description={`${DEMO_STATUTORY.period} outputs`}
          titleAs="p"
          badges={[{ label: 'Complete', icon: CheckCircle2 }]}
        />
        <div className="space-y-2.5">
          {files.map((file) => (
            <div key={file.name} className="dashboard-panel flex items-center gap-3.5 px-3.5 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] text-[var(--dash-text-muted)]">
                <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--dash-text-strong)]">{file.name}</p>
                <p className="truncate text-[12px] text-[var(--dash-text-subtle)]">{file.detail}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  file.status === 'iTax-ready'
                    ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900 dark:bg-primary-950/40 dark:text-primary-300'
                    : 'border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] text-[var(--dash-success-fg)]'
                }`}
              >
                {file.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ProductFrame>
  );
}
