'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { STRIDE_DASHBOARD_SWATCHES } from '@/lib/platform-swatches';
import type { VelocityWeek } from '@/lib/projects/velocity';

const AXIS = { fill: 'var(--dash-text-muted)', fontSize: 11 } as const;
const GRID = 'var(--dash-border)';

const STATUS_COLORS: Record<string, string> = {
  backlog: '#94a3b8',
  todo: STRIDE_DASHBOARD_SWATCHES.sky.accent,
  in_progress: STRIDE_DASHBOARD_SWATCHES.violet.accent,
  blocked: STRIDE_DASHBOARD_SWATCHES.rose.accent,
  done: STRIDE_DASHBOARD_SWATCHES.emerald.accent,
};

const HEALTH_COLORS: Record<string, string> = {
  on_track: STRIDE_DASHBOARD_SWATCHES.emerald.accent,
  at_risk: STRIDE_DASHBOARD_SWATCHES.amber.accent,
  off_track: STRIDE_DASHBOARD_SWATCHES.rose.accent,
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-[var(--dash-text-strong)]">{label}</p> : null}
      {payload.map((e, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="tabular-nums font-medium">{e.value}</span>
          <span className="text-[var(--dash-text-muted)]">{e.name}</span>
        </p>
      ))}
    </div>
  );
}

export function ProjectVelocityChart({ data }: { data: VelocityWeek[] }) {
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-[var(--dash-text-muted)]">No velocity data yet.</p>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="projCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STRIDE_DASHBOARD_SWATCHES.emerald.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={STRIDE_DASHBOARD_SWATCHES.emerald.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="projCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STRIDE_DASHBOARD_SWATCHES.sky.accent} stopOpacity={0.25} />
              <stop offset="100%" stopColor={STRIDE_DASHBOARD_SWATCHES.sky.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="created"
            name="Created"
            stroke={STRIDE_DASHBOARD_SWATCHES.sky.accent}
            fill="url(#projCreated)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke={STRIDE_DASHBOARD_SWATCHES.emerald.accent}
            fill="url(#projCompleted)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectStatusMixChart({ statusMix }: { statusMix: Record<string, number> }) {
  const data = Object.entries(statusMix)
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({
      name: status.replace('_', ' '),
      value,
      color: STATUS_COLORS[status] ?? '#94a3b8',
    }));
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-[var(--dash-text-muted)]">No tasks yet.</p>;
  }
  return (
    <div className="flex h-56 items-center gap-4">
      <div className="h-full w-1/2 min-w-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="capitalize text-[var(--dash-text-body)]">{d.name}</span>
            <span className="ml-auto tabular-nums font-medium text-[var(--dash-text-strong)]">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectHealthBars({ healthCounts }: { healthCounts: Record<string, number> }) {
  const data = [
    { name: 'On track', key: 'on_track', value: healthCounts.on_track ?? 0 },
    { name: 'At risk', key: 'at_risk', value: healthCounts.at_risk ?? 0 },
    { name: 'Off track', key: 'off_track', value: healthCounts.off_track ?? 0 },
  ];
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name="Projects" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.key} fill={HEALTH_COLORS[d.key] ?? '#94a3b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectWorkloadChart({
  workload,
}: {
  workload: Array<{ name: string | null; openTaskCount: number; estimateHours: number }>;
}) {
  const data = workload.slice(0, 8).map((w) => ({
    name: (w.name ?? 'Unknown').split(' ')[0] ?? '?',
    fullName: w.name ?? 'Unknown',
    tasks: w.openTaskCount,
    hours: Math.round(w.estimateHours),
  }));
  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-[var(--dash-text-muted)]">
        No assigned open tasks.
      </p>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={64} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as { fullName: string; tasks: number; hours: number };
              return (
                <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold">{row.fullName}</p>
                  <p>{row.tasks} open · {row.hours}h estimated</p>
                </div>
              );
            }}
          />
          <Bar dataKey="tasks" name="Open tasks" fill={STRIDE_DASHBOARD_SWATCHES.coral?.accent ?? '#FF5436'} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
