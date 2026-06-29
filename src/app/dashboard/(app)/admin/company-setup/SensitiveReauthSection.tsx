'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CompanySetupSettings } from '@/lib/company-setup';
import type { UserRole, UserSummary } from '@/types/dashboard';

type Props = {
  form: CompanySetupSettings;
  setForm: React.Dispatch<React.SetStateAction<CompanySetupSettings>>;
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  staff: 'Staff',
  viewer: 'Viewer',
};

export function SensitiveReauthSection({ form, setForm }: Props) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/users')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
        return Array.isArray(data) ? (data as UserSummary[]) : [];
      })
      .then((list) => {
        if (!cancelled) {
          setUsers(list.filter((u) => u.isActive));
          setLoadError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load users');
          setUsers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const staffUsers = users.filter((u) => u.role !== 'admin');
  const selected = new Set(form.sensitiveActionReauthUserIds);

  const toggleUser = (userId: string, checked: boolean) => {
    setForm((f) => {
      const next = new Set(f.sensitiveActionReauthUserIds);
      if (checked) next.add(userId);
      else next.delete(userId);
      return { ...f, sensitiveActionReauthUserIds: [...next] };
    });
  };

  return (
    <div className="space-y-4">
      <label className="dash-setup-toggle-row">
        <span>
          <span className="block text-sm font-medium dash-setup-label">
            Require password confirmation for sensitive actions
          </span>
          <span className="block text-xs dash-setup-muted mt-0.5">
            When enabled, selected staff must re-enter their password before creating invoices,
            approving payroll, exporting bank files, and similar actions. Admins are always exempt.
          </span>
        </span>
        <input
          type="checkbox"
          checked={form.sensitiveActionReauthEnabled}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              sensitiveActionReauthEnabled: e.target.checked,
            }))
          }
          className="dash-setup-control mt-1 h-4 w-4 rounded border-[var(--dash-border)]"
        />
      </label>

      {form.sensitiveActionReauthEnabled ? (
        <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] p-4 space-y-3">
          <div>
            <p className="text-sm font-medium dash-setup-label">Apply to staff users</p>
            <p className="text-xs dash-setup-muted mt-0.5">
              Leave all unchecked to apply to every non-admin user. Check specific users to limit
              the requirement.
            </p>
          </div>
          {loading ? (
            <p className="text-sm dash-setup-muted inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading users…
            </p>
          ) : loadError ? (
            <p className="text-sm text-red-700">{loadError}</p>
          ) : staffUsers.length === 0 ? (
            <p className="text-sm dash-setup-muted">No non-admin staff users found.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {staffUsers.map((u) => (
                <li key={u.id}>
                  <label className="flex items-start gap-2 text-sm dash-setup-body cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={(e) => toggleUser(u.id, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--dash-border)]"
                    />
                    <span>
                      <span className="font-medium">{u.name}</span>
                      <span className="block text-xs dash-setup-muted">
                        {u.email} · {ROLE_LABELS[u.role]}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
