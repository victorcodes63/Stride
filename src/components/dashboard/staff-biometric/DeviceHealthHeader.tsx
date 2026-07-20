'use client';

import { Activity, AlertTriangle, CheckCircle2, Cpu, HelpCircle, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StaffBiometricOverview } from './types';

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type Card = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'default' | 'warning' | 'success' | 'danger';
  hint?: string;
};

const TONE_CLASS: Record<NonNullable<Card['tone']>, string> = {
  default: 'text-primary-900',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

export function DeviceHealthHeader({ overview }: { overview: StaffBiometricOverview | null }) {
  if (!overview) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dashboard-stat-card animate-pulse shadow-sm">
            <div className="mb-2 h-3 w-16 rounded bg-neutral-200" />
            <div className="h-7 w-12 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    );
  }

  const cards: Card[] = [
    {
      label: 'Devices',
      value: overview.totalDevices,
      icon: Cpu,
      hint: `${overview.activeDevices} active · ${overview.inactiveDevices} off`,
    },
    {
      label: 'Active',
      value: overview.activeDevices,
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Stale devices',
      value: overview.staleDevices,
      icon: AlertTriangle,
      tone: overview.staleDevices > 0 ? 'warning' : 'default',
      hint: 'No poll in 24h',
    },
    {
      label: 'Punches 24h',
      value: overview.punches24h,
      icon: Activity,
      hint: `${overview.punches7d} in 7d`,
    },
    {
      label: 'Unmatched',
      value: overview.unmatchedPunches,
      icon: HelpCircle,
      tone: overview.unmatchedPunches > 0 ? 'warning' : 'success',
      hint: `${overview.matchedRate}% matched`,
    },
    {
      label: 'Last seen',
      value: relativeTime(overview.lastObservedAt),
      icon: Timer,
      hint: overview.lastPollAt ? `Polled ${relativeTime(overview.lastPollAt)}` : 'Never polled',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="dashboard-stat-card shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                {card.label}
              </span>
              <Icon className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
            </div>
            <div
              className={`mt-1 text-2xl font-bold tabular-nums ${TONE_CLASS[card.tone ?? 'default']}`}
            >
              {card.value}
            </div>
            {card.hint ? (
              <div className="mt-0.5 text-[11px] text-neutral-400">{card.hint}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
