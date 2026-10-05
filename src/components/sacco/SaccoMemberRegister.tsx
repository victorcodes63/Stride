'use client';

import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

export type SaccoMemberRow = {
  id: string;
  memberNumber: string;
  fullName: string;
  status: string;
  joinedAt: string;
  balances: { shares: number; bosa: number; fosa: number };
};

function formatJoined(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * SACCO member register table. The dashboard shows balances; public previews hide them
 * (`showBalances={false}`) so the marketing site never displays money.
 */
export function SaccoMemberRegister({
  members,
  showBalances = true,
}: {
  members: SaccoMemberRow[];
  showBalances?: boolean;
}) {
  return (
    <DashboardTableCard>
      <DashboardTableViewport>
        <DashboardTable>
          <thead>
            <tr>
              <th>Member #</th>
              <th>Name</th>
              <th>Status</th>
              <th>Joined</th>
              {showBalances ? (
                <>
                  <th>Shares</th>
                  <th>BOSA</th>
                  <th>FOSA</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="font-mono text-xs">{m.memberNumber}</td>
                <td>{m.fullName}</td>
                <td className="capitalize">{m.status}</td>
                <td>{formatJoined(m.joinedAt)}</td>
                {showBalances ? (
                  <>
                    <td>{m.balances.shares.toLocaleString()}</td>
                    <td>{m.balances.bosa.toLocaleString()}</td>
                    <td>{m.balances.fosa.toLocaleString()}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </DashboardTable>
        {members.length === 0 ? <DashboardTableEmpty message="No members yet." /> : null}
      </DashboardTableViewport>
    </DashboardTableCard>
  );
}
