'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Receipt, Smartphone, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PayrollSurfaceConfig } from '@/components/payroll/PayrollWorkspace';
import { withOutsourcingClientQuery } from '@/lib/outsourcing-client-context';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type SubnavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Sub-path appended to the surface base path (empty for the runs landing). */
  suffix: string;
};

const ITEMS: SubnavItem[] = [
  { key: 'runs', label: 'Payroll runs', icon: Wallet, suffix: '' },
  { key: 'payslips', label: 'Payslips', icon: FileText, suffix: '/payslips' },
  { key: 'statutory', label: 'Statutory returns', icon: Receipt, suffix: '/statutory' },
  { key: 'disbursements', label: 'M-Pesa disbursements', icon: Smartphone, suffix: '/disbursements' },
];

/**
 * Well-placed segmented switcher for moving between the payroll surfaces
 * (runs / payslips / statutory / disbursements). Render inside the page
 * header `footer` strip. Active state is derived from the current pathname.
 */
export function PayrollSubnav({
  config,
  clientId,
}: {
  config: PayrollSurfaceConfig;
  clientId?: string;
}) {
  const pathname = usePathname() ?? '';
  const isOutsourcing = config.mode === 'outsourcing';

  const tabs = ITEMS.map((item) => {
    const path = `${config.basePath}${item.suffix}`;
    const href = isOutsourcing ? withOutsourcingClientQuery(path, clientId) : path;
    return { ...item, path, href };
  });

  // Longest matching base path wins so deeper detail routes still highlight
  // their parent tab, and the empty runs suffix doesn't steal the match.
  const activeKey =
    tabs
      .filter((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0]?.key ?? 'runs';

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Payroll sections">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-100 text-primary-900 shadow-sm'
                : 'text-[var(--dash-text-muted)] hover:bg-primary-50/60',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
