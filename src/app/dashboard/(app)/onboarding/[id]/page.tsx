'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type WorkflowDetail = {
 id: string;
 type: 'ONBOARDING' | 'OFFBOARDING';
 status: string;
 startedAt: string;
 employee: { firstName: string; lastName: string; department?: { name: string | null } | null };
 tasks: Array<{
 id: string;
 title: string;
 description?: string | null;
 assignedRole: string;
 category?: string | null;
 dueDate?: string | null;
 status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE';
 isRequired: boolean;
 notes?: string | null;
 }>;
};

export default function OnboardingDetailPage() {
 const params = useParams();
 const id = params?.id as string;
 const [data, setData] = useState<WorkflowDetail | null>(null);
 const [notes, setNotes] = useState<Record<string, string>>({});

 useEffect(() => {
 if (!id) return;
 fetch(`/api/onboarding/workflows/${id}`)
 .then((r) => r.json())
 .then((payload) => setData(payload))
 .catch(() => setData(null));
 }, [id]);

 const grouped = useMemo(() => {
 const source = data?.tasks ?? [];
 return source.reduce<Record<string, WorkflowDetail['tasks']>>((acc, task) => {
 const key = (task.category || 'Other').toUpperCase();
 if (!acc[key]) acc[key] = [];
 acc[key].push(task);
 return acc;
 }, {});
 }, [data?.tasks]);

 async function updateTask(taskId: string, status: string) {
 const note = notes[taskId] ?? '';
 await fetch(`/api/onboarding/tasks/${taskId}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status, notes: note }),
 });
 const refreshed = await fetch(`/api/onboarding/workflows/${id}`).then((r) => r.json());
 setData(refreshed);
 }

 if (!data) return <div className="dashboard-surface rounded-lg p-4 text-sm text-neutral-600">Loading workflow...</div>;

 const completed = data.tasks.filter((task) => task.status === 'COMPLETED').length;
 const progress = data.tasks.length ? Math.round((completed / data.tasks.length) * 100) : 0;

 return (
 <div className="space-y-5">
 <div className="dashboard-surface rounded-lg p-4">
 <DashboardPageHeader
 title={`${data.employee.firstName} ${data.employee.lastName}`}
 description={`${data.employee.department?.name ?? 'No department'} • ${data.type}`}
 meta={`${completed}/${data.tasks.length} complete`}
 />
 <div className="mt-3 h-2 rounded bg-neutral-200">
 <div className="h-2 rounded bg-primary-600" style={{ width: `${progress}%` }} />
 </div>
 </div>

 {Object.entries(grouped).map(([category, tasks]) => (
 <div key={category} className="dashboard-surface rounded-lg p-4">
 <h2 className="mb-3 text-sm font-semibold text-neutral-700">{category}</h2>
 <div className="space-y-2">
 {tasks.map((task) => (
 <div key={task.id} className="rounded border p-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div>
 <p className="font-medium text-neutral-900">{task.title}</p>
 <p className="text-xs text-neutral-500">{task.assignedRole} • {task.status}</p>
 </div>
 <div className="flex gap-2">
 <button className="rounded border px-2 py-1 text-xs" onClick={() => updateTask(task.id, 'COMPLETED')}>Complete</button>
 {!task.isRequired && (
 <button className="rounded border px-2 py-1 text-xs" onClick={() => updateTask(task.id, 'SKIPPED')}>Skip</button>
 )}
 </div>
 </div>
 <textarea
 className="mt-2 w-full rounded border px-2 py-1 text-xs"
 placeholder="Add notes"
 value={notes[task.id] ?? task.notes ?? ''}
 onChange={(e) => setNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
 />
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 );
}
