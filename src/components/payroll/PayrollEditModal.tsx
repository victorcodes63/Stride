'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Calculator } from 'lucide-react';
import { calculateStatutoryForPayroll, NITA_LEVY_PER_EMPLOYEE_KES } from '@/lib/payroll-calc';
import { allocateStatutoryBiweekly } from '@/lib/biweekly-payroll';
import {
  workingDaysInPeriod,
  formatDayLabel,
  type BiweeklyAttendance,
} from '@/lib/biweekly-attendance';

const STANDARD_ALLOWANCES = [
  { key: 'Bonus', label: 'Bonus' },
  { key: 'Overtime', label: 'Overtime' },
  { key: 'House Allowance', label: 'House Allowance' },
  { key: 'Comm Allowance', label: 'Comm Allowance' },
  { key: 'Transport Allowance', label: 'Transport Allowance' },
  { key: 'Meal Allowance', label: 'Meal Allowance' },
  { key: 'Medical Allowance', label: 'Medical Allowance' },
];

interface AllowanceRow { name: string; amount: number }
interface DeductionRow { name: string; amount: number }

interface PayrollEditModalProps {
  payrollId: string;
  employeeName: string;
  month: number;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getAllowance(allowances: AllowanceRow[], key: string): number {
  const a = allowances.find((x) => x.name === key);
  return a?.amount ?? 0;
}

function setAllowance(allowances: AllowanceRow[], key: string, amount: number): AllowanceRow[] {
  const filtered = allowances.filter((x) => x.name !== key);
  if (amount !== 0) filtered.push({ name: key, amount });
  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

export default function PayrollEditModal({
  payrollId,
  employeeName,
  month,
  year,
  onClose,
  onSaved,
}: PayrollEditModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [basicPay, setBasicPay] = useState('');
  const [allowances, setAllowances] = useState<AllowanceRow[]>([]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const [paye, setPaye] = useState('');
  const [nssf, setNssf] = useState('');
  const [nhif, setNhif] = useState('');
  const [ahl, setAhl] = useState('');
  const [nita, setNita] = useState(String(NITA_LEVY_PER_EMPLOYEE_KES));
  const [grossPay, setGrossPay] = useState(0);
  const [netPay, setNetPay] = useState(0);
  const [recalcStatutory, setRecalcStatutory] = useState(false);
  const [newDeductionName, setNewDeductionName] = useState('');
  const [newDeductionAmount, setNewDeductionAmount] = useState('');
  const [period1Gross, setPeriod1Gross] = useState('');
  const [period2Gross, setPeriod2Gross] = useState('');
  const [payrollFrequency, setPayrollFrequency] = useState('monthly');
  const [leavePayMode, setLeavePayMode] = useState<'none' | 'paye_only' | 'included_in_gross'>('none');
  const [leavePay, setLeavePay] = useState('');
  const [biweeklyAttendance, setBiweeklyAttendance] = useState<BiweeklyAttendance>({
    period1: [],
    period2: [],
  });
  const [biweeklyAllocation, setBiweeklyAllocation] = useState<{
    period1: { gross: number; paye: number; nssf: number; shif: number; ahl: number; netBeforeOther: number };
    period2: { gross: number; paye: number; nssf: number; shif: number; ahl: number; netBeforeOther: number };
    monthlyNet: number;
  } | null>(null);
  const DEDUCTION_PRESETS = ['SACCO', 'Advance', 'Pension', 'Staff Welfare', 'Company Deduction', 'Loan'];

  const biweekly =
    payrollFrequency === 'biweekly' ||
    (period1Gross !== '' && period2Gross !== '' && (Number(period1Gross) > 0 || Number(period2Gross) > 0));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/outsourcing/payroll/${payrollId}`);
        const data = await res.json();
        if (!res.ok || cancelled) return;
        setBasicPay(String(data.basicPay ?? 0));
        setAllowances(Array.isArray(data.allowances) ? data.allowances : []);
        setDeductions(Array.isArray(data.deductions) ? data.deductions : []);
        setPaye(String(data.paye ?? 0));
        setNssf(String(data.nssf ?? 0));
        setNhif(String(data.nhif ?? 0));
        setAhl(String(data.ahl ?? 0));
        setNita(String(data.nita ?? NITA_LEVY_PER_EMPLOYEE_KES));
        setGrossPay(Number(data.grossPay ?? 0));
        setNetPay(Number(data.netPay ?? 0));
        setPayrollFrequency(data.payrollFrequency ?? 'monthly');
        setLeavePayMode(
          data.leavePayMode === 'paye_only' || data.leavePayMode === 'included_in_gross'
            ? data.leavePayMode
            : 'none'
        );
        setLeavePay(data.leavePay != null && Number(data.leavePay) !== 0 ? String(data.leavePay) : '');
        setPeriod1Gross(data.period1Gross != null ? String(data.period1Gross) : '');
        setPeriod2Gross(data.period2Gross != null ? String(data.period2Gross) : '');
        setBiweeklyAllocation(data.biweeklyAllocation ?? null);
        setBiweeklyAttendance(
          data.biweeklyAttendance && typeof data.biweeklyAttendance === 'object'
            ? {
                period1: Array.isArray(data.biweeklyAttendance.period1) ? data.biweeklyAttendance.period1 : [],
                period2: Array.isArray(data.biweeklyAttendance.period2) ? data.biweeklyAttendance.period2 : [],
              }
            : { period1: [], period2: [] }
        );
      } catch {
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [payrollId]);

  const updateAllowance = (key: string, value: number) => {
    setAllowances((a) => setAllowance(a, key, value));
  };

  const addDeduction = () => {
    const name = newDeductionName.trim();
    const amount = parseFloat(newDeductionAmount) || 0;
    if (name && amount >= 0) {
      setDeductions((d) => [...d.filter((x) => x.name !== name), { name, amount }]);
      setNewDeductionName('');
      setNewDeductionAmount('');
    }
  };

  const removeDeduction = (name: string) => {
    setDeductions((d) => d.filter((x) => x.name !== name));
  };

  const allowancesTotal = allowances.reduce((s, a) => s + a.amount, 0);
  const basicPayNum = parseFloat(String(basicPay).replace(/,/g, '')) || 0;
  const p1n = parseFloat(String(period1Gross).replace(/,/g, '')) || 0;
  const p2n = parseFloat(String(period2Gross).replace(/,/g, '')) || 0;
  const employmentGross =
    biweekly && (p1n > 0 || p2n > 0) ? p1n + p2n + allowancesTotal : basicPayNum + allowancesTotal;
  const leavePayNum = parseFloat(String(leavePay).replace(/,/g, '')) || 0;
  const grossDisplay =
    leavePayMode === 'none' ? employmentGross : employmentGross + leavePayNum;
  const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0);
  const payeNum = parseFloat(paye.replace(/,/g, '')) || 0;
  const nssfNum = parseFloat(nssf.replace(/,/g, '')) || 0;
  const nhifNum = parseFloat(nhif.replace(/,/g, '')) || 0;
  const ahlNum = parseFloat(ahl.replace(/,/g, '')) || 0;
  const net =
    leavePayMode === 'paye_only' && leavePayNum > 0
      ? employmentGross - payeNum - nssfNum - nhifNum - ahlNum - deductionsTotal + leavePayNum
      : employmentGross +
        (leavePayMode === 'included_in_gross' ? leavePayNum : 0) -
        payeNum -
        nssfNum -
        nhifNum -
        ahlNum -
        deductionsTotal;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        allowances,
        deductions,
        paye: payeNum,
        nssf: nssfNum,
        nhif: nhifNum,
        ahl: ahlNum,
        recalculateStatutory: recalcStatutory,
      };
      if (biweekly && (p1n > 0 || p2n > 0)) {
        payload.period1Gross = p1n;
        payload.period2Gross = p2n;
      } else {
        payload.basicPay = basicPayNum;
      }
      payload.leavePay = leavePayNum;
      if (biweekly && (payrollFrequency === 'biweekly' || period1Gross || period2Gross)) {
        payload.biweeklyAttendance = biweeklyAttendance;
      }
      const res = await fetch(`/api/outsourcing/payroll/${payrollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onSaved();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalcStatutory = () => {
    const empGross =
      biweekly && (p1n > 0 || p2n > 0) ? p1n + p2n + allowancesTotal : basicPayNum + allowancesTotal;
    const otherTotal = deductions.reduce((s, d) => s + d.amount, 0);
    const lp = parseFloat(String(leavePay).replace(/,/g, '')) || 0;
    const calc = calculateStatutoryForPayroll(leavePayMode, empGross, lp, otherTotal);
    setPaye(String(calc.paye));
    setNssf(String(calc.nssf));
    setNhif(String(calc.nhif));
    setAhl(String(calc.ahl));
    setNita(String(calc.nita));
    setRecalcStatutory(true);
    if (biweekly && p1n + p2n > 0) {
      setBiweeklyAllocation(
        allocateStatutoryBiweekly(p1n, p2n, {
          paye: calc.paye,
          nssf: calc.nssf,
          shif: calc.nhif,
          ahl: calc.ahl,
        })
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-900">
            Edit payroll — {employeeName} ({MONTHS[month - 1]} {year})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold text-primary-900 mb-3">Earnings</h3>
                {(payrollFrequency === 'biweekly' || period1Gross || period2Gross) && (
                  <div className="mb-4 p-3 rounded-lg bg-secondary-50 border border-secondary-100 text-xs text-secondary-950">
                    <strong>Bi-weekly:</strong> Period 1 = 1st–15th, period 2 = 16th–end. Working days = <strong>Mon–Sat</strong> (Sunday off).
                    Statutory on combined gross. Tick days the employee attended; optional pro-rate splits monthly basic 50/50 by days worked.
                  </div>
                )}
                {leavePayMode !== 'none' && (
                  <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-100 text-xs text-sky-950">
                    {leavePayMode === 'paye_only' ? (
                      <>
                        <strong>Client X (leave pay):</strong> NSSF, SHIF & AHL are on <strong>basic + allowances only</strong> (leave pay excluded).
                        PAYE uses basic + allowances + leave pay. Net adds leave pay after deductions.
                      </>
                    ) : (
                      <>
                        <strong>Leave pay in gross:</strong> Leave pay is added to gross; NSSF, SHIF, AHL, PAYE all use that total.
                      </>
                    )}
                  </div>
                )}
                <div className="space-y-3">
                  {payrollFrequency === 'biweekly' || period1Gross || period2Gross ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Period 1 gross (KES)</label>
                        <input
                          type="number"
                          value={period1Gross}
                          onChange={(e) => setPeriod1Gross(e.target.value)}
                          min={0}
                          step={0.01}
                          placeholder="1st–15th"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Period 2 gross (KES)</label>
                        <input
                          type="number"
                          value={period2Gross}
                          onChange={(e) => setPeriod2Gross(e.target.value)}
                          min={0}
                          step={0.01}
                          placeholder="16th–end"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  ) : null}
                  {(payrollFrequency === 'biweekly' || period1Gross || period2Gross) && (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-primary-900">Days worked (payslip)</p>
                        <button
                          type="button"
                          className="text-xs font-medium text-primary-700 underline"
                          onClick={() => {
                            setBiweeklyAttendance({
                              period1: workingDaysInPeriod(year, month, 1),
                              period2: workingDaysInPeriod(year, month, 2),
                            });
                          }}
                        >
                          Select all working days
                        </button>
                      </div>
                      {([1, 2] as const).map((period) => {
                        const days = workingDaysInPeriod(year, month, period);
                        const key = period === 1 ? 'period1' : 'period2';
                        const selected = biweeklyAttendance[key];
                        return (
                          <div key={period}>
                            <p className="text-[10px] font-medium text-neutral-600 mb-1.5">
                              Period {period} (1–15 / 16–end) · {selected.length}/{days.length} days
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {days.map((iso) => {
                                const on = selected.includes(iso);
                                return (
                                  <button
                                    key={iso}
                                    type="button"
                                    onClick={() => {
                                      setBiweeklyAttendance((prev) => {
                                        const cur = [...prev[key]];
                                        const i = cur.indexOf(iso);
                                        if (i >= 0) cur.splice(i, 1);
                                        else cur.push(iso);
                                        cur.sort();
                                        return { ...prev, [key]: cur };
                                      });
                                    }}
                                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                                      on
                                        ? 'bg-primary-900 text-white border-primary-900'
                                        : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300'
                                    }`}
                                  >
                                    {formatDayLabel(iso)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={async () => {
                          setSaving(true);
                          try {
                            const res = await fetch(`/api/outsourcing/payroll/${payrollId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                biweeklyAttendance,
                                proRateBiweeklyFromAttendance: true,
                                allowances,
                                deductions,
                                leavePay: leavePayNum,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Failed');
                            if (data.period1Gross != null) setPeriod1Gross(String(data.period1Gross));
                            if (data.period2Gross != null) setPeriod2Gross(String(data.period2Gross));
                            setPaye(String(data.paye ?? 0));
                            setNssf(String(data.nssf ?? 0));
                            setNhif(String(data.nhif ?? 0));
                            setAhl(String(data.ahl ?? 0));
                            setNita(String(data.nita ?? NITA_LEVY_PER_EMPLOYEE_KES));
                            setGrossPay(Number(data.grossPay ?? 0));
                            setNetPay(Number(data.netPay ?? 0));
                            setBasicPay(String(data.basicPay ?? 0));
                            setRecalcStatutory(false);
                            if (data.biweeklyAttendance) setBiweeklyAttendance(data.biweeklyAttendance);
                            const p1 = parseFloat(String(data.period1Gross ?? 0)) || 0;
                            const p2 = parseFloat(String(data.period2Gross ?? 0)) || 0;
                            setBiweeklyAllocation(
                              allocateStatutoryBiweekly(p1, p2, {
                                paye: Number(data.paye),
                                nssf: Number(data.nssf),
                                shif: Number(data.nhif),
                                ahl: Number(data.ahl),
                              })
                            );
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed');
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving || (biweeklyAttendance.period1.length === 0 && biweeklyAttendance.period2.length === 0)}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-secondary-500 text-white hover:bg-secondary-600 disabled:opacity-50"
                      >
                        Pro-rate period grosses from days (½ monthly basic per period ÷ working days × days ticked) &amp; recalc statutory
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      {payrollFrequency === 'biweekly' ? 'Monthly basic (read-only sum)' : 'Basic pay (KES)'}
                    </label>
                    <input
                      type="number"
                      value={payrollFrequency === 'biweekly' ? String(p1n + p2n) : basicPay}
                      onChange={(e) => payrollFrequency !== 'biweekly' && setBasicPay(e.target.value)}
                      readOnly={payrollFrequency === 'biweekly'}
                      min={0}
                      step={0.01}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 read-only:bg-neutral-50"
                    />
                  </div>
                  {STANDARD_ALLOWANCES.map(({ key }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">{key} (KES)</label>
                      <input
                        type="number"
                        value={getAllowance(allowances, key) || ''}
                        onChange={(e) => updateAllowance(key, parseFloat(e.target.value) || 0)}
                        min={0}
                        step={0.01}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  ))}
                  {leavePayMode !== 'none' && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Leave pay (KES)</label>
                      <input
                        type="number"
                        value={leavePay}
                        onChange={(e) => setLeavePay(e.target.value)}
                        min={0}
                        step={0.01}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Mode is set on the client (Edit client → Payroll). None = no leave pay line.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {biweeklyAllocation && (
                <div className="rounded-lg border border-neutral-200 overflow-hidden text-xs">
                  <div className="bg-neutral-50 px-3 py-2 font-semibold text-primary-900">
                    Per-period payslip (proportional statutory) + month final
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-neutral-500 border-b">
                        <th className="p-2"> </th>
                        <th className="p-2 text-right">Gross</th>
                        <th className="p-2 text-right">PAYE</th>
                        <th className="p-2 text-right">NSSF</th>
                        <th className="p-2 text-right">SHIF</th>
                        <th className="p-2 text-right">AHL</th>
                        <th className="p-2 text-right">Net*</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Period 1</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period1.gross.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period1.paye.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period1.nssf.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period1.shif.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period1.ahl.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums font-medium">{biweeklyAllocation.period1.netBeforeOther.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium">Period 2</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period2.gross.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period2.paye.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period2.nssf.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period2.shif.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.period2.ahl.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums font-medium">{biweeklyAllocation.period2.netBeforeOther.toLocaleString()}</td>
                      </tr>
                      <tr className="bg-primary-50 font-semibold">
                        <td className="p-2">Month total</td>
                        <td className="p-2 text-right tabular-nums">{p1n + p2n}</td>
                        <td className="p-2 text-right tabular-nums" colSpan={4}>
                          Statutory remittance = sum above
                        </td>
                        <td className="p-2 text-right tabular-nums">{biweeklyAllocation.monthlyNet.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="p-2 text-neutral-500">*Net per period before SACCO/loan lines. Month net matches main net pay after other deductions.</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-primary-900 mb-2">Statutory deductions (editable)</h3>
                <p className="text-xs text-neutral-500 mb-3">
                  PAYE uses taxable income after NSSF, SHIF, and <strong>AHL (1.5% gross)</strong>. Recalculate applies current Kenyan rules.{' '}
                  <strong>NITA</strong> is an employer levy (KES {NITA_LEVY_PER_EMPLOYEE_KES}/month per employee) and does not reduce net pay.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">PAYE (KES)</label>
                    <input
                      type="number"
                      value={paye}
                      onChange={(e) => setPaye(e.target.value)}
                      min={0}
                      step={0.01}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">NSSF (KES)</label>
                    <input
                      type="number"
                      value={nssf}
                      onChange={(e) => setNssf(e.target.value)}
                      min={0}
                      step={0.01}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">SHIF (KES)</label>
                    <input
                      type="number"
                      value={nhif}
                      onChange={(e) => setNhif(e.target.value)}
                      min={0}
                      step={0.01}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">AHL 1.5% (KES)</label>
                    <input
                      type="number"
                      value={ahl}
                      onChange={(e) => setAhl(e.target.value)}
                      min={0}
                      step={0.01}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRecalcStatutory}
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100"
                >
                  <Calculator className="w-4 h-4" />
                  Recalculate statutory (apply Kenyan rates)
                </button>
                <div className="mt-4 p-3 rounded-lg border border-neutral-200 bg-neutral-50/90">
                  <h4 className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">Employer — NITA</h4>
                  <p className="text-sm text-neutral-800">
                    KES <span className="tabular-nums font-medium">{Number(nita || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                    <span className="text-xs text-neutral-500 block mt-1">Shown for remittance reporting only; not deducted from employee net pay.</span>
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-primary-900 mb-2">Other deductions</h3>
                <div className="space-y-2">
                  {deductions
                    .filter((d) => String(d.name).trim().toUpperCase() !== 'NITA')
                    .map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{d.name}</span>
                      <span className="tabular-nums text-sm">{d.amount.toLocaleString('en-KE')}</span>
                      <button
                        type="button"
                        onClick={() => removeDeduction(d.name)}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {DEDUCTION_PRESETS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setNewDeductionName(name)}
                      className="px-2 py-1 text-xs rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={newDeductionName}
                    onChange={(e) => setNewDeductionName(e.target.value)}
                    placeholder="e.g. Advance, Loan, SACCO"
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={newDeductionAmount}
                    onChange={(e) => setNewDeductionAmount(e.target.value)}
                    placeholder="Amount"
                    min={0}
                    step={0.01}
                    className="w-28 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={addDeduction}
                    className="px-3 py-2 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">
                    {leavePayMode === 'paye_only' && leavePayNum > 0
                      ? 'Gross (incl. leave pay)'
                      : 'Gross pay'}
                  </span>
                  <span className="font-medium tabular-nums">
                    {grossDisplay.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {leavePayMode === 'paye_only' && leavePayNum > 0 && (
                  <div className="flex justify-between text-xs text-neutral-500 mt-0.5">
                    <span>Employment gross (NSSF/SHIF/AHL base)</span>
                    <span className="tabular-nums">{employmentGross.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-neutral-600">Net pay</span>
                  <span className="font-semibold tabular-nums text-primary-700">{net.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && (
          <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
