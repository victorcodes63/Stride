'use client';

import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

export type ConstructionSiteRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  parentSiteCode: string | null;
  projectCode: string | null;
  childCount: number;
};

const STATUS_CHIP: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  planning: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
  suspended: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  completed: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
};

/** Site hierarchy table (parent sites, phases, project links). Used on the sites page and in previews. */
export function ConstructionSiteTable({ sites }: { sites: ConstructionSiteRow[] }) {
  return (
    <DashboardTableCard>
      <DashboardTableViewport>
        <DashboardTable>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Status</th>
              <th>Parent</th>
              <th>Project</th>
              <th>Phases</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.code}</td>
                <td className={s.parentSiteCode ? 'pl-6' : 'font-medium'}>
                  {s.parentSiteCode ? <span className="mr-1.5 text-[var(--dash-text-faint)]">└</span> : null}
                  {s.name}
                </td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                      STATUS_CHIP[s.status] ?? STATUS_CHIP.completed
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td>{s.parentSiteCode ?? '—'}</td>
                <td>{s.projectCode ?? '—'}</td>
                <td>{s.childCount}</td>
              </tr>
            ))}
          </tbody>
        </DashboardTable>
        {sites.length === 0 ? <DashboardTableEmpty message="No sites configured." /> : null}
      </DashboardTableViewport>
    </DashboardTableCard>
  );
}
