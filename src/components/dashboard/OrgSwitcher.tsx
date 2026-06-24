'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Loader2 } from 'lucide-react';
import type { UserSummary } from '@/types/dashboard';

type OrgSwitcherProps = {
  currentUser: UserSummary | null;
  onOrgSwitched?: () => void;
};

export function OrgSwitcher({ currentUser, onOrgSwitched }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const orgs = currentUser?.organizations ?? [];
  const showSwitcher = orgs.length > 1;
  const activeName = currentUser?.currentOrgName ?? 'Organization';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!currentUser?.currentOrgId || !showSwitcher) {
    if (!currentUser?.currentOrgName) return null;
    return (
      <div className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 sm:flex">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
        <span className="max-w-[140px] truncate">{activeName}</span>
      </div>
    );
  }

  async function switchOrg(organizationId: string) {
    if (organizationId === currentUser?.currentOrgId || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Failed to switch organization');
      }
      setOpen(false);
      onOrgSwitched?.();
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 sm:flex"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" aria-hidden />
        ) : (
          <Building2 className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
        )}
        <span className="max-w-[140px] truncate">{activeName}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 min-w-[200px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {orgs.map((org) => (
            <li key={org.id}>
              <button
                type="button"
                role="option"
                aria-selected={org.id === currentUser.currentOrgId}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                  org.id === currentUser.currentOrgId ? 'bg-primary-50/50 font-medium' : ''
                }`}
                onClick={() => switchOrg(org.id)}
              >
                <span className="truncate">{org.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
