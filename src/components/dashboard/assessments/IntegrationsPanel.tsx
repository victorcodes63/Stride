'use client';

import { useEffect, useState } from 'react';
import { Plug, Plus, RefreshCw, Trash2, Download } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';

type ProviderMeta = {
  key: string;
  label: string;
  credentialFields: Array<{ key: string; label: string; secret?: boolean; optional?: boolean }>;
};

type Connection = {
  id: string;
  provider: string;
  label: string;
  baseUrl: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  assessmentCount: number;
};

type CatalogItem = {
  externalId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  durationMinutes?: number | null;
  dimensions?: string[];
};

export function IntegrationsPanel() {
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [credentialStorageReady, setReady] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [catalog, setCatalog] = useState<{ connectionId: string; items: CatalogItem[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [metaRes, connRes] = await Promise.all([
      fetch('/api/assessments/meta', { cache: 'no-store' }),
      fetch('/api/assessments/providers', { cache: 'no-store' }),
    ]);
    const meta = await metaRes.json();
    setProviders(meta.providers ?? []);
    setReady(Boolean(meta.credentialStorageReady));
    setConnections(connRes.ok ? await connRes.json() : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function disconnect(id: string) {
    if (!confirm('Disconnect this provider? Imported assessments will be removed.')) return;
    await fetch(`/api/assessments/providers/${id}`, { method: 'DELETE' });
    void load();
  }

  async function fetchCatalog(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/assessments/providers/${id}/catalog`, { cache: 'no-store' });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not fetch catalog.');
      return;
    }
    setCatalog({ connectionId: id, items: await res.json() });
  }

  async function importItem(connectionId: string, item: CatalogItem) {
    await fetch(`/api/assessments/providers/${connectionId}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [item] }),
    });
    void load();
  }

  return (
    <div className="space-y-4">
      {!credentialStorageReady ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Credential storage is not configured. Set the <code>CREDENTIALS_ENC_KEY</code> environment variable to connect external providers securely.
        </p>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--dash-text-strong)]">Assessment providers</h3>
          <p className="text-xs text-[var(--dash-text-muted)]">Connect SHL, Criteria, Hogan, Predictive Index, DISC, Big Five, HireVue, or any REST provider.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} disabled={!credentialStorageReady} className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          <Plus className="h-4 w-4" /> Connect provider
        </button>
      </div>

      {showForm ? (
        <ConnectForm providers={providers} onDone={() => { setShowForm(false); void load(); }} />
      ) : null}

      <div className="space-y-2">
        {connections.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--dash-border)] px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">
            <Plug className="mx-auto mb-2 h-5 w-5" /> No providers connected yet.
          </p>
        ) : (
          connections.map((c) => (
            <div key={c.id} className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--dash-text-strong)]">{c.label} <span className="font-normal text-[var(--dash-text-muted)]">· {c.provider}</span></p>
                  <p className="text-xs text-[var(--dash-text-muted)]">{c.assessmentCount} imported · {c.lastSyncedAt ? `synced ${new Date(c.lastSyncedAt).toLocaleDateString()}` : 'never synced'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => fetchCatalog(c.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2.5 py-1.5 text-xs font-medium">
                    <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Browse catalog
                  </button>
                  <button type="button" onClick={() => disconnect(c.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {catalog?.connectionId === c.id ? (
                <div className="mt-3 space-y-1 border-t border-[var(--dash-border-subtle)] pt-3">
                  {catalog.items.length === 0 ? (
                    <p className="text-xs text-[var(--dash-text-muted)]">No assessments returned.</p>
                  ) : (
                    catalog.items.map((item) => (
                      <div key={item.externalId} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--dash-surface-muted)] px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{item.name}{item.durationMinutes ? ` · ${item.durationMinutes}m` : ''}</span>
                        <button type="button" onClick={() => importItem(c.id, item)} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
                          <Download className="h-3.5 w-3.5" /> Import
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ConnectForm({ providers, onDone }: { providers: ProviderMeta[]; onDone: () => void }) {
  const [provider, setProvider] = useState(providers[0]?.key ?? 'generic');
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = providers.find((p) => p.key === provider);

  async function submit() {
    setError(null);
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/assessments/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, label, baseUrl: baseUrl || undefined, webhookSecret: webhookSecret || undefined, credentials }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to connect.');
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
      {error ? <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Provider</span>
          <StrideSelect value={provider} onChange={(v) => { setProvider(v); setCredentials({}); }} options={providers.map((p) => ({ value: p.key, label: p.label }))} ariaLabel="Provider" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Label</span>
          <input className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. SHL production" />
        </label>
        {meta?.credentialFields.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">{f.label}{f.optional ? '' : ' *'}</span>
            <input
              type={f.secret ? 'password' : 'text'}
              className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm"
              value={credentials[f.key] ?? ''}
              onChange={(e) => setCredentials((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="text-sm">
          <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Base URL (optional)</span>
          <input className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.provider.com" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Webhook secret (optional)</span>
          <input type="password" className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={submit} disabled={saving} className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Connecting…' : 'Save connection'}
        </button>
      </div>
    </div>
  );
}
