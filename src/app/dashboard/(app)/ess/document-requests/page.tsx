'use client';

import { useMemo, useState } from 'react';
import {
 FileText,
 Search,
 Clock,
 CheckCircle2,
 XCircle,
 AlertCircle,
 Download,
 Eye,
 Filter,
 MoreHorizontal,
 FileQuestion,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type RequestStatus = 'pending' | 'processing' | 'completed' | 'rejected';
type DocumentType = 'employment_letter' | 'p9_form' | 'payslip_copy' | 'nssf_statement' | 'nhif_statement' | 'clearance_letter' | 'recommendation_letter' | 'salary_advance_form' | 'other';

type DocumentRequest = {
 id: string;
 employeeName: string;
 employeeNumber: string;
 department: string;
 documentType: DocumentType;
 documentLabel: string;
 reason: string;
 status: RequestStatus;
 requestedAt: string;
 completedAt: string | null;
 handledBy: string | null;
 notes: string | null;
};

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
 { value: 'employment_letter', label: 'Employment confirmation letter' },
 { value: 'p9_form', label: 'P9 tax form' },
 { value: 'payslip_copy', label: 'Payslip copy' },
 { value: 'nssf_statement', label: 'NSSF statement' },
 { value: 'nhif_statement', label: 'NHIF statement' },
 { value: 'clearance_letter', label: 'Clearance letter' },
 { value: 'recommendation_letter', label: 'Recommendation letter' },
 { value: 'salary_advance_form', label: 'Salary advance request' },
 { value: 'other', label: 'Other document' },
];

const DEMO_REQUESTS: DocumentRequest[] = [
 { id: '1', employeeName: 'Jane Muthoni', employeeNumber: 'EMP-001', department: 'Finance', documentType: 'employment_letter', documentLabel: 'Employment confirmation letter', reason: 'Bank loan application - KCB', status: 'pending', requestedAt: '2026-06-12T09:30:00Z', completedAt: null, handledBy: null, notes: null },
 { id: '2', employeeName: 'David Ochieng', employeeNumber: 'EMP-014', department: 'Operations', documentType: 'p9_form', documentLabel: 'P9 tax form', reason: 'Tax filing - FY 2025/2026', status: 'processing', requestedAt: '2026-06-11T14:00:00Z', completedAt: null, handledBy: 'Grace Wanjiku', notes: 'Extracting from payroll system' },
 { id: '3', employeeName: 'Mary Wambui', employeeNumber: 'EMP-023', department: 'Administration', documentType: 'payslip_copy', documentLabel: 'Payslip copy', reason: 'Visa application - UK embassy', status: 'completed', requestedAt: '2026-06-10T08:15:00Z', completedAt: '2026-06-10T16:30:00Z', handledBy: 'Grace Wanjiku', notes: 'Last 3 months payslips provided' },
 { id: '4', employeeName: 'Peter Kimani', employeeNumber: 'EMP-007', department: 'IT & Support', documentType: 'nssf_statement', documentLabel: 'NSSF statement', reason: 'Personal records update', status: 'completed', requestedAt: '2026-06-09T11:00:00Z', completedAt: '2026-06-11T10:00:00Z', handledBy: 'Admin HR', notes: null },
 { id: '5', employeeName: 'Alice Njeri', employeeNumber: 'EMP-031', department: 'Logistics', documentType: 'clearance_letter', documentLabel: 'Clearance letter', reason: 'Transitioning to new employer', status: 'rejected', requestedAt: '2026-06-08T09:00:00Z', completedAt: null, handledBy: 'Grace Wanjiku', notes: 'Employee has pending asset returns. Must clear with IT first.' },
 { id: '6', employeeName: 'Brian Otieno', employeeNumber: 'EMP-045', department: 'Security', documentType: 'employment_letter', documentLabel: 'Employment confirmation letter', reason: 'Rental apartment application', status: 'pending', requestedAt: '2026-06-12T11:45:00Z', completedAt: null, handledBy: null, notes: null },
 { id: '7', employeeName: 'Sarah Akinyi', employeeNumber: 'EMP-019', department: 'Operations', documentType: 'recommendation_letter', documentLabel: 'Recommendation letter', reason: 'Graduate school application', status: 'processing', requestedAt: '2026-06-11T16:00:00Z', completedAt: null, handledBy: 'Admin HR', notes: 'Checking with line manager for endorsement' },
 { id: '8', employeeName: 'John Mutua', employeeNumber: 'EMP-052', department: 'Warehouse', documentType: 'salary_advance_form', documentLabel: 'Salary advance request', reason: 'Medical emergency - family', status: 'pending', requestedAt: '2026-06-12T07:20:00Z', completedAt: null, handledBy: null, notes: null },
];

function StatusBadge({ status }: { status: RequestStatus }) {
 const config = {
 pending: { icon: Clock, label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
 processing: { icon: AlertCircle, label: 'Processing', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
 completed: { icon: CheckCircle2, label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
 rejected: { icon: XCircle, label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
 }[status];
 const Icon = config.icon;
 return (
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${config.cls}`}>
 <Icon className="w-3 h-3" />
 {config.label}
 </span>
 );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof Clock; accent: string }) {
 return (
 <div className={`dashboard-stat-card shadow-sm ${accent}`}>
 <div className="flex items-center gap-2">
 <Icon className="w-4 h-4 text-neutral-500" />
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
 </div>
 <p className="mt-2 text-2xl font-bold tabular-nums text-primary-900">{value}</p>
 </div>
 );
}

export default function DocumentRequestsPage() {
 const [requests, setRequests] = useState<DocumentRequest[]>(DEMO_REQUESTS);
 const [q, setQ] = useState('');
 const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
 const [typeFilter, setTypeFilter] = useState('');
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [actionMenuId, setActionMenuId] = useState<string | null>(null);

 const filtered = useMemo(() => {
 let result = requests;
 if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter);
 if (typeFilter) result = result.filter((r) => r.documentType === typeFilter);
 const query = q.trim().toLowerCase();
 if (query) {
 result = result.filter(
 (r) =>
 r.employeeName.toLowerCase().includes(query) ||
 r.employeeNumber.toLowerCase().includes(query) ||
 r.department.toLowerCase().includes(query) ||
 r.documentLabel.toLowerCase().includes(query) ||
 r.reason.toLowerCase().includes(query),
 );
 }
 return result;
 }, [requests, q, statusFilter, typeFilter]);

 const stats = useMemo(() => ({
 pending: requests.filter((r) => r.status === 'pending').length,
 processing: requests.filter((r) => r.status === 'processing').length,
 completed: requests.filter((r) => r.status === 'completed').length,
 rejected: requests.filter((r) => r.status === 'rejected').length,
 }), [requests]);

 function handleStatusChange(id: string, newStatus: RequestStatus) {
 setRequests((prev) =>
 prev.map((r) =>
 r.id === id
 ? {
 ...r,
 status: newStatus,
 completedAt: newStatus === 'completed' ? new Date().toISOString() : r.completedAt,
 handledBy: newStatus !== 'pending' ? 'Current User' : r.handledBy,
 }
 : r,
 ),
 );
 setActionMenuId(null);
 }

 const selectedRequest = selectedId ? requests.find((r) => r.id === selectedId) : null;

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Document requests"
 icon={FileQuestion}
 description="Review and process employee document requests from ESS."
 />

 <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
 <StatCard label="Pending" value={stats.pending} icon={Clock} accent="border-l-4 border-l-amber-500" />
 <StatCard label="Processing" value={stats.processing} icon={AlertCircle} accent="border-l-4 border-l-blue-500" />
 <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} accent="border-l-4 border-l-emerald-500" />
 <StatCard label="Rejected" value={stats.rejected} icon={XCircle} accent="border-l-4 border-l-red-400" />
 </section>

 <div className="dashboard-surface shadow-sm">
 <div className="p-4 border-b border-neutral-200">
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
 <input
 value={q}
 onChange={(e) => setQ(e.target.value)}
 placeholder="Search employee, document type, reason..."
 className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'all')}
 className="h-10 px-3 border border-neutral-300 rounded-lg text-sm bg-white"
 >
 <option value="all">All statuses</option>
 <option value="pending">Pending</option>
 <option value="processing">Processing</option>
 <option value="completed">Completed</option>
 <option value="rejected">Rejected</option>
 </select>
 <select
 value={typeFilter}
 onChange={(e) => setTypeFilter(e.target.value)}
 className="h-10 px-3 border border-neutral-300 rounded-lg text-sm bg-white"
 >
 <option value="">All document types</option>
 {DOCUMENT_TYPES.map((dt) => (
 <option key={dt.value} value={dt.value}>{dt.label}</option>
 ))}
 </select>
 </div>
 <p className="mt-2 text-xs text-neutral-500">
 Showing {filtered.length} of {requests.length} requests
 </p>
 </div>

 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[1000px]">
 <thead className="bg-neutral-50 border-b border-neutral-200">
 <tr>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Employee</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Document</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Reason</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-center">Status</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-center">Requested</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Handled by</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((req) => (
 <tr key={req.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
 <td className="px-4 py-3">
 <div>
 <p className="text-sm font-medium text-primary-900">{req.employeeName}</p>
 <p className="text-xs text-neutral-500">{req.employeeNumber} · {req.department}</p>
 </div>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
 <span className="text-sm text-neutral-700">{req.documentLabel}</span>
 </div>
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600 max-w-[200px] truncate" title={req.reason}>
 {req.reason}
 </td>
 <td className="px-4 py-3 col-center">
 <StatusBadge status={req.status} />
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600 col-center tabular-nums">
 {new Date(req.requestedAt).toLocaleDateString()}
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600">
 {req.handledBy || <span className="text-neutral-400">—</span>}
 </td>
 <td className="px-4 py-3 col-right relative">
 <div className="inline-flex items-center gap-1">
 <button
 type="button"
 onClick={() => setSelectedId(req.id)}
 className="p-1.5 rounded-lg hover:bg-neutral-100"
 title="View details"
 >
 <Eye className="w-4 h-4 text-neutral-600" />
 </button>
 <button
 type="button"
 onClick={() => setActionMenuId(actionMenuId === req.id ? null : req.id)}
 className="p-1.5 rounded-lg hover:bg-neutral-100"
 >
 <MoreHorizontal className="w-4 h-4 text-neutral-600" />
 </button>
 </div>
 {actionMenuId === req.id && (
 <div className="absolute right-4 top-full z-20 mt-1 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
 {req.status === 'pending' && (
 <>
 <button type="button" onClick={() => handleStatusChange(req.id, 'processing')} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
 <AlertCircle className="w-4 h-4 text-blue-600" />
 Mark processing
 </button>
 <button type="button" onClick={() => handleStatusChange(req.id, 'completed')} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
 <CheckCircle2 className="w-4 h-4 text-emerald-600" />
 Mark completed
 </button>
 <button type="button" onClick={() => handleStatusChange(req.id, 'rejected')} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
 <XCircle className="w-4 h-4" />
 Reject
 </button>
 </>
 )}
 {req.status === 'processing' && (
 <>
 <button type="button" onClick={() => handleStatusChange(req.id, 'completed')} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
 <CheckCircle2 className="w-4 h-4 text-emerald-600" />
 Mark completed
 </button>
 <button type="button" onClick={() => handleStatusChange(req.id, 'rejected')} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
 <XCircle className="w-4 h-4" />
 Reject
 </button>
 </>
 )}
 {(req.status === 'completed' || req.status === 'rejected') && (
 <button type="button" onClick={() => handleStatusChange(req.id, 'pending')} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
 <Clock className="w-4 h-4 text-amber-600" />
 Reopen
 </button>
 )}
 </div>
 )}
 </td>
 </tr>
 ))}
 {!filtered.length && (
 <tr>
 <td colSpan={7} className="px-4 py-12 text-center">
 <FileQuestion className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
 <p className="text-sm font-medium text-neutral-700">No document requests</p>
 <p className="text-xs text-neutral-500 mt-1">
 Requests from employees will appear here when submitted via the ESS portal.
 </p>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 {selectedRequest && (
 <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center" onClick={() => setSelectedId(null)}>
 <div className="w-full max-w-lg bg-white rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
 <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
 <h2 className="text-lg font-semibold text-primary-900">Request details</h2>
 <StatusBadge status={selectedRequest.status} />
 </div>
 <div className="p-5 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">Employee</p>
 <p className="text-sm font-medium text-primary-900">{selectedRequest.employeeName}</p>
 <p className="text-xs text-neutral-500">{selectedRequest.employeeNumber}</p>
 </div>
 <div>
 <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">Department</p>
 <p className="text-sm text-neutral-700">{selectedRequest.department}</p>
 </div>
 </div>
 <div>
 <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">Document requested</p>
 <p className="text-sm text-neutral-700">{selectedRequest.documentLabel}</p>
 </div>
 <div>
 <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">Reason</p>
 <p className="text-sm text-neutral-700">{selectedRequest.reason}</p>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">Requested on</p>
 <p className="text-sm text-neutral-700">{new Date(selectedRequest.requestedAt).toLocaleString()}</p>
 </div>
 <div>
 <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">Handled by</p>
 <p className="text-sm text-neutral-700">{selectedRequest.handledBy || 'Not yet assigned'}</p>
 </div>
 </div>
 {selectedRequest.notes && (
 <div>
 <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">Notes</p>
 <p className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-lg">{selectedRequest.notes}</p>
 </div>
 )}
 {selectedRequest.completedAt && (
 <div>
 <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">Completed on</p>
 <p className="text-sm text-neutral-700">{new Date(selectedRequest.completedAt).toLocaleString()}</p>
 </div>
 )}
 </div>
 <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
 {selectedRequest.status === 'pending' && (
 <button
 type="button"
 onClick={() => { handleStatusChange(selectedRequest.id, 'processing'); setSelectedId(null); }}
 className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
 >
 Start processing
 </button>
 )}
 {selectedRequest.status === 'processing' && (
 <button
 type="button"
 onClick={() => { handleStatusChange(selectedRequest.id, 'completed'); setSelectedId(null); }}
 className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
 >
 Mark completed
 </button>
 )}
 <button
 type="button"
 onClick={() => setSelectedId(null)}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
