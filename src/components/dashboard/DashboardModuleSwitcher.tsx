'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDashboardDomain } from '@/contexts/dashboard-domain';
import { useDashboardModuleOrder } from '@/contexts/dashboard-module-order';
import {
  type DashboardModuleDomain,
} from '@/lib/dashboard-module-domains';
import { domainReadinessDotClass } from '@/lib/dashboard-nav-readiness';

function DomainReadinessDot({ readiness }: { readiness: DashboardModuleDomain['readiness'] }) {
  return (
    <span
      className={`h-2 w-2 flex-shrink-0 rounded-full ${domainReadinessDotClass(readiness)}`}
      aria-hidden
    />
  );
}

export function DashboardModuleSwitcher() {
  const { activeDomain, setActiveDomainId } = useDashboardDomain();
  const { orderedDomains } = useDashboardModuleOrder();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const CurrentIcon = activeDomain.icon;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dash-select-trigger flex h-9 max-w-[10.5rem] items-center gap-2 rounded-lg border px-2.5 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 sm:max-w-[11.5rem] lg:max-w-[13rem]"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch module"
      >
        <CurrentIcon className="h-4 w-4 flex-shrink-0 text-primary-600" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate">{activeDomain.shortLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          className="dash-popover absolute left-0 top-full z-30 mt-1.5 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border py-1"
          role="listbox"
          aria-label="Product modules"
        >
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Switch module
          </p>
          {orderedDomains.map((domain) => {
            const Icon = domain.icon;
            const isActive = domain.id === activeDomain.id;
            const locked = domain.access === 'locked';
            const content = (
              <>
                <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${locked ? 'bg-neutral-50 opacity-60' : 'bg-neutral-100'}`}>
                  <Icon className="h-4 w-4 text-neutral-600" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-sm font-medium ${isActive ? 'text-primary-800' : locked ? 'text-neutral-400' : 'text-ink'}`}>
                      {domain.shortLabel}
                    </span>
                    <DomainReadinessDot readiness={domain.readiness} />
                    {locked ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        Upgrade
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-neutral-500">
                    {domain.description}
                  </span>
                </span>
              </>
            );
            if (locked) {
              return (
                <div
                  key={domain.id}
                  role="option"
                  aria-selected={false}
                  aria-disabled
                  className="flex cursor-not-allowed items-start gap-3 px-3 py-2.5 opacity-80"
                >
                  {content}
                </div>
              );
            }
            return (
              <Link
                key={domain.id}
                href={domain.hubHref}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setActiveDomainId(domain.id);
                  setOpen(false);
                }}
                className={`flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--dash-hover)] ${
                  isActive ? 'bg-[color-mix(in_srgb,var(--brand-primary)_8%,var(--dash-surface-solid))]' : ''
                }`}
              >
                {content}
              </Link>
            );
          })}
          <div className="border-t border-[var(--dash-border-subtle)] px-3 py-2 text-[10px] leading-snug text-[var(--dash-text-muted)]">
            <Link
              href="/dashboard/settings#modules"
              onClick={() => setOpen(false)}
              className="font-medium text-primary-700 hover:text-primary-800"
            >
              Customize order…
            </Link>
            <span className="text-neutral-400"> · </span>
            Sidebar shows pages for the selected module. Use ⌘K to jump anywhere.
          </div>
        </div>
      ) : null}
    </div>
  );
}
