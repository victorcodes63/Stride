'use client';

import { useCallback, useEffect, useState } from 'react';
import { Network, Loader2, AlertCircle, ChevronDown, ChevronRight, User, Users, Building2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { motion, AnimatePresence } from 'framer-motion';

type OrgEmployee = {
 id: string;
 firstName: string;
 lastName: string;
 jobTitle: string | null;
 departmentName: string | null;
 managerEmployeeId: string | null;
 employmentStatus: string;
};

type OrgNode = OrgEmployee & {
 children: OrgNode[];
};

function buildTree(employees: OrgEmployee[]): OrgNode[] {
 const map = new Map<string, OrgNode>();
 for (const emp of employees) {
 map.set(emp.id, { ...emp, children: [] });
 }

 const roots: OrgNode[] = [];
 for (const node of map.values()) {
 if (node.managerEmployeeId && map.has(node.managerEmployeeId)) {
 map.get(node.managerEmployeeId)!.children.push(node);
 } else {
 roots.push(node);
 }
 }
 return roots;
}

function OrgTreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
 const [expanded, setExpanded] = useState(depth < 2);
 const hasChildren = node.children.length > 0;

 return (
 <div className={depth > 0 ? 'ml-6 border-l border-neutral-200 pl-4' : ''}>
 <button
 onClick={() => hasChildren && setExpanded(!expanded)}
 className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors text-left ${
 hasChildren ? 'hover:bg-primary-50/50 cursor-pointer' : 'cursor-default'
 }`}
 >
 <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
 depth === 0 ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'
 }`}>
 <User className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="font-semibold text-sm text-primary-900 truncate">{node.firstName} {node.lastName}</p>
 {node.employmentStatus !== 'active' && (
 <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-100 text-neutral-500">{node.employmentStatus}</span>
 )}
 </div>
 <p className="text-xs text-neutral-500 truncate">
 {node.jobTitle || 'No title'}{node.departmentName ? ` · ${node.departmentName}` : ''}
 </p>
 </div>
 {hasChildren && (
 <div className="flex items-center gap-1.5 shrink-0">
 <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded tabular-nums">
 {node.children.length}
 </span>
 {expanded ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
 </div>
 )}
 </button>
 <AnimatePresence>
 {expanded && hasChildren && (
 <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2 }}>
 {node.children
 .sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName))
 .map((child) => (
 <OrgTreeNode key={child.id} node={child} depth={depth + 1} />
 ))}
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}

export default function OrgChartContent() {
 const [employees, setEmployees] = useState<OrgEmployee[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [search, setSearch] = useState('');

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 fetch('/api/outsourcing/employees?limit=1000')
 .then(async (r) => {
 const d = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(d.error || 'Failed');
 return d;
 })
 .then((d) => {
 const emps = (d.employees ?? []).map((e: any) => ({
 id: e.id,
 firstName: e.firstName,
 lastName: e.lastName,
 jobTitle: e.jobTitle,
 departmentName: e.departmentName ?? e.department?.name ?? null,
 managerEmployeeId: e.managerEmployeeId,
 employmentStatus: e.employmentStatus,
 }));
 setEmployees(emps);
 })
 .catch((e) => { setError(e instanceof Error ? e.message : 'Failed'); setEmployees([]); })
 .finally(() => setLoading(false));
 }, []);

 useEffect(() => { load(); }, [load]);

 const filtered = employees
 ? employees.filter((e) => {
 if (!search.trim()) return true;
 const q = search.toLowerCase();
 return (
 e.firstName.toLowerCase().includes(q) ||
 e.lastName.toLowerCase().includes(q) ||
 (e.jobTitle?.toLowerCase().includes(q)) ||
 (e.departmentName?.toLowerCase().includes(q))
 );
 })
 : [];

 const tree = buildTree(filtered);
 const departments = [...new Set(employees?.map((e) => e.departmentName).filter(Boolean) ?? [])];

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Organization Chart"
 icon={Network}
 iconClassName="h-7 w-7 shrink-0 text-primary-700"
 description="Visual hierarchy of employees and reporting lines."
 className="mb-6"
 />

 {employees && (
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
 {[
 { label: 'Total employees', value: employees.length, icon: Users, color: 'text-primary-900' },
 { label: 'Departments', value: departments.length, icon: Building2, color: 'text-indigo-700' },
 { label: 'Managers', value: employees.filter((e) => employees.some((s) => s.managerEmployeeId === e.id)).length, icon: User, color: 'text-blue-700' },
 { label: 'Active', value: employees.filter((e) => e.employmentStatus === 'active').length, icon: Users, color: 'text-emerald-700' },
 ].map((s, i) => (
 <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
 className="dashboard-stat-card">
 <div className="inline-flex rounded-lg p-2 mb-2 bg-primary-50 text-primary-700"><s.icon className="w-4 h-4" /></div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">{s.label}</p>
 <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
 </motion.div>
 ))}
 </div>
 )}

 <div className="mb-4">
 <input placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)}
 className="w-full max-w-sm px-4 py-2.5 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all" />
 </div>

 {loading && <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}
 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p>
 </div>
 )}

 {!loading && !error && tree.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No employees found. Add employees with manager assignments to build the org chart.
 </div>
 )}

 {!loading && !error && tree.length > 0 && (
 <div className="dashboard-stat-card sm:p-5">
 {tree
 .sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName))
 .map((node) => (
 <OrgTreeNode key={node.id} node={node} />
 ))}
 </div>
 )}
 </DashboardPage>
 );
}
