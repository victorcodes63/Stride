'use client';

import { useEffect, useMemo, useState } from 'react';
import {
 CalendarClock,
 Clock,
 Loader2,
 Plus,
 Save,
 Search,
 Settings2,
 Sun,
 Moon,
 Sunrise,
 Users,
 Check,
 X,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ShiftPattern = {
 id: string;
 name: string;
 startTime: string;
 endTime: string;
 breakMinutes: number;
 type: 'day' | 'night' | 'split' | 'flexible';
 isDefault: boolean;
 employeeCount: number;
};

type DepartmentEssConfig = {
 id: string;
 departmentName: string;
 employeeCount: number;
 essEnabled: boolean;
 clockInRequired: boolean;
 locationTrackingEnabled: boolean;
 defaultShiftId: string | null;
 defaultShiftName: string | null;
 leaveRequestEnabled: boolean;
 documentRequestEnabled: boolean;
};

type EssFeatureToggle = {
 key: string;
 label: string;
 description: string;
 enabled: boolean;
};

const DEMO_SHIFTS: ShiftPattern[] = [
 { id: '1', name: 'Morning shift', startTime: '06:00', endTime: '14:00', breakMinutes: 60, type: 'day', isDefault: true, employeeCount: 45 },
 { id: '2', name: 'Day shift', startTime: '08:00', endTime: '17:00', breakMinutes: 60, type: 'day', isDefault: false, employeeCount: 128 },
 { id: '3', name: 'Evening shift', startTime: '14:00', endTime: '22:00', breakMinutes: 45, type: 'split', isDefault: false, employeeCount: 32 },
 { id: '4', name: 'Night shift', startTime: '22:00', endTime: '06:00', breakMinutes: 45, type: 'night', isDefault: false, employeeCount: 18 },
 { id: '5', name: 'Flexible hours', startTime: '07:00', endTime: '19:00', breakMinutes: 60, type: 'flexible', isDefault: false, employeeCount: 65 },
];

const DEMO_DEPARTMENTS: DepartmentEssConfig[] = [
 { id: '1', departmentName: 'Operations', employeeCount: 45, essEnabled: true, clockInRequired: true, locationTrackingEnabled: true, defaultShiftId: '1', defaultShiftName: 'Morning shift', leaveRequestEnabled: true, documentRequestEnabled: true },
 { id: '2', departmentName: 'Administration', employeeCount: 28, essEnabled: true, clockInRequired: true, locationTrackingEnabled: false, defaultShiftId: '2', defaultShiftName: 'Day shift', leaveRequestEnabled: true, documentRequestEnabled: true },
 { id: '3', departmentName: 'Finance', employeeCount: 12, essEnabled: true, clockInRequired: false, locationTrackingEnabled: false, defaultShiftId: '2', defaultShiftName: 'Day shift', leaveRequestEnabled: true, documentRequestEnabled: true },
 { id: '4', departmentName: 'Security', employeeCount: 32, essEnabled: true, clockInRequired: true, locationTrackingEnabled: true, defaultShiftId: null, defaultShiftName: null, leaveRequestEnabled: true, documentRequestEnabled: false },
 { id: '5', departmentName: 'Logistics', employeeCount: 38, essEnabled: true, clockInRequired: true, locationTrackingEnabled: true, defaultShiftId: '1', defaultShiftName: 'Morning shift', leaveRequestEnabled: true, documentRequestEnabled: true },
 { id: '6', departmentName: 'IT & Support', employeeCount: 15, essEnabled: true, clockInRequired: false, locationTrackingEnabled: false, defaultShiftId: '5', defaultShiftName: 'Flexible hours', leaveRequestEnabled: true, documentRequestEnabled: true },
 { id: '7', departmentName: 'Warehouse', employeeCount: 22, essEnabled: true, clockInRequired: true, locationTrackingEnabled: true, defaultShiftId: '3', defaultShiftName: 'Evening shift', leaveRequestEnabled: true, documentRequestEnabled: false },
];

const DEMO_FEATURES: EssFeatureToggle[] = [
 { key: 'clock_in_out', label: 'Clock in / Clock out', description: 'Employees can clock in and out via the ESS portal', enabled: true },
 { key: 'leave_requests', label: 'Leave requests', description: 'Employees can apply for leave directly from the portal', enabled: true },
 { key: 'payslip_view', label: 'Payslip access', description: 'Employees can view and download their payslips', enabled: true },
 { key: 'document_requests', label: 'Document requests', description: 'Employees can request employment letters, P9 forms, etc.', enabled: true },
 { key: 'profile_editing', label: 'Profile self-editing', description: 'Employees can update their own personal & banking details', enabled: true },
 { key: 'team_calendar', label: 'Team calendar', description: 'Managers can view team leave calendar and availability', enabled: true },
 { key: 'location_tracking', label: 'GPS location on clock-in', description: 'Capture GPS coordinates when employees clock in (field staff)', enabled: false },
 { key: 'overtime_requests', label: 'Overtime requests', description: 'Employees can request pre-approved overtime hours', enabled: false },
];

function ShiftTypeIcon({ type }: { type: ShiftPattern['type'] }) {
 switch (type) {
 case 'day': return <Sun className="w-4 h-4 text-amber-600" />;
 case 'night': return <Moon className="w-4 h-4 text-indigo-600" />;
 case 'split': return <Sunrise className="w-4 h-4 text-orange-600" />;
 case 'flexible': return <Clock className="w-4 h-4 text-emerald-600" />;
 }
}

export default function EssShiftsPage() {
 const [activeTab, setActiveTab] = useState<'shifts' | 'departments' | 'features'>('shifts');
 const [shifts, setShifts] = useState<ShiftPattern[]>(DEMO_SHIFTS);
 const [departments, setDepartments] = useState<DepartmentEssConfig[]>(DEMO_DEPARTMENTS);
 const [features, setFeatures] = useState<EssFeatureToggle[]>(DEMO_FEATURES);
 const [createShiftOpen, setCreateShiftOpen] = useState(false);
 const [saving, setSaving] = useState(false);
 const [success, setSuccess] = useState<string | null>(null);
 const [deptSearch, setDeptSearch] = useState('');
 const [shiftForm, setShiftForm] = useState({
 name: '',
 startTime: '08:00',
 endTime: '17:00',
 breakMinutes: 60,
 type: 'day' as ShiftPattern['type'],
 });

 const filteredDepartments = useMemo(() => {
 const q = deptSearch.trim().toLowerCase();
 if (!q) return departments;
 return departments.filter((d) => d.departmentName.toLowerCase().includes(q));
 }, [departments, deptSearch]);

 const totalEssEmployees = useMemo(
 () => departments.filter((d) => d.essEnabled).reduce((sum, d) => sum + d.employeeCount, 0),
 [departments],
 );

 function handleCreateShift(e: React.FormEvent) {
 e.preventDefault();
 const newShift: ShiftPattern = {
 id: String(Date.now()),
 ...shiftForm,
 isDefault: false,
 employeeCount: 0,
 };
 setShifts((prev) => [...prev, newShift]);
 setCreateShiftOpen(false);
 setShiftForm({ name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60, type: 'day' });
 setSuccess('Shift pattern created.');
 setTimeout(() => setSuccess(null), 3000);
 }

 function toggleDeptEss(id: string) {
 setDepartments((prev) =>
 prev.map((d) => (d.id === id ? { ...d, essEnabled: !d.essEnabled } : d)),
 );
 }

 function toggleDeptClockIn(id: string) {
 setDepartments((prev) =>
 prev.map((d) => (d.id === id ? { ...d, clockInRequired: !d.clockInRequired } : d)),
 );
 }

 function toggleFeature(key: string) {
 setFeatures((prev) =>
 prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)),
 );
 }

 function handleSaveConfig() {
 setSaving(true);
 setTimeout(() => {
 setSaving(false);
 setSuccess('ESS configuration saved successfully.');
 setTimeout(() => setSuccess(null), 3000);
 }, 800);
 }

 const tabs = [
 { id: 'shifts' as const, label: 'Shift patterns', count: shifts.length },
 { id: 'departments' as const, label: 'Department config', count: departments.length },
 { id: 'features' as const, label: 'Feature toggles', count: features.filter((f) => f.enabled).length },
 ];

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="ESS & shifts"
 icon={CalendarClock}
 description={`Configure shift schedules and self-service features for ${totalEssEmployees} employees.`}
 actions={
 <button
 type="button"
 onClick={handleSaveConfig}
 disabled={saving}
 className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
 >
 {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
 Save configuration
 </button>
 }
 className="mb-6"
 />

 {success && (
 <div className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm px-4 py-3 border border-emerald-100">
 {success}
 </div>
 )}

 <div className="border-b border-neutral-200 mb-6">
 <nav className="flex gap-6">
 {tabs.map((tab) => (
 <button
 key={tab.id}
 type="button"
 onClick={() => setActiveTab(tab.id)}
 className={`relative pb-3 text-sm font-medium transition-colors ${
 activeTab === tab.id
 ? 'text-primary-700 after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary-600 after:rounded-full'
 : 'text-neutral-500 hover:text-neutral-700'
 }`}
 >
 {tab.label}
 <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
 {tab.count}
 </span>
 </button>
 ))}
 </nav>
 </div>

 {activeTab === 'shifts' && (
 <div className="space-y-4">
 <div className="flex justify-between items-center">
 <p className="text-sm text-neutral-600">
 Define shift patterns that can be assigned to departments or individual employees.
 </p>
 <button
 type="button"
 onClick={() => setCreateShiftOpen(true)}
 className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Plus className="w-4 h-4" />
 Add shift
 </button>
 </div>

 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 {shifts.map((shift) => (
 <div key={shift.id} className="dashboard-stat-card shadow-sm hover:border-primary-200 transition-colors">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-2">
 <ShiftTypeIcon type={shift.type} />
 <h3 className="text-sm font-semibold text-primary-900">{shift.name}</h3>
 </div>
 {shift.isDefault && (
 <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-primary-50 text-primary-700">
 Default
 </span>
 )}
 </div>
 <div className="mt-3 grid grid-cols-3 gap-2 text-center">
 <div className="rounded-lg bg-neutral-50 p-2">
 <p className="text-[10px] font-medium uppercase text-neutral-500">Start</p>
 <p className="text-sm font-semibold text-primary-900 tabular-nums">{shift.startTime}</p>
 </div>
 <div className="rounded-lg bg-neutral-50 p-2">
 <p className="text-[10px] font-medium uppercase text-neutral-500">End</p>
 <p className="text-sm font-semibold text-primary-900 tabular-nums">{shift.endTime}</p>
 </div>
 <div className="rounded-lg bg-neutral-50 p-2">
 <p className="text-[10px] font-medium uppercase text-neutral-500">Break</p>
 <p className="text-sm font-semibold text-primary-900 tabular-nums">{shift.breakMinutes}m</p>
 </div>
 </div>
 <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
 <span className="capitalize">{shift.type} shift</span>
 <span className="flex items-center gap-1">
 <Users className="w-3 h-3" />
 {shift.employeeCount} employees
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'departments' && (
 <div className="space-y-4">
 <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
 <p className="text-sm text-neutral-600">
 Configure which departments have ESS enabled and their clock-in requirements.
 </p>
 <div className="relative max-w-xs">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
 <input
 value={deptSearch}
 onChange={(e) => setDeptSearch(e.target.value)}
 placeholder="Search departments..."
 className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm"
 />
 </div>
 </div>

 <div className="dashboard-surface shadow-sm overflow-hidden">
 <table className="w-full text-left">
 <thead className="bg-neutral-50 border-b border-neutral-200">
 <tr>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Department</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase text-center">Staff</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase text-center">ESS enabled</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase text-center">Clock-in</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Default shift</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase text-center">GPS</th>
 </tr>
 </thead>
 <tbody>
 {filteredDepartments.map((dept) => (
 <tr key={dept.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
 <td className="px-4 py-3 text-sm font-medium text-primary-900">{dept.departmentName}</td>
 <td className="px-4 py-3 text-sm text-neutral-600 text-center">{dept.employeeCount}</td>
 <td className="px-4 py-3 text-center">
 <button
 type="button"
 onClick={() => toggleDeptEss(dept.id)}
 className={`w-8 h-5 rounded-full transition-colors relative ${dept.essEnabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}
 >
 <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${dept.essEnabled ? 'left-3.5' : 'left-0.5'}`} />
 </button>
 </td>
 <td className="px-4 py-3 text-center">
 <button
 type="button"
 onClick={() => toggleDeptClockIn(dept.id)}
 disabled={!dept.essEnabled}
 className={`w-8 h-5 rounded-full transition-colors relative disabled:opacity-40 ${dept.clockInRequired ? 'bg-primary-500' : 'bg-neutral-300'}`}
 >
 <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${dept.clockInRequired ? 'left-3.5' : 'left-0.5'}`} />
 </button>
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600">
 {dept.defaultShiftName || <span className="text-neutral-400 italic">Not set</span>}
 </td>
 <td className="px-4 py-3 text-center">
 {dept.locationTrackingEnabled ? (
 <Check className="w-4 h-4 text-emerald-600 mx-auto" />
 ) : (
 <X className="w-4 h-4 text-neutral-300 mx-auto" />
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {activeTab === 'features' && (
 <div className="space-y-4">
 <p className="text-sm text-neutral-600">
 Enable or disable self-service features available to employees in the ESS portal.
 </p>
 <div className="grid gap-3 sm:grid-cols-2">
 {features.map((feature) => (
 <div
 key={feature.key}
 className={`dashboard-surface p-4 shadow-sm transition-colors ${
 feature.enabled ? 'border-emerald-200' : 'border-neutral-200'
 }`}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1">
 <h3 className="text-sm font-semibold text-primary-900">{feature.label}</h3>
 <p className="text-xs text-neutral-500 mt-0.5">{feature.description}</p>
 </div>
 <button
 type="button"
 onClick={() => toggleFeature(feature.key)}
 className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${feature.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}
 >
 <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${feature.enabled ? 'left-5' : 'left-1'}`} />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {createShiftOpen && (
 <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center" onClick={() => setCreateShiftOpen(false)}>
 <div className="w-full max-w-md bg-white rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
 <div className="px-5 py-4 border-b border-neutral-200">
 <h2 className="text-lg font-semibold text-primary-900">Create shift pattern</h2>
 </div>
 <form onSubmit={handleCreateShift} className="p-5 space-y-4">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Shift name</label>
 <input
 value={shiftForm.name}
 onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))}
 required
 placeholder="e.g. Weekend rotation"
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Start time</label>
 <input
 type="time"
 value={shiftForm.startTime}
 onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">End time</label>
 <input
 type="time"
 value={shiftForm.endTime}
 onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Break (minutes)</label>
 <input
 type="number"
 min={0}
 max={120}
 value={shiftForm.breakMinutes}
 onChange={(e) => setShiftForm((f) => ({ ...f, breakMinutes: parseInt(e.target.value) || 0 }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Shift type</label>
 <select
 value={shiftForm.type}
 onChange={(e) => setShiftForm((f) => ({ ...f, type: e.target.value as ShiftPattern['type'] }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 >
 <option value="day">Day</option>
 <option value="night">Night</option>
 <option value="split">Split</option>
 <option value="flexible">Flexible</option>
 </select>
 </div>
 </div>
 <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
 <button type="button" onClick={() => setCreateShiftOpen(false)} className="px-4 py-2 border border-neutral-300 rounded-lg text-sm">
 Cancel
 </button>
 <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
 Create shift
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
