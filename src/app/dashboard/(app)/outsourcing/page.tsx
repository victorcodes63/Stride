'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, CalendarOff, Clock4, Handshake, Shield, Users } from 'lucide-react';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';

type Overview = {
  endClients: { total: number; active: number };
  workforce: { total: number; active: number };
  leave: { pendingApprovals: number; onLeaveToday: number };
  payroll: { runsThisMonth: number; month: number; year: number };
};

export default function OutsourcingOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/outsourcing/overview');
        const json = (await res.json()) as Overview & { error?: string };
        if (!res.ok) throw new Error(json.error || 'Unable to load outsourcing overview.');
        if (!cancelled) setOverview(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load outsourcing overview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        title="BPO operations overview"
        description="Manage end clients, outsourced workforce, and per-client payroll, attendance, leave, and disciplinary from one module."
        actions={[
          { href: '/dashboard/outsourcing/clients/new', label: 'Add end client', icon: Building2 },
          { href: '/dashboard/outsourcing/employees', label: 'Workforce', icon: Users, variant: 'secondary' },
        ]}
      />

      <DashboardAsyncState
        status={listStatus}
        error={error}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        {overview ? (
          <>
            <DashboardStatGrid>
              <DashboardStatCard
                label="End clients"
                value={overview.endClients.total}
                hint={`${overview.endClients.active} active`}
                icon={Handshake}
              />
              <DashboardStatCard
                label="Outsourced workforce"
                value={overview.workforce.total}
                hint={`${overview.workforce.active} active`}
                icon={Users}
              />
              <DashboardStatCard
                label="On leave today"
                value={overview.leave.onLeaveToday}
                icon={CalendarOff}
              />
              <DashboardStatCard
                label="Pending leave approvals"
                value={overview.leave.pendingApprovals}
                icon={CalendarOff}
                tone={overview.leave.pendingApprovals > 0 ? 'warning' : 'primary'}
              />
              <DashboardStatCard
                label="Payroll lines this month"
                value={overview.payroll.runsThisMonth}
                hint={`${overview.payroll.month}/${overview.payroll.year}`}
                icon={Clock4}
              />
            </DashboardStatGrid>

            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link href="/dashboard/outsourcing/clients" className="font-medium text-primary-600 hover:underline">
                End-client register
              </Link>
              <Link href="/dashboard/outsourcing/employees" className="font-medium text-primary-600 hover:underline">
                Workforce
              </Link>
              <Link href="/dashboard/outsourcing/payroll" className="font-medium text-primary-600 hover:underline">
                Client payroll
              </Link>
              <Link href="/dashboard/outsourcing/attendance" className="font-medium text-primary-600 hover:underline">
                Time & attendance
              </Link>
              <Link href="/dashboard/outsourcing/leave" className="font-medium text-primary-600 hover:underline">
                Leave
              </Link>
              <Link href="/dashboard/outsourcing/disciplinary" className="font-medium text-primary-600 hover:underline">
                Disciplinary
              </Link>
            </div>
          </>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
