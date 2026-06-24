'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
 Building2,
 Pencil,
 Users,
 FolderOpen,
 ChevronLeft,
 Mail,
 Phone,
 UserPlus,
 Upload,
 X,
} from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

interface Department {
 id: string;
 name: string;
 employeeCount: number;
}

interface ClientDetail {
 id: string;
 name: string;
 contactName?: string | null;
 contactEmail?: string | null;
 contactPhone?: string | null;
 kraPin?: string | null;
 bankName?: string | null;
 currency?: string | null;
}

interface ClientDetailViewProps {
 clientId: string;
}

export default function ClientDetailView({ clientId }: ClientDetailViewProps) {
 const searchParams = useSearchParams();
 const showWelcome = searchParams.get('welcome') === '1';
 const [dismissWelcome, setDismissWelcome] = useState(false);
 const [client, setClient] = useState<ClientDetail | null>(null);
 const [departments, setDepartments] = useState<Department[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const fetchClient = async (id: string) => {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch(`/api/outsourcing/clients/${id}`);
 if (!res.ok) throw new Error('Failed to load client');
 const data = await res.json();
 setClient(data);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load client');
 setClient(null);
 } finally {
 setLoading(false);
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

 useEffect(() => {
 fetchClient(clientId);
 fetchDepartments(clientId);
 }, [clientId]);

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

 return (
 <div className="w-full min-w-0">
 <nav className="mb-4 sm:mb-5" aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link
 href="/dashboard/outsourcing/clients"
 className="hover:text-primary-700 transition-colors"
 >
 Outsourcing Clients
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
 <div className="flex items-center gap-2 mb-1">
 <Link
 href="/dashboard/outsourcing/clients"
 className="text-neutral-500 hover:text-primary-700 transition-colors"
 aria-label="Back to clients"
 >
 <ChevronLeft className="w-5 h-5" />
 </Link>
 </div>
 <DashboardPageHeader
 title={client.name}
 description="Departments are managed on a separate page. Then add or import employees here."
 className="!mb-0"
 />
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
 Edit client
 </Link>
 </div>
 </div>

 {showWelcome && !dismissWelcome && (
 <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
 <div className="flex-1 min-w-0">
 <p className="font-bold text-emerald-950">Client created</p>
 <p className="text-sm text-emerald-900/90 mt-1">
 <strong>1.</strong> Open <strong>Departments</strong> and add at least one department for this client.{' '}
 <strong>2.</strong> Add people with <strong>Add employee</strong> or <strong>Import Excel</strong> (buttons
 above).
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
 )}

 {error && (
 <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
 {error}
 </div>
 )}

 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
 <div className="relative overflow-hidden dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Departments</p>
 <p className="text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums">{departmentCount}</p>
 <p className="text-[11px] text-neutral-500 mt-1">Configured for this client</p>
 </div>
 <div className="relative overflow-hidden dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Total staff</p>
 <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">{totalStaff}</p>
 <p className="text-[11px] text-neutral-500 mt-1">Across all departments</p>
 </div>
 <div className="relative overflow-hidden dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Currency</p>
 <p className="text-2xl sm:text-3xl font-bold text-primary-700 tabular-nums">{currency}</p>
 <p className="text-[11px] text-neutral-500 mt-1">Used for billing/payroll</p>
 </div>
 </div>
 <div className="dashboard-surface shadow-sm p-4 sm:p-6">
 <h2 className="text-base font-semibold text-primary-900 mb-4 flex items-center gap-2">
 <Building2 className="w-5 h-5 text-primary-600" />
 Client details
 </h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {(client.contactName || client.contactEmail || client.contactPhone) && (
 <div>
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
 Contact
 </p>
 <div className="space-y-1 text-sm text-neutral-700">
 {client.contactName && <p>{client.contactName}</p>}
 {client.contactEmail && (
 <p className="flex items-center gap-1.5">
 <Mail className="w-4 h-4 text-neutral-400" />
 <a
 href={`mailto:${client.contactEmail}`}
 className="text-primary-600 hover:underline"
 >
 {client.contactEmail}
 </a>
 </p>
 )}
 {client.contactPhone && (
 <p className="flex items-center gap-1.5">
 <Phone className="w-4 h-4 text-neutral-400" />
 <a
 href={`tel:${client.contactPhone}`}
 className="text-primary-600 hover:underline"
 >
 {client.contactPhone}
 </a>
 </p>
 )}
 </div>
 </div>
 )}
 {client.kraPin && (
 <div>
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
 KRA PIN
 </p>
 <p className="text-sm text-neutral-700">{client.kraPin}</p>
 </div>
 )}
 {client.bankName && (
 <div>
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
 Bank
 </p>
 <p className="text-sm text-neutral-700">
 {client.bankName}
 {client.currency && ` (${client.currency})`}
 </p>
 </div>
 )}
 </div>
 </div>

 <div className="dashboard-surface shadow-sm p-4 sm:p-6" id="departments">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <h2 className="text-base font-semibold text-primary-900 flex items-center gap-2">
 <FolderOpen className="w-5 h-5 text-primary-600" />
 Departments
 </h2>
 <p className="text-sm text-neutral-600 mt-1">
 Add and edit departments on the{' '}
 <Link
 href={`/dashboard/outsourcing/departments?clientId=${encodeURIComponent(clientId)}`}
 className="font-semibold text-primary-700 hover:underline"
 >
 Departments
 </Link>{' '}
 page—not on the add-client form.
 </p>
 </div>
 <Link
 href={`/dashboard/outsourcing/departments?clientId=${encodeURIComponent(clientId)}`}
 className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-primary-200 bg-primary-50 text-primary-900 rounded-xl font-semibold text-sm hover:bg-primary-100 shrink-0"
 >
 Open departments
 </Link>
 </div>
 {departments.length > 0 && (
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
 )}
 {departments.length === 0 && (
 <p className="text-sm text-amber-800 mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
 No departments yet.{' '}
 <Link
 href={`/dashboard/outsourcing/departments?clientId=${encodeURIComponent(clientId)}`}
 className="font-semibold underline"
 >
 Add departments
 </Link>{' '}
 before Excel import (department names must match).
 </p>
 )}
 </div>
 </div>
 </div>
 );
}
