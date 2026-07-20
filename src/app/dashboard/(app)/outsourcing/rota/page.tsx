'use client';

import { Suspense } from 'react';
import { CalendarClock } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTableToolbar } from '@/components/dashboard/DashboardDataTable';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { DashboardEmptyState } from '@/components/dashboard/DashboardAsyncState';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { OutsourcingRotaPlanner } from '@/components/outsourcing/rota/OutsourcingRotaPlanner';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';

function OutsourcingRotaContent() {
  const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient();

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        icon={CalendarClock}
        title="Client rota"
        description="Plan shifts for the selected end-client's outsourced workforce."
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

      {clientId ? (
        <OutsourcingRotaPlanner key={clientId} clientId={clientId} />
      ) : (
        <DashboardEmptyState
          icon={CalendarClock}
          title="Select an end-client"
          description="Choose an end-client above to plan and view its outsourced workforce rota."
        />
      )}
    </DashboardPage>
  );
}

export default function OutsourcingRotaPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-neutral-500">Loading rota…</div>
      }
    >
      <OutsourcingRotaContent />
    </Suspense>
  );
}
