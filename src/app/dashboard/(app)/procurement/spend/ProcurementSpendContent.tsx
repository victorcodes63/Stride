'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Loader2, AlertCircle, ShoppingCart, Building2, Wallet, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type SpendReport = {
  year: number;
  currency: string;
  totals: {
    committed: number;
    ordered: number;
    received: number;
    invoiced: number;
  };
  byDepartment: Array<{
    key: string;
    label: string;
    committed: number;
    ordered: number;
    invoiced: number;
    budgetAllocated: number;
  }>;
  byVendor: Array<{
    vendorId: string;
    vendorName: string;
    committed: number;
    ordered: number;
    invoiced: number;
  }>;
  byBudgetLine: Array<{
    budgetLineId: string;
    budgetName: string;
    lineName: string;
    department: string | null;
    allocated: number;
    budgetSpent: number;
    procurementSpend: number;
  }>;
  monthlyOrdered: number[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtMoney(v: number, currency = 'KES') {
  return v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-neutral-600">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function BarChartSimple({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={`w-full rounded-t ${color}`}
            style={{ height: `${Math.max((v / max) * 100, 2)}%` }}
            title={fmtMoney(v)}
          />
          <span className="text-[9px] text-neutral-400">{MONTHS[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function ProcurementSpendContent() {
  const [report, setReport] = useState<SpendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/procurement/spend?year=${year}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data;
      })
      .then((data) => setReport(data.report ?? null))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const c = report?.currency ?? 'KES';

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={BarChart3}
        title="Procurement spend"
        description="Committed, ordered, received, and invoiced spend by department, vendor, and budget line."
        actions={
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                FY {y}
              </option>
            ))}
          </select>
        }
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-neutral-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading spend data…
        </div>
      )}

      {!loading && error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Committed (PRs)" value={fmtMoney(report.totals.committed, c)} icon={ShoppingCart} />
            <StatCard label="Ordered (LPOs)" value={fmtMoney(report.totals.ordered, c)} icon={TrendingUp} />
            <StatCard label="Received (GRN)" value={fmtMoney(report.totals.received, c)} icon={Wallet} />
            <StatCard label="Invoiced" value={fmtMoney(report.totals.invoiced, c)} icon={BarChart3} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-neutral-900">Monthly LPO spend ({report.year})</h2>
            <div className="mt-4">
              <BarChartSimple data={report.monthlyOrdered} color="bg-blue-500" />
            </div>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Building2 className="h-4 w-4" />
                By department
              </h2>
              {report.byDepartment.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-500">No department spend in this period.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-neutral-500">
                        <th className="pb-2 pr-3 font-medium">Department</th>
                        <th className="pb-2 pr-3 font-medium text-right">Budget</th>
                        <th className="pb-2 pr-3 font-medium text-right">Committed</th>
                        <th className="pb-2 pr-3 font-medium text-right">Ordered</th>
                        <th className="pb-2 font-medium text-right">Invoiced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byDepartment.map((row) => (
                        <tr key={row.key} className="border-b border-neutral-100">
                          <td className="py-2 pr-3 font-medium text-neutral-900">{row.label}</td>
                          <td className="py-2 pr-3 text-right text-neutral-600">{fmtMoney(row.budgetAllocated, c)}</td>
                          <td className="py-2 pr-3 text-right">{fmtMoney(row.committed, c)}</td>
                          <td className="py-2 pr-3 text-right">{fmtMoney(row.ordered, c)}</td>
                          <td className="py-2 text-right">{fmtMoney(row.invoiced, c)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <ShoppingCart className="h-4 w-4" />
                By vendor
              </h2>
              {report.byVendor.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-500">No vendor spend in this period.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-neutral-500">
                        <th className="pb-2 pr-3 font-medium">Vendor</th>
                        <th className="pb-2 pr-3 font-medium text-right">Committed</th>
                        <th className="pb-2 pr-3 font-medium text-right">Ordered</th>
                        <th className="pb-2 font-medium text-right">Invoiced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byVendor.map((row) => (
                        <tr key={row.vendorId} className="border-b border-neutral-100">
                          <td className="py-2 pr-3 font-medium text-neutral-900">{row.vendorName}</td>
                          <td className="py-2 pr-3 text-right">{fmtMoney(row.committed, c)}</td>
                          <td className="py-2 pr-3 text-right">{fmtMoney(row.ordered, c)}</td>
                          <td className="py-2 text-right">{fmtMoney(row.invoiced, c)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Wallet className="h-4 w-4" />
              Budget lines vs procurement
            </h2>
            {report.byBudgetLine.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">
                No active budgets for {report.year}. Configure budgets under Accounts → Budgets.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-neutral-500">
                      <th className="pb-2 pr-3 font-medium">Budget / line</th>
                      <th className="pb-2 pr-3 font-medium">Dept</th>
                      <th className="pb-2 pr-3 font-medium text-right">Allocated</th>
                      <th className="pb-2 pr-3 font-medium text-right">Budget spent</th>
                      <th className="pb-2 font-medium text-right">Procurement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byBudgetLine.map((row) => (
                      <tr key={row.budgetLineId} className="border-b border-neutral-100">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-neutral-900">{row.lineName}</div>
                          <div className="text-xs text-neutral-500">{row.budgetName}</div>
                        </td>
                        <td className="py-2 pr-3 text-neutral-600">{row.department ?? '—'}</td>
                        <td className="py-2 pr-3 text-right">{fmtMoney(row.allocated, c)}</td>
                        <td className="py-2 pr-3 text-right">{fmtMoney(row.budgetSpent, c)}</td>
                        <td className="py-2 text-right font-medium">{fmtMoney(row.procurementSpend, c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardPage>
  );
}
