import {
  attentionItem,
  moduleOn,
  type AttentionContributor,
  type OverviewAttentionItem,
} from '@/lib/dashboard-attention/types';

/** HR & Payroll — leave, attendance, onboarding. */
export const hrPayrollAttentionContributor: AttentionContributor = {
  domainId: 'hr-payroll',
  contribute(ctx) {
    const items: OverviewAttentionItem[] = [];

    if (moduleOn(ctx, 'leave') && ctx.pendingLeave > 0 && ctx.persona !== 'viewer') {
      items.push(
        attentionItem('hr-payroll', {
          id: 'leave',
          label: 'Leave approvals',
          detail: `${ctx.pendingLeave} request${ctx.pendingLeave === 1 ? '' : 's'} awaiting action`,
          href: '/dashboard/staff-leave?tab=approvals',
          tone: 'amber',
        }),
      );
    }

    if (moduleOn(ctx, 'time') && ctx.openAttendanceExceptions > 0) {
      items.push(
        attentionItem('hr-payroll', {
          id: 'attendance',
          label: 'Attendance exceptions',
          detail: `${ctx.openAttendanceExceptions} open — review clock data`,
          href: '/dashboard/attendance?status=open',
          tone: 'rose',
        }),
      );
    }

    if (moduleOn(ctx, 'core') && ctx.myOnboardingCount > 0) {
      items.push(
        attentionItem('hr-payroll', {
          id: 'onboarding',
          label: 'Onboarding tasks',
          detail: `${ctx.myOnboardingCount} assigned to you`,
          href: '/dashboard/onboarding?status=IN_PROGRESS',
          tone: 'sky',
        }),
      );
    }

    return items;
  },
};
