'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Loader2,
  AlertCircle,
  Plus,
  Wrench,
  FileText,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type Tab = 'sites' | 'leases' | 'maintenance';

type SiteRow = {
  id: string;
  siteCode: string;
  name: string;
  siteType: string;
  status: string;
  county: string | null;
  leaseCount?: number;
  ticketCount?: number;
};

type LeaseRow = {
  id: string;
  siteId: string;
  landlordName: string;
  endDate: string;
  monthlyRent: number | null;
  currency: string;
  status: string;
  daysUntilEnd: number;
  site?: { siteCode: string; name: string };
};

type TicketRow = {
  id: string;
  ticketNumber: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  dueDate: string | null;
  site?: { siteCode: string; name: string };
};

const SITE_TYPE_LABELS: Record<string, string> = {
  office: 'Office',
  warehouse: 'Warehouse',
  retail: 'Retail',
  site: 'Site',
  other: 'Other',
};

const LEASE_STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-800',
  expiring_soon: 'bg-amber-50 text-amber-800',
  expired: 'bg-red-50 text-red-800',
  terminated: 'bg-neutral-100 text-neutral-600',
};

const TICKET_STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-800',
  in_progress: 'bg-violet-50 text-violet-800',
  on_hold: 'bg-amber-50 text-amber-800',
  resolved: 'bg-emerald-50 text-emerald-800',
  closed: 'bg-neutral-100 text-neutral-600',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-neutral-300',
};

export default function FacilitiesContent() {
  const [tab, setTab] = useState<Tab>('sites');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ total: 0, active: 0, openTickets: 0 });

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showLeaseForm, setShowLeaseForm] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState('office');
  const [siteCounty, setSiteCounty] = useState('');

  const [leaseSiteId, setLeaseSiteId] = useState('');
  const [leaseLandlord, setLeaseLandlord] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [leaseRent, setLeaseRent] = useState('');

  const [ticketSiteId, setTicketSiteId] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState('other');
  const [ticketPriority, setTicketPriority] = useState('medium');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sitesRes, leasesRes, ticketsRes] = await Promise.all([
        fetch('/api/facilities/sites').then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Failed to load sites');
          return data;
        }),
        fetch('/api/facilities/leases').then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Failed to load leases');
          return data;
        }),
        fetch('/api/facilities/tickets').then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Failed to load tickets');
          return data;
        }),
      ]);
      setSites(sitesRes.sites ?? []);
      setSummary(sitesRes.summary ?? { total: 0, active: 0, openTickets: 0 });
      setLeases(leasesRes.leases ?? []);
      setTickets(ticketsRes.tickets ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createSite(e: React.FormEvent) {
    e.preventDefault();
    if (!siteName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/facilities/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: siteName.trim(),
          siteType,
          county: siteCounty.trim() || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create');
      setSiteName('');
      setSiteCounty('');
      setShowSiteForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function createLease(e: React.FormEvent) {
    e.preventDefault();
    if (!leaseSiteId || !leaseLandlord.trim() || !leaseStart || !leaseEnd) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/facilities/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: leaseSiteId,
          landlordName: leaseLandlord.trim(),
          startDate: leaseStart,
          endDate: leaseEnd,
          monthlyRent: leaseRent ? Number(leaseRent) : undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create');
      setLeaseLandlord('');
      setLeaseStart('');
      setLeaseEnd('');
      setLeaseRent('');
      setShowLeaseForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketSiteId || !ticketTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/facilities/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: ticketSiteId,
          title: ticketTitle.trim(),
          category: ticketCategory,
          priority: ticketPriority,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create');
      setTicketTitle('');
      setShowTicketForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function updateTicketStatus(id: string, status: string) {
    setSaving(true);
    try {
      const r = await fetch(`/api/facilities/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Update failed');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const expiringLeases = leases.filter((l) => l.status === 'expiring_soon' || l.status === 'expired');

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Facilities"
        description="Sites and branches, lease renewals, and maintenance requests — scoped to your workspace."
        icon={Building2}
      />

      <div className="mb-4 grid grid-cols-3 gap-3 sm:max-w-lg">
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
          <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Sites</p>
          <p className="text-lg font-bold">{summary.active}/{summary.total}</p>
          <p className="text-xs text-[var(--dash-text-muted)]">active</p>
        </div>
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
          <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Leases</p>
          <p className="text-lg font-bold text-amber-700">{expiringLeases.length}</p>
          <p className="text-xs text-[var(--dash-text-muted)]">expiring / expired</p>
        </div>
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
          <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Open tickets</p>
          <p className="text-lg font-bold">{summary.openTickets}</p>
          <p className="text-xs text-[var(--dash-text-muted)]">maintenance</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-[var(--dash-border)] pb-2">
        {(
          [
            { key: 'sites' as const, label: 'Sites', icon: Building2 },
            { key: 'leases' as const, label: 'Leases', icon: FileText },
            { key: 'maintenance' as const, label: 'Maintenance', icon: Wrench },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--dash-text-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : tab === 'sites' ? (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowSiteForm((v) => !v)}
              className="dash-auth-submit flex max-w-none items-center gap-1.5 px-4 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add site
            </button>
          </div>
          {showSiteForm ? (
            <form onSubmit={createSite} className="mb-4 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 space-y-3">
              <input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Site name"
                className="dash-auth-input w-full"
                required
              />
              <div className="flex flex-wrap gap-2">
                <select value={siteType} onChange={(e) => setSiteType(e.target.value)} className="dash-auth-input">
                  {Object.entries(SITE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  value={siteCounty}
                  onChange={(e) => setSiteCounty(e.target.value)}
                  placeholder="County"
                  className="dash-auth-input min-w-[10rem]"
                />
              </div>
              <button type="submit" disabled={saving} className="dash-auth-submit max-w-[8rem]">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          ) : null}
          {!sites.length ? (
            <p className="text-sm text-[var(--dash-text-muted)]">No sites yet. Add your first branch or location.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--dash-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--dash-border)] bg-[var(--dash-surface-muted)] text-left text-[var(--dash-text-muted)]">
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">County</th>
                    <th className="px-3 py-2 font-medium text-right">Leases</th>
                    <th className="px-3 py-2 font-medium text-right">Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--dash-border)] last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{s.siteCode}</td>
                      <td className="px-3 py-2 font-medium text-[var(--dash-text-strong)]">{s.name}</td>
                      <td className="px-3 py-2">{SITE_TYPE_LABELS[s.siteType] ?? s.siteType}</td>
                      <td className="px-3 py-2 text-[var(--dash-text-muted)]">{s.county ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.leaseCount ?? 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.ticketCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'leases' ? (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowLeaseForm((v) => !v)}
              disabled={!sites.length}
              className="dash-auth-submit flex max-w-none items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add lease
            </button>
          </div>
          {showLeaseForm ? (
            <form onSubmit={createLease} className="mb-4 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 space-y-3">
              <select
                value={leaseSiteId}
                onChange={(e) => setLeaseSiteId(e.target.value)}
                className="dash-auth-input w-full"
                required
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.siteCode} — {s.name}</option>
                ))}
              </select>
              <input
                value={leaseLandlord}
                onChange={(e) => setLeaseLandlord(e.target.value)}
                placeholder="Landlord name"
                className="dash-auth-input w-full"
                required
              />
              <div className="flex flex-wrap gap-2">
                <input type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} className="dash-auth-input" required />
                <input type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} className="dash-auth-input" required />
                <input
                  type="number"
                  value={leaseRent}
                  onChange={(e) => setLeaseRent(e.target.value)}
                  placeholder="Monthly rent (KES)"
                  className="dash-auth-input min-w-[10rem]"
                />
              </div>
              <button type="submit" disabled={saving} className="dash-auth-submit max-w-[8rem]">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          ) : null}
          {!leases.length ? (
            <p className="text-sm text-[var(--dash-text-muted)]">No leases recorded.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--dash-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--dash-border)] bg-[var(--dash-surface-muted)] text-left text-[var(--dash-text-muted)]">
                    <th className="px-3 py-2 font-medium">Site</th>
                    <th className="px-3 py-2 font-medium">Landlord</th>
                    <th className="px-3 py-2 font-medium">End date</th>
                    <th className="px-3 py-2 font-medium">Rent</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leases.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--dash-border)] last:border-0">
                      <td className="px-3 py-2">{l.site ? `${l.site.siteCode} — ${l.site.name}` : '—'}</td>
                      <td className="px-3 py-2 font-medium">{l.landlordName}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {l.endDate}
                        <span className="ml-1 text-xs text-[var(--dash-text-muted)]">({l.daysUntilEnd}d)</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {l.monthlyRent != null ? `${l.monthlyRent.toLocaleString()} ${l.currency}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEASE_STATUS_STYLES[l.status] ?? ''}`}>
                          {l.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowTicketForm((v) => !v)}
              disabled={!sites.length}
              className="dash-auth-submit flex max-w-none items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Raise ticket
            </button>
          </div>
          {showTicketForm ? (
            <form onSubmit={createTicket} className="mb-4 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 space-y-3">
              <select
                value={ticketSiteId}
                onChange={(e) => setTicketSiteId(e.target.value)}
                className="dash-auth-input w-full"
                required
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.siteCode} — {s.name}</option>
                ))}
              </select>
              <input
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                placeholder="Issue title"
                className="dash-auth-input w-full"
                required
              />
              <div className="flex flex-wrap gap-2">
                <select value={ticketCategory} onChange={(e) => setTicketCategory(e.target.value)} className="dash-auth-input">
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="structural">Structural</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="other">Other</option>
                </select>
                <select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} className="dash-auth-input">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <button type="submit" disabled={saving} className="dash-auth-submit max-w-[8rem]">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          ) : null}
          {!tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved').length ? (
            <p className="text-sm text-[var(--dash-text-muted)]">No open maintenance tickets.</p>
          ) : (
            <ul className="space-y-2">
              {tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved').map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-neutral-300'}`} />
                    <div>
                      <p className="font-medium text-[var(--dash-text-strong)]">
                        <span className="font-mono text-xs text-[var(--dash-text-muted)]">{t.ticketNumber}</span>
                        {' · '}
                        {t.title}
                      </p>
                      <p className="text-xs text-[var(--dash-text-muted)]">
                        {t.site ? `${t.site.siteCode} — ${t.site.name}` : ''} · {t.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_STATUS_STYLES[t.status] ?? ''}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                    {t.status === 'open' ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => updateTicketStatus(t.id, 'in_progress')}
                        className="text-xs text-[var(--brand-primary)] hover:underline"
                      >
                        Start
                      </button>
                    ) : t.status === 'in_progress' ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => updateTicketStatus(t.id, 'resolved')}
                        className="text-xs text-[var(--brand-primary)] hover:underline"
                      >
                        Resolve
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DashboardPage>
  );
}
