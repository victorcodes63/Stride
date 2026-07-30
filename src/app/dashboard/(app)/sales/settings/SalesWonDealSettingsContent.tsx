'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { toast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/sales/hooks';
import type { WonDealAutomationSettings } from '@/lib/sales/won-deal-settings';

type SettingsResponse = {
  settings: WonDealAutomationSettings;
  fleetLicensed: boolean;
};

const LABELS: Array<{
  key: keyof WonDealAutomationSettings;
  title: string;
  description: string;
  fleetOnly?: boolean;
}> = [
  {
    key: 'requireAcceptedQuote',
    title: 'Require accepted quote to win',
    description: 'Block marking a deal won unless a linked quote is accepted.',
  },
  {
    key: 'autoCreateInvoice',
    title: 'Auto-create invoice on win',
    description: 'Prefer converting an accepted quote; otherwise invoice from deal lines/value.',
  },
  {
    key: 'autoCreateSalesActual',
    title: 'Auto-create sales actual on win',
    description: 'Record attainment once per deal (never duplicates on re-save).',
  },
  {
    key: 'createDeliveryProject',
    title: 'Create delivery project on win',
    description:
      'Creates a Project linked via sourceDealId when the billing client has an outsourcing profile; otherwise skips with a notice.',
  },
  {
    key: 'offerFleetOrder',
    title: 'Offer fleet order on win',
    description:
      'When fleet is licensed, prompt to create a draft FleetOrder (never auto-creates).',
    fleetOnly: true,
  },
];

export default function SalesWonDealSettingsContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fleetLicensed, setFleetLicensed] = useState(false);
  const [settings, setSettings] = useState<WonDealAutomationSettings | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<SettingsResponse>('/api/sales/settings/won-deal');
      setSettings(res.settings);
      setFleetLicensed(res.fleetLicensed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await apiFetch<SettingsResponse>('/api/sales/settings/won-deal', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setSettings(res.settings);
      setFleetLicensed(res.fleetLicensed);
      toast.success('Won-deal settings saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="CRM settings"
        description="Won-deal automation for invoicing, actuals, delivery projects, and fleet offers."
      />

      {loading || !settings ? (
        <div className="flex items-center gap-2 text-sm text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {LABELS.map((row) => {
            const disabled = row.fleetOnly && !fleetLicensed;
            return (
              <label
                key={row.key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--dash-border)] p-4 ${
                  disabled ? 'opacity-60' : 'hover:bg-[var(--dash-hover)]'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings[row.key]}
                  disabled={disabled}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev ? { ...prev, [row.key]: e.target.checked } : prev,
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--dash-text-strong)]">
                    {row.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--dash-text-muted)]">
                    {row.description}
                    {disabled ? ' Fleet module is not licensed for this org.' : ''}
                  </span>
                </span>
              </label>
            );
          })}

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      )}
    </DashboardPage>
  );
}
