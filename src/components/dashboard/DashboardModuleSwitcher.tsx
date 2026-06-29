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
import {
  useWorkspaceControl,
  WorkspaceAnchoredPopover,
} from '@/components/dashboard/WorkspaceControlContext';

function DomainReadinessDot({ readiness }: { readiness: DashboardModuleDomain['readiness'] }) {
  return (
    <span
      className={`h-2 w-2 flex-shrink-0 rounded-full ${domainReadinessDotClass(readiness)}`}
      aria-hidden
    />
  );
}

type Props = {
  /** When true, omits outer border for use inside a grouped workspace control. */
  embedded?: boolean;
};

export function DashboardModuleSwitcher({ embedded = false }: Props) {
  const { activeDomain, setActiveDomainId } = useDashboardDomain();
  const { visibleDomains } = useDashboardModuleOrder();
  const workspace = useWorkspaceControl();
  const [localOpen, setLocalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const CurrentIcon = activeDomain.icon;

  const open = embedded && workspace ? workspace.openPanel === 'module' : localOpen;

  const setOpen = (next: boolean) => {
    if (embedded && workspace) {
      workspace.setOpenPanel(next ? 'module' : null);
      return;
    }
    setLocalOpen(next);
  };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open || embedded) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open, embedded]);

  useEffect(() => {
    if (!open || !embedded) return;
    function onClickOutside(event: MouseEvent) {
      const root = workspace?.rootRef.current;
      const target = event.target as Node;
      if (root && !root.contains(target)) {
        const popover = document.getElementById('workspace-popover-module');
        if (popover && popover.contains(target)) return;
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open, embedded, workspace?.rootRef]);

  return (
    <div className={`relative shrink-0 ${embedded ? 'min-w-0 flex-1' : ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`dash-select-trigger flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
          embedded ? 'max-w-none border-0 rounded-none shadow-none' : 'max-w-[10.5rem] border sm:max-w-[11.5rem] lg:max-w-[13rem]'
        }`}
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
        <WorkspaceAnchoredPopover
          open={open}
          embedded={embedded}
          className={`dash-popover overflow-hidden rounded-xl border py-1 ${
            embedded ? '' : 'absolute left-0 top-full z-40 mt-1.5 w-[min(100vw-2rem,20rem)]'
          }`}
        >
          <div
            id={embedded ? 'workspace-popover-module' : undefined}
            role="listbox"
            aria-label="Product modules"
          >
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-text-faint)]">
            Switch module
          </p>
          {visibleDomains.map((domain) => {
            const Icon = domain.icon;
            const isActive = domain.id === activeDomain.id;
            const content = (
              <>
                <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--dash-surface-raised)]`}>
                  <Icon className="h-4 w-4 text-[var(--dash-text-muted)]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-sm font-medium ${isActive ? 'text-primary-800' : 'text-[var(--dash-text-strong)]'}`}>
                      {domain.shortLabel}
                    </span>
                    <DomainReadinessDot readiness={domain.readiness} />
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--dash-text-muted)]">
                    {domain.description}
                  </span>
                </span>
              </>
            );
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
            <span className="text-[var(--dash-text-faint)]"> · </span>
            Sidebar shows pages for the selected module. Use ⌘K to jump anywhere.
          </div>
          </div>
        </WorkspaceAnchoredPopover>
      ) : null}
    </div>
  );
}
