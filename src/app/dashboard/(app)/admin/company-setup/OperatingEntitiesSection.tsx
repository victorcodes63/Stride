'use client';

import { useEffect, useMemo, useState } from 'react';
import { Globe, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { CountryCode, OperatingEntity, OperatingEntitiesSettings } from '@/lib/operating-entities';
import { COUNTRY_PROFILES } from '@/lib/operating-entities';

type ApiResponse = OperatingEntitiesSettings & {
 envMultiEntityEnabled: boolean;
 defaults: OperatingEntitiesSettings;
};

const inputClass =
 'w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

function emptyEntity(countryCode: CountryCode = 'KE'): OperatingEntity {
 const profile = COUNTRY_PROFILES[countryCode];
 const slug = countryCode.toLowerCase();
 return {
 id: slug,
 legalName: '',
 countryCode,
 currency: profile.defaultCurrency,
 employeeNumberPrefix: 'EMP',
 isActive: true,
 };
}

export function OperatingEntitiesSection() {
 const [data, setData] = useState<ApiResponse | null>(null);
 const [form, setForm] = useState<OperatingEntitiesSettings | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 useEffect(() => {
 let cancelled = false;
 fetch('/api/admin/operating-entities')
 .then(async (r) => {
 const json = await r.json();
 if (!r.ok) throw new Error(json.error || 'Failed to load operating entities.');
 return json as ApiResponse;
 })
 .then((payload) => {
 if (cancelled) return;
 setData(payload);
 setForm({
 multiEntityEnabled: payload.multiEntityEnabled,
 entities: payload.entities,
 defaultEntityId: payload.defaultEntityId,
 });
 })
 .catch((e: unknown) => {
 if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load operating entities.');
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, []);

 const preview = useMemo(() => {
 if (!form || !data) return null;
 const activeCount = form.entities.filter((e) => e.isActive).length;
 const showSwitcher = form.multiEntityEnabled && activeCount > 1;
 return showSwitcher
 ? `Entity switcher will show ${activeCount} entities in the top bar.`
 : 'Entity switcher hidden — single-entity mode.';
 }, [form, data]);

 function updateEntity(index: number, patch: Partial<OperatingEntity>) {
 setForm((prev) => {
 if (!prev) return prev;
 const entities = [...prev.entities];
 const current = { ...entities[index]!, ...patch };
 if (patch.countryCode) {
 const profile = COUNTRY_PROFILES[patch.countryCode];
 if (!entities[index]!.currency || entities[index]!.currency === COUNTRY_PROFILES[entities[index]!.countryCode].defaultCurrency) {
 current.currency = profile.defaultCurrency;
 }
 }
 entities[index] = current;
 return { ...prev, entities };
 });
 }

 function addEntity() {
 setForm((prev) => {
 if (!prev) return prev;
 const used = new Set(prev.entities.map((e) => e.id));
 let candidate = emptyEntity('UG');
 if (used.has('ug')) candidate = { ...emptyEntity('KE'), id: `entity-${prev.entities.length + 1}` };
 while (used.has(candidate.id)) {
 candidate = { ...candidate, id: `entity-${Math.random().toString(36).slice(2, 6)}` };
 }
 return { ...prev, entities: [...prev.entities, candidate] };
 });
 }

 function removeEntity(index: number) {
 setForm((prev) => {
 if (!prev || prev.entities.length <= 1) return prev;
 const entities = prev.entities.filter((_, i) => i !== index);
 const defaultEntityId = entities.some((e) => e.id === prev.defaultEntityId)
 ? prev.defaultEntityId
 : entities.find((e) => e.isActive)?.id ?? entities[0]!.id;
 return { ...prev, entities, defaultEntityId };
 });
 }

 async function handleSave(e: React.FormEvent) {
 e.preventDefault();
 if (!form) return;
 setSaving(true);
 setError(null);
 setSuccess(null);
 try {
 const res = await fetch('/api/admin/operating-entities', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 const json = await res.json();
 if (!res.ok) {
 const detail = Array.isArray(json.details)
 ? json.details.map((d: { message: string }) => d.message).join(' ')
 : json.error;
 throw new Error(detail || 'Save failed.');
 }
 setForm({
 multiEntityEnabled: json.multiEntityEnabled,
 entities: json.entities,
 defaultEntityId: json.defaultEntityId,
 });
 setData((d) => (d ? { ...d, ...json } : d));
 setSuccess('Operating entities saved. Refresh the dashboard to see switcher changes.');
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message : 'Save failed.');
 } finally {
 setSaving(false);
 }
 }

 if (loading) {
 return (
 <section className="dashboard-surface shadow-sm p-6 flex justify-center">
 <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
 </section>
 );
 }

 if (!form || !data) return null;

 return (
 <section className="dashboard-surface shadow-sm p-5 sm:p-6 space-y-5">
 <div>
 <h2 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
 <Globe className="w-5 h-5 text-primary-600" />
 Operating regions &amp; legal entities
 </h2>
 <p className="text-sm text-neutral-600 mt-1">
 Configure legal employers for payroll, employees, and statutory compliance. The top-bar entity switcher appears
 when multi-entity mode is enabled and two or more entities are active.
 </p>
 </div>

 {!data.envMultiEntityEnabled ? (
 <p className="text-sm text-neutral-600 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
 Use the toggle below to enable the dashboard entity switcher for this company. The switcher appears after you
 save with at least two active entities.
 </p>
 ) : null}

 <label className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3 cursor-pointer hover:bg-neutral-50">
 <span>
 <span className="block text-sm font-medium text-neutral-800">Enable entity switcher</span>
 <span className="block text-xs text-neutral-500 mt-0.5">
 Allow staff to switch between configured legal entities in the dashboard header.
 </span>
 </span>
 <input
 type="checkbox"
 checked={form.multiEntityEnabled}
 onChange={(e) => setForm((f) => f && { ...f, multiEntityEnabled: e.target.checked })}
 className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 />
 </label>

 <div className="space-y-4">
 {form.entities.map((entity, index) => (
 <div key={entity.id + index} className="rounded-lg border border-neutral-200 p-4 space-y-3">
 <div className="flex items-center justify-between gap-2">
 <p className="text-sm font-semibold text-neutral-800">
 {entity.legalName || `Entity ${index + 1}`}
 {!entity.isActive ? (
 <span className="ml-2 text-xs font-normal text-neutral-500">(inactive)</span>
 ) : null}
 </p>
 {form.entities.length > 1 ? (
 <button
 type="button"
 onClick={() => removeEntity(index)}
 className="text-neutral-400 hover:text-red-600 p-1"
 aria-label="Remove entity"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 ) : null}
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Slug (entity code)</label>
 <input
 value={entity.id}
 onChange={(e) => updateEntity(index, { id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
 className={inputClass}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Legal name</label>
 <input
 value={entity.legalName}
 onChange={(e) => updateEntity(index, { legalName: e.target.value })}
 className={inputClass}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Country</label>
 <select
 value={entity.countryCode}
 onChange={(e) => updateEntity(index, { countryCode: e.target.value as CountryCode })}
 className={inputClass}
 >
 <option value="KE">Kenya</option>
 <option value="UG">Uganda</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Currency</label>
 <input
 value={entity.currency}
 onChange={(e) => updateEntity(index, { currency: e.target.value.toUpperCase() })}
 className={inputClass}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Employee number prefix</label>
 <input
 value={entity.employeeNumberPrefix}
 onChange={(e) => updateEntity(index, { employeeNumberPrefix: e.target.value })}
 className={inputClass}
 />
 </div>
 <div className="flex flex-col justify-end gap-2">
 <label className="flex items-center gap-2 text-sm text-neutral-700">
 <input
 type="checkbox"
 checked={entity.isActive}
 onChange={(e) => updateEntity(index, { isActive: e.target.checked })}
 className="h-4 w-4 rounded border-neutral-300 text-primary-600"
 />
 Active
 </label>
 <label className="flex items-center gap-2 text-sm text-neutral-700">
 <input
 type="radio"
 name="defaultEntity"
 checked={form.defaultEntityId === entity.id}
 onChange={() => setForm((f) => f && { ...f, defaultEntityId: entity.id })}
 />
 Default entity
 </label>
 </div>
 </div>
 </div>
 ))}
 </div>

 <button
 type="button"
 onClick={addEntity}
 className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
 >
 <Plus className="w-4 h-4" />
 Add entity
 </button>

 {preview ? (
 <p className="text-sm text-neutral-600 rounded-lg bg-primary-50/60 border border-primary-100 px-3 py-2">{preview}</p>
 ) : null}

 {error ? <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p> : null}
 {success ? (
 <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{success}</p>
 ) : null}

 <form onSubmit={handleSave}>
 <button
 type="submit"
 disabled={saving}
 className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
 >
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 Save operating entities
 </button>
 </form>
 </section>
 );
}
