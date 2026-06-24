'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  FileText,
  Receipt,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { EssCardSkeleton } from '@/components/ess/EssSkeleton';
import { EssListItem, EssSectionTitle } from '@/components/ess/EssUi';
import { useEssApp } from '@/contexts/EssAppContext';

type HomeSummary = {
  actions: Array<{
    id: string;
    title: string;
    subtitle: string;
    href: string;
    priority: number;
  }>;
  widgets: {
    leave?: { typeName: string; remaining: number; entitled: number };
    payslip?: { id: string; month: number; year: number; netPay: number };
    attendance?: { daysWorked: number; hoursThisMonth: number };
    shift?: { startsAt: string; name: string };
  };
  activity: Array<{ id: string; title: string; at: string; href?: string }>;
};

const SERVICE_ROWS = [
  {
    href: '/ess/attendance',
    title: 'Attendance',
    description: 'Check in/out at work sites and view monthly records.',
    icon: CalendarDays,
    module: 'time' as const,
    tone: 'secondary',
  },
  {
    href: '/ess/payslips',
    title: 'Payslips',
    description: 'View and download monthly payslips.',
    icon: Receipt,
    module: 'payroll' as const,
    tone: 'primary',
  },
  {
    href: '/ess/leave',
    title: 'Leave',
    description: 'View leave balances and submit applications.',
    icon: CalendarDays,
    module: 'leave' as const,
    tone: 'primary',
  },
  {
    href: '/ess/documents',
    title: 'Documents',
    description: 'Access HR documents and employee records.',
    icon: FileText,
    module: 'core' as const,
    tone: 'secondary',
  },
];

function ServiceRow({
  href,
  title,
  description,
  icon: Icon,
  tone,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}) {
  const accent =
    tone === 'primary'
      ? 'bg-[var(--ess-accent-soft)] text-[var(--ess-accent)]'
      : 'bg-[var(--ess-secondary-soft)] text-[var(--ess-secondary)]';
  return (
    <Link
      href={href}
      className="flex min-h-[82px] items-center gap-4 rounded-[1.35rem] border border-[var(--ess-border)] bg-[var(--ess-surface)] px-4 py-3 shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-[var(--ess-text)]">{title}</span>
        <span className="mt-0.5 block text-sm leading-5 text-[var(--ess-muted)]">{description}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-[var(--ess-muted)]" />
    </Link>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-4 text-center shadow-sm">
      <Icon className="mx-auto h-5 w-5 text-[var(--ess-secondary)]" strokeWidth={1.8} />
      <p className="mt-2 text-2xl font-black leading-none text-[var(--ess-text)]">{value}</p>
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ess-muted)]">{label}</p>
    </div>
  );
}

export default function EssHomePage() {
  const { enabledModules } = useEssApp();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ess/home-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const services = SERVICE_ROWS.filter((row) => enabledModules[row.module]);
  const leaveRemaining = summary?.widgets.leave?.remaining ?? 0;
  const hoursThisMonth = summary?.widgets.attendance?.hoursThisMonth ?? 0;
  const verifiedCount = summary?.widgets.payslip ? 1 : 0;

  return (
    <div className="space-y-5">
      <section className="ess-today-card relative -mt-3 overflow-hidden rounded-[1.5rem] p-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 left-14 h-28 w-28 rounded-full bg-black/10" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">Today</p>
          <h1 className="mt-3 text-xl font-black leading-tight text-white">
            {summary?.widgets.shift ? 'On shift — check out when you leave' : 'Ready for your workday'}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              In {summary?.widgets.shift ? new Date(summary.widgets.shift.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              Out —
            </span>
          </div>
          <Link href="/ess/attendance/clock" className="mt-6 flex min-h-11 items-center justify-between border-t border-white/15 pt-4 text-sm font-black text-white">
            {summary?.widgets.shift ? 'Check out' : 'Check in'}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <section>
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            <EssCardSkeleton />
            <EssCardSkeleton />
            <EssCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Days" value={leaveRemaining} icon={CalendarDays} />
            <StatTile label="Hours" value={hoursThisMonth || '—'} icon={Clock3} />
            <StatTile label="Verified" value={verifiedCount} icon={ShieldAlert} />
          </div>
        )}
      </section>

      {services.length > 0 ? (
        <section>
          <EssSectionTitle eyebrow="Your services" title="What do you need?" />
          <div className="space-y-3">
            {services.map((service) => (
              <ServiceRow key={service.href} {...service} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <EssSectionTitle eyebrow="Inbox" title="Action required" />
        {loading ? (
          <EssCardSkeleton />
        ) : summary?.actions?.length ? (
          <div className="space-y-2">
            {summary.actions.map((action) => (
              <EssListItem
                key={action.id}
                href={action.href}
                title={action.title}
                subtitle={action.subtitle}
                className="border-amber-500/30 bg-amber-500/10"
              />
            ))}
          </div>
        ) : (
          <div className="ess-card-flat flex items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--ess-secondary-soft)] text-[var(--ess-secondary)]">
              ✓
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[var(--ess-text)]">You are all caught up</p>
              <p className="text-sm text-[var(--ess-muted)]">No pending HR actions right now.</p>
            </div>
          </div>
        )}
      </section>

      {summary?.activity?.length ? (
        <section>
          <EssSectionTitle eyebrow="Timeline" title="Recent activity" />
          <ul className="space-y-2">
            {summary.activity.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <EssListItem href={item.href} title={item.title} meta={new Date(item.at).toLocaleString()} />
                ) : (
                  <EssListItem title={item.title} meta={new Date(item.at).toLocaleString()} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
