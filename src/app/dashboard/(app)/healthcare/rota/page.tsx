'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTable, DashboardTableCard, DashboardTableEmpty, DashboardTableViewport } from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Ward = { id: string; code: string; name: string };
type Employee = { id: string; firstName: string; lastName: string; employeeNumber: string | null };
type Assignment = {
  id: string;
  wardCode: string | null;
  employeeName: string | null;
  clinicalRole: string;
  workDate: string;
  licenseOk: boolean;
  licenseWarnings: string[];
};

export default function HealthcareRotaPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    wardId: '',
    employeeId: '',
    workDate: new Date().toISOString().slice(0, 10),
    startMinutes: '360',
    endMinutes: '840',
    clinicalRole: 'nurse',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [wRes, eRes, aRes] = await Promise.all([
      fetch('/api/healthcare/wards'),
      fetch('/api/outsourcing/employees?status=active'),
      fetch('/api/healthcare/clinical-assignments'),
    ]);
    const [wJson, eJson, aJson] = await Promise.all([wRes.json(), eRes.json(), aRes.json()]);
    if (!wRes.ok) throw new Error(wJson.error);
    if (!aRes.ok) throw new Error(aJson.error);
    setWards(wJson.wards ?? []);
    setEmployees(eJson.employees ?? eJson ?? []);
    setAssignments(aJson.assignments ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load().catch((e) => {
      setError(e instanceof Error ? e.message : 'Failed');
      setLoading(false);
    });
  }, [load]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/healthcare/clinical-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        startMinutes: Number(form.startMinutes),
        endMinutes: Number(form.endMinutes),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error + (json.warnings ? `: ${json.warnings.join('; ')}` : ''));
      return;
    }
    setError(null);
    await load();
  }

  if (loading && assignments.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader eyebrow="Healthcare" title="Clinical rota" description="Assign shifts to wards with licence gate and stricter rest rules." />
      <form onSubmit={handleAssign} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 lg:grid-cols-6">
        <select required value={form.wardId} onChange={(e) => setForm((f) => ({ ...f, wardId: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm">
          <option value="">Ward</option>
          {wards.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
        </select>
        <select required value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm lg:col-span-2">
          <option value="">Staff</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.employeeNumber} — {emp.firstName} {emp.lastName}</option>
          ))}
        </select>
        <input required type="date" value={form.workDate} onChange={(e) => setForm((f) => ({ ...f, workDate: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
        <select value={form.clinicalRole} onChange={(e) => setForm((f) => ({ ...f, clinicalRole: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm">
          <option value="nurse">Nurse</option>
          <option value="medical_officer">Medical officer</option>
          <option value="clinical_officer">Clinical officer</option>
        </select>
        <button type="submit" className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white">Assign</button>
      </form>
      {error ? <DashboardAsyncState variant="error" title="Clinical rota" message={error} onRetry={() => void load()} /> : (
        <DashboardTableCard title="Assignments">
          <DashboardTableViewport>
            <DashboardTable>
              <thead><tr><th>Date</th><th>Ward</th><th>Staff</th><th>Role</th><th>Licence</th></tr></thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.workDate}</td>
                    <td>{a.wardCode}</td>
                    <td>{a.employeeName}</td>
                    <td className="capitalize">{a.clinicalRole.replace(/_/g, ' ')}</td>
                    <td className={a.licenseOk ? 'text-emerald-600' : 'text-amber-600'}>{a.licenseOk ? 'OK' : a.licenseWarnings.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {assignments.length === 0 ? <DashboardTableEmpty message="No clinical assignments yet." /> : null}
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
