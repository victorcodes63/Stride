'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, Loader2, Shield } from 'lucide-react';
import type { CompanySetupCapabilities } from '@/lib/company-setup-tier-features';
import { companySetupUpgradeHint } from '@/lib/company-setup-tier-features';

export type EmailDomainRow = {
  id: string;
  domain: string;
  verified: boolean;
  verifiedAt: string | null;
  txtRecord: string;
};

function TierLockedNotice({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-4 py-3 text-sm dash-setup-muted">
      {message}
    </p>
  );
}

export function AuthDomainsSection({
  capabilities,
  initialDomains,
}: {
  capabilities: CompanySetupCapabilities;
  initialDomains: EmailDomainRow[];
}) {
  const [domains, setDomains] = useState(initialDomains);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/auth/domains');
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.domains)) {
      setDomains(data.domains);
    }
  }, []);

  if (!capabilities.canConfigureAuthPolicy) {
    return (
      <TierLockedNotice message={companySetupUpgradeHint(capabilities.tier, 'canConfigureAuthPolicy')} />
    );
  }

  const runAction = async (action: 'add' | 'verify' | 'remove', domain: string) => {
    setError('');
    setLoading(`${action}:${domain}`);
    try {
      const res = await fetch('/api/admin/auth/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, domain }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && action !== 'verify') {
        setError(data.error || 'Request failed.');
        return;
      }
      if (action === 'add' && res.ok) {
        await refresh();
        setNewDomain('');
        return;
      }
      if (action === 'verify') {
        if (!data.verified) setError(data.message || 'Verification failed.');
        await refresh();
        return;
      }
      await refresh();
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm dash-setup-muted">
        Verify email domains with a DNS TXT record before SSO or domain-based sign-in works. JIT provisioning only applies on verified domains.
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="acme.co.ke"
          className="min-w-[200px] flex-1 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={!newDomain.trim() || loading != null}
          onClick={() => void runAction('add', newDomain)}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Add domain
        </button>
      </div>

      {domains.length === 0 ? (
        <p className="text-sm dash-setup-muted">No domains added yet.</p>
      ) : (
        <ul className="space-y-3">
          {domains.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 dash-setup-muted" />
                  <span className="font-medium">{row.domain}</span>
                  {row.verified ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-xs dash-setup-muted">Pending verification</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!row.verified ? (
                    <button
                      type="button"
                      disabled={loading != null}
                      onClick={() => void runAction('verify', row.domain)}
                      className="text-sm dash-setup-link"
                    >
                      {loading === `verify:${row.domain}` ? (
                        <Loader2 className="inline h-4 w-4 animate-spin" />
                      ) : (
                        'Check DNS'
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={loading != null}
                    onClick={() => void runAction('remove', row.domain)}
                    className="text-sm text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {!row.verified ? (
                <p className="mt-2 font-mono text-xs dash-setup-muted break-all">
                  TXT: {row.txtRecord}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
