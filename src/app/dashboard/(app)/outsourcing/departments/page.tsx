'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { useEntity } from '@/components/EntitySwitcher';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';

interface Department {
  id: string;
  name: string;
  employeeCount: number;
}

const DEPT_AVATAR_PALETTE = [
  'bg-primary-100 text-primary-800 ring-primary-200/70',
  'bg-emerald-100 text-emerald-800 ring-emerald-200/70',
  'bg-violet-100 text-violet-800 ring-violet-200/70',
  'bg-amber-100 text-amber-900 ring-amber-200/70',
  'bg-sky-100 text-sky-800 ring-sky-200/70',
  'bg-rose-100 text-rose-800 ring-rose-200/70',
];

function deptInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

function deptAvatarClass(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return DEPT_AVATAR_PALETTE[Math.abs(hash) % DEPT_AVATAR_PALETTE.length];
}

function DepartmentsPageInner() {
  const { activeEntity } = useEntity();
  const [clientId, setClientId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDepartments = async (resolvedClientId?: string) => {
    try {
      setError(null);
      setLoading(true);
      const clientsRes = await fetch('/api/outsourcing/clients');
      const clientsData = await clientsRes.json().catch(() => []);
      const singletonId =
        resolvedClientId ||
        (Array.isArray(clientsData) && clientsData[0]?.id ? String(clientsData[0].id) : '');
      if (!singletonId) {
        setDepartments([]);
        return;
      }
      setClientId(singletonId);

      const res = await fetch(`/api/outsourcing/clients/${singletonId}/departments`);
      const data = await res.json().catch(() => []);
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
      setError('Failed to load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDepartments();
  }, [activeEntity.id]);

  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q ? departments.filter((d) => d.name.toLowerCase().includes(q)) : departments;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, searchQuery]);

  const totals = useMemo(() => {
    const deptCount = departments.length;
    const staffCount = departments.reduce((sum, d) => sum + (d.employeeCount ?? 0), 0);
    const emptyDepts = departments.filter((d) => (d.employeeCount ?? 0) === 0).length;
    const avgPerDept = deptCount > 0 ? Math.round((staffCount / deptCount) * 10) / 10 : 0;
    return { deptCount, staffCount, emptyDepts, avgPerDept };
  }, [departments]);

  const hasSearch = !!searchQuery.trim();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add department');
      setDepartments((prev) => [...prev, data]);
      setNewName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add department');
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (deptId: string) => {
    if (!clientId || !editName.trim()) return;
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/departments/${deptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update department');
      setDepartments((prev) => prev.map((d) => (d.id === deptId ? { ...d, name: data.name } : d)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update department');
    }
  };

  const handleDelete = async (deptId: string, name: string) => {
    if (!clientId) return;
    if (!window.confirm(`Delete department "${name}"? Employees assigned there will be unassigned.`)) return;
    setDeletingId(deptId);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/departments/${deptId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete department');
      }
      setDepartments((prev) => prev.filter((d) => d.id !== deptId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete department');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardPage>
        <div className="dashboard-surface h-48 animate-pulse shadow-sm" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Departments"
        description="Group employees by department for payroll and reporting."
      />

      <DashboardStatGrid>
        <DashboardStatCard label="Departments" value={totals.deptCount} tone="primary"
          hint={hasSearch ? `${filteredDepartments.length} match search` : undefined}
        />
        <DashboardStatCard label="Staff assigned" value={totals.staffCount} tone="success" />
        <DashboardStatCard
          label="Empty departments"
          value={totals.emptyDepts}
          tone="warning"
          warn={totals.emptyDepts > 0}
          hint={totals.emptyDepts > 0 ? 'Assign staff from Employees' : undefined}
        />
        <DashboardStatCard label="Avg per department" value={totals.avgPerDept} tone="violet" />
      </DashboardStatGrid>

      <div className="overflow-hidden dashboard-surface shadow-sm">
        <div className="dashboard-toolbar space-y-4 px-4 py-4 md:px-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          ) : null}

          <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New department name"
              className="h-10 flex-1 rounded-lg border border-neutral-200/80 bg-white/90 px-4 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="btn-primary inline-flex h-10 shrink-0 items-center justify-center gap-2 px-5 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {adding ? 'Adding…' : 'Add department'}
            </button>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search departments…"
                className="h-10 w-full rounded-lg border border-neutral-200/80 bg-white/90 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <p className="text-sm text-neutral-500">
              {hasSearch ? (
                <>
                  Showing <span className="font-medium tabular-nums text-ink">{filteredDepartments.length}</span> of{' '}
                  <span className="tabular-nums">{departments.length}</span>
                </>
              ) : (
                <>
                  <span className="font-medium tabular-nums text-ink">{departments.length}</span> department
                  {departments.length !== 1 ? 's' : ''}
                </>
              )}
            </p>
            {hasSearch ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="btn-secondary inline-flex h-10 items-center gap-1.5 px-3"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {departments.length === 0 ? (
          <p className="border-t border-neutral-100 px-4 py-12 text-center text-sm text-neutral-500 md:px-5">
            No departments yet. Add your first department above.
          </p>
        ) : filteredDepartments.length === 0 ? (
          <p className="border-t border-neutral-100 px-4 py-12 text-center text-sm text-neutral-500 md:px-5">
            No departments match &quot;{searchQuery.trim()}&quot;.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
            {filteredDepartments.map((dept) => (
              <li key={dept.id} className="group px-4 py-3 transition-colors hover:bg-neutral-50/60 md:px-5">
                {editingId === dept.id ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="min-w-[12rem] flex-1 rounded-lg border border-neutral-200/80 bg-white/90 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(dept.id)}
                      className="btn-primary px-3 py-2 text-sm"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="btn-secondary px-3 py-2 text-sm">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-inset ${deptAvatarClass(dept.name)}`}
                      >
                        {deptInitials(dept.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{dept.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          {dept.employeeCount === 0 ? (
                            'No employees assigned'
                          ) : (
                            <>
                              {dept.employeeCount} employee{dept.employeeCount !== 1 ? 's' : ''}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(dept.id);
                          setEditName(dept.name);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white hover:text-ink"
                        aria-label={`Edit ${dept.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(dept.id, dept.name)}
                        disabled={deletingId === dept.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        aria-label={`Delete ${dept.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardPage>
  );
}

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<DashboardPage><div className="dashboard-surface h-48 animate-pulse shadow-sm" /></DashboardPage>}>
      <DepartmentsPageInner />
    </Suspense>
  );
}
