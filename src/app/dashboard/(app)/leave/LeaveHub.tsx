'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarOff, Users } from 'lucide-react';

import { EmployeeLeavePanel } from '@/components/dashboard/leave/EmployeeLeavePanel';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTableToolbar } from '@/components/dashboard/DashboardDataTable';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';

function LeaveHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient();
  const audience = searchParams.get('audience') === 'staff' ? 'staff' : 'employees';

  useEffect(() => {
    if (audience === 'staff') {
      router.replace('/dashboard/staff-leave');
    }
  }, [audience, router]);

  function setAudience(next: string) {
    if (next === 'staff') {
      router.push('/dashboard/staff-leave');
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('audience', 'employees');
    router.push(`/dashboard/leave?${params.toString()}`);
  }

  if (audience === 'staff') {
    return (
      <DashboardPage>
        <div className="py-16 text-center text-sm text-neutral-500">Opening staff leave…</div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={CalendarOff}
        title="Leave"
        description="Workforce leave — approval queue, team calendar, accrual balances, and liability."
        footer={
          <DashboardTabs
            embedded
            value={audience}
            onChange={setAudience}
            items={[
              { value: 'employees', label: 'Employees', icon: Users },
              { value: 'staff', label: 'Staff', icon: CalendarOff },
            ]}
          />
        }
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
      <Suspense fallback={<div className="py-12 text-center text-sm text-neutral-500">Loading employee leave…</div>}>
        <EmployeeLeavePanel />
      </Suspense>
    </DashboardPage>
  );
}

export default function LeaveHubPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading leave…</div>}>
      <LeaveHubContent />
    </Suspense>
  );
}

export function LeaveAudienceTabs({ active }: { active: 'employees' | 'staff' }) {
  return (
    <DashboardTabs
      embedded
      value={active}
      onChange={(next) => {
        if (typeof window === 'undefined') return;
        if (next === 'staff') window.location.href = '/dashboard/staff-leave';
        else window.location.href = '/dashboard/leave?audience=employees';
      }}
      items={[
        { value: 'employees', label: 'Employees', icon: Users },
        { value: 'staff', label: 'Staff', icon: CalendarOff },
      ]}
    />
  );
}
