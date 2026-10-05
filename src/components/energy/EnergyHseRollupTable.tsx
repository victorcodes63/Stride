'use client';

import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

export type EnergyHseRollupRow = {
  entityLabel: string;
  clientName: string;
  siteCount: number;
  openIncidents: number;
  highSeverity: number;
  permitsExpiring: number;
};

function countTone(value: number, tone: 'rose' | 'amber') {
  if (value === 0) return 'text-[var(--dash-text-muted)]';
  return tone === 'rose'
    ? 'font-semibold text-rose-700 dark:text-rose-300'
    : 'font-semibold text-amber-700 dark:text-amber-300';
}

/** Group HSE exposure per operating entity. Used on the energy HSE page and in public previews. */
export function EnergyHseRollupTable({ rows }: { rows: EnergyHseRollupRow[] }) {
  return (
    <DashboardTableCard>
      <DashboardTableViewport>
        <DashboardTable>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Client</th>
              <th>Sites</th>
              <th>Open incidents</th>
              <th>High severity</th>
              <th>Permits expiring</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.entityLabel + row.clientName}>
                <td className="font-medium">{row.entityLabel}</td>
                <td>{row.clientName}</td>
                <td>{row.siteCount}</td>
                <td className={countTone(row.openIncidents, 'amber')}>{row.openIncidents}</td>
                <td className={countTone(row.highSeverity, 'rose')}>{row.highSeverity}</td>
                <td className={countTone(row.permitsExpiring, 'amber')}>{row.permitsExpiring}</td>
              </tr>
            ))}
          </tbody>
        </DashboardTable>
        {rows.length === 0 ? <DashboardTableEmpty message="No energy sites seeded for rollup." /> : null}
      </DashboardTableViewport>
    </DashboardTableCard>
  );
}
