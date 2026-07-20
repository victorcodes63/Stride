'use client';

import { Suspense } from 'react';
import { CalendarOff } from 'lucide-react';

import { EmployeeLeavePanel } from '@/components/dashboard/leave/EmployeeLeavePanel';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTableToolbar } from '@/components/dashboard/DashboardDataTable';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';

function OutsourcingLeaveContent() {
  const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient();

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        icon={CalendarOff}
        title="Client leave"
        description="Per end-client leave queue, calendar, accruals, and liability for the outsourced workforce."
      />
      {showSwitcher ? (
        <div className="mb-4 overflow-hidden dashboard-surface shadow-sm">
          <DashboardTableToolbar>
            <OutsourcingClientSwitcher
              clients={clients}
              value={clientId}
              onChange={setClientId}
              className={dashboardFilterSelectClass}
            />
          </DashboardTableToolbar>
        </div>
      ) : null}
      <Suspense
        fallback={<div className="py-12 text-center text-sm text-neutral-500">Loading employee leave…</div>}
      >
        <EmployeeLeavePanel />
      </Suspense>
    </DashboardPage>
  );
}

export default function OutsourcingLeavePage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading leave…</div>}>
      <OutsourcingLeaveContent />
    </Suspense>
  );
}
