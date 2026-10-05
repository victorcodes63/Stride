import type { Prisma } from '@prisma/client';
import type { ModuleKey } from '@/lib/modules';
import type { TenantContext } from '@/lib/tenant-api';
import { withOrgContext } from '@/lib/org-context';
import { OVERVIEW_READ_TX_TIMEOUT_MS } from '@/lib/dashboard-overview-metrics';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessTeamLeaveScope } from '@/lib/staff-api-auth';
import { getTeamLeaveMemberIds } from '@/lib/staff-leave-team';
import { listOrgStaffUserIds } from '@/lib/staff-time-attendance/staff-directory';
import { staffUserCanManageAttendance } from '@/lib/staff-time-attendance/attendance-access';
import { canAccessCredentials } from '@/lib/demo-route-access';
import { getRoleKeysForUser } from '@/lib/onboarding-workflows';
import {
  ATTENTION_QUEUE_CAP,
  sortWorkItems,
  summarizeWorkItems,
  type AttentionAction,
  type AttentionQueueId,
  type AttentionWorkItem,
} from '@/lib/dashboard-attention/work-items';

export type ExpandAttentionQueueInput = {
  modules: Partial<Record<ModuleKey, boolean>>;
  /** Optional filter: only one queue */
  queueId?: AttentionQueueId | null;
};

function on(modules: Partial<Record<ModuleKey, boolean>>, key: ModuleKey) {
  return modules[key] === true;
}

const APPROVE_REJECT: AttentionAction[] = [
  { id: 'approve', label: 'Approve', variant: 'primary' },
  { id: 'reject', label: 'Reject', variant: 'danger', requiresNote: true },
];

const RESOLVE_IGNORE: AttentionAction[] = [
  { id: 'resolve', label: 'Resolve', variant: 'primary' },
  { id: 'ignore', label: 'Ignore', variant: 'secondary', requiresNote: true },
];

/** Shared sales deal actions — order and labels stay identical across queues. */
const SALES_DEAL_ACTIONS: AttentionAction[] = [
  { id: 'nudge_close', label: 'Add 7 days', variant: 'primary' },
  { id: 'log_activity', label: 'Add note', variant: 'secondary', requiresNote: true },
];

function matchesQueue(filter: AttentionQueueId | null | undefined, id: AttentionQueueId) {
  return !filter || filter === id;
}

/**
 * Expand overview attention categories into concrete, actionable work items.
 */
export async function expandAttentionQueue(
  ctx: TenantContext,
  input: ExpandAttentionQueueInput,
): Promise<{
  items: AttentionWorkItem[];
  summary: ReturnType<typeof summarizeWorkItems>;
  hasMoreByQueue: Partial<Record<AttentionQueueId, boolean>>;
}> {
  const { modules, queueId } = input;
  const items: AttentionWorkItem[] = [];
  const hasMoreByQueue: Partial<Record<AttentionQueueId, boolean>> = {};
  const cap = ATTENTION_QUEUE_CAP;
  const viewerIsLeaveApprover = canAccessTeamLeaveScope(ctx.staff);
  const canManageAttendance = staffUserCanManageAttendance(ctx.staff);
  const canCreds = canAccessCredentials(ctx.staff);

  // Resolve leave scope outside the interactive tx — it uses a separate Prisma client
  // and would otherwise burn the transaction wall-clock.
  const leaveMemberIds =
    matchesQueue(queueId, 'leave') && on(modules, 'leave') && viewerIsLeaveApprover
      ? await getTeamLeaveMemberIds(ctx.staff)
      : [];

  await withOrgContext(
    ctx.organizationId,
    async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(
        tx,
        undefined,
        ctx.request,
        ctx.organizationId,
      );

      // ── Leave approvals ──────────────────────────────────────────────
      if (matchesQueue(queueId, 'leave') && on(modules, 'leave') && viewerIsLeaveApprover) {
        const rows = await tx.staffLeaveApplication.findMany({
          where: ctx.where({
            status: 'pending',
            OR: [
              { userId: { in: leaveMemberIds } },
              { approvalSteps: { some: { approverUserId: ctx.staff.id, status: 'pending' } } },
            ],
          }) as Prisma.StaffLeaveApplicationWhereInput,
          include: {
            leaveType: { select: { name: true } },
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue.leave = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          const who = row.user.name || row.user.email;
          const start = row.startDate.toISOString().slice(0, 10);
          const end = row.endDate.toISOString().slice(0, 10);
          items.push({
            id: `leave:${row.id}`,
            queueId: 'leave',
            domainId: 'hr-payroll',
            title: `${who} — ${row.leaveType.name}`,
            detail: `${start} → ${end} · ${row.totalDays} day${row.totalDays === 1 ? '' : 's'}`,
            tone: 'amber',
            href: `/dashboard/staff-leave?tab=approvals&id=${row.id}`,
            entityType: 'StaffLeaveApplication',
            entityId: row.id,
            actions: APPROVE_REJECT,
            meta: { employeeName: who, leaveType: row.leaveType.name, days: row.totalDays },
          });
        }
      }

      // ── Attendance exceptions ────────────────────────────────────────
      if (matchesQueue(queueId, 'attendance') && on(modules, 'time') && canManageAttendance) {
        const staffIds = await listOrgStaffUserIds(tx, ctx.organizationId);
        const rows = await tx.staffAttendanceException.findMany({
          where: ctx.where({
            userId: { in: staffIds },
            status: 'open',
          }) as unknown as Prisma.StaffAttendanceExceptionWhereInput,
          include: { user: { select: { name: true, email: true } } },
          orderBy: { workDate: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue.attendance = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          const who = row.user.name || row.user.email;
          items.push({
            id: `attendance:${row.id}`,
            queueId: 'attendance',
            domainId: 'hr-payroll',
            title: `Attendance — ${who}`,
            detail: `${row.workDate.toISOString().slice(0, 10)} · ${row.type}`,
            tone: 'rose',
            href: `/dashboard/attendance?status=open&exception=${row.id}`,
            entityType: 'StaffAttendanceException',
            entityId: row.id,
            actions: RESOLVE_IGNORE,
            meta: { employeeName: who, type: row.type },
          });
        }
      }

      // ── Onboarding tasks assigned to me ──────────────────────────────
      if (matchesQueue(queueId, 'onboarding') && on(modules, 'core')) {
        const roleKeys = getRoleKeysForUser(ctx.staff);
        const rows = await tx.onboardingTask.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
            OR: [{ assignedToId: ctx.staff.id }, { assignedRole: { in: roleKeys } }],
          },
          include: {
            employee: { select: { firstName: true, lastName: true } },
            workflow: { select: { title: true } },
          },
          orderBy: { dueDate: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue.onboarding = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          const emp = row.employee
            ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
            : 'Assignee';
          items.push({
            id: `onboarding:${row.id}`,
            queueId: 'onboarding',
            domainId: 'hr-payroll',
            title: row.title,
            detail: `${emp}${row.workflow?.title ? ` · ${row.workflow.title}` : ''}`,
            tone: 'sky',
            href: `/dashboard/onboarding?task=${row.id}`,
            entityType: 'OnboardingTask',
            entityId: row.id,
            actions: [{ id: 'complete', label: 'Complete', variant: 'primary' }],
            meta: { employeeName: emp },
          });
        }
      }

      // ── Unpaid invoices ──────────────────────────────────────────────
      if (matchesQueue(queueId, 'invoices') && on(modules, 'accounts')) {
        const rows = await tx.accountsInvoice.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ['unpaid', 'partial'] },
            accountsClient: { outsourcingClientId: clientId },
          },
          include: {
            accountsClient: { select: { id: true, name: true, currency: true } },
            lines: { select: { amountExVat: true } },
            allocations: { select: { amount: true } },
          },
          orderBy: { dueDate: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue.invoices = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          const subtotal = row.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
          const allocated = row.allocations.reduce((s, a) => s + Number(a.amount), 0);
          const amount = Math.max(
            0,
            Math.round((subtotal * (1 + row.vatRateBps / 10000) - allocated) * 100) / 100,
          );
          items.push({
            id: `invoices:${row.id}`,
            queueId: 'invoices',
            domainId: 'finance',
            title: `Invoice #${row.invoiceNumber}`,
            detail: `${row.accountsClient.name} · ${row.accountsClient.currency} ${amount.toLocaleString()} · due ${row.dueDate?.toISOString().slice(0, 10) ?? '—'}`,
            tone: 'amber',
            href: `/dashboard/accounts/invoices?status=unpaid&id=${row.id}`,
            entityType: 'AccountsInvoice',
            entityId: row.id,
            actions: [
              {
                id: 'record_payment',
                label: 'Record payment',
                variant: 'primary',
                requiresPayment: true,
              },
            ],
            meta: {
              clientId: row.accountsClient.id,
              clientName: row.accountsClient.name,
              currency: row.accountsClient.currency,
              amountDue: amount,
              invoiceNumber: row.invoiceNumber,
            },
          });
        }
      }

      // ── Vendor bills ─────────────────────────────────────────────────
      if (matchesQueue(queueId, 'vendor-bills') && on(modules, 'accounts')) {
        const rows = await tx.accountsVendorBill.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ['unpaid', 'partial'] },
          },
          include: {
            vendor: { select: { id: true, name: true, currency: true } },
            lines: { select: { amountExVat: true } },
            allocations: { select: { amount: true } },
          },
          orderBy: { dueDate: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue['vendor-bills'] = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          const subtotal = row.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
          const allocated = row.allocations.reduce((s, a) => s + Number(a.amount), 0);
          const amount = Math.max(
            0,
            Math.round((subtotal * (1 + row.vatRateBps / 10000) - allocated) * 100) / 100,
          );
          items.push({
            id: `vendor-bills:${row.id}`,
            queueId: 'vendor-bills',
            domainId: 'procurement',
            title: `Vendor bill ${row.billRef ?? row.id.slice(0, 8)}`,
            detail: `${row.vendor.name} · ${row.vendor.currency} ${amount.toLocaleString()}`,
            tone: 'amber',
            href: `/dashboard/accounts/vendor-bills?status=unpaid&id=${row.id}`,
            entityType: 'AccountsVendorBill',
            entityId: row.id,
            actions: [
              {
                id: 'record_payment',
                label: 'Record payment',
                variant: 'primary',
                requiresPayment: true,
              },
            ],
            meta: {
              vendorId: row.vendor.id,
              vendorName: row.vendor.name,
              currency: row.vendor.currency,
              amountDue: amount,
            },
          });
        }
      }

      // ── Purchase requests ────────────────────────────────────────────
      if (matchesQueue(queueId, 'purchase-requests') && on(modules, 'core')) {
        const rows = await tx.purchaseRequest.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'submitted',
            outsourcingClientId: clientId,
          },
          include: {
            requestedBy: { select: { name: true } },
            vendor: { select: { name: true } },
          },
          orderBy: { submittedAt: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue['purchase-requests'] = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          items.push({
            id: `purchase-requests:${row.id}`,
            queueId: 'purchase-requests',
            domainId: 'procurement',
            title: row.title || row.requestNumber,
            detail: `${row.requestedBy?.name ?? 'Requester'}${row.vendor ? ` · ${row.vendor.name}` : ' · no vendor'} · ${row.currency} ${Number(row.totalAmount).toLocaleString()}`,
            tone: 'amber',
            href: `/dashboard/procurement/purchase-requests?status=submitted&id=${row.id}`,
            entityType: 'PurchaseRequest',
            entityId: row.id,
            actions: APPROVE_REJECT,
            meta: { hasVendor: Boolean(row.vendor), requestNumber: row.requestNumber },
          });
        }
      }

      // ── Fleet incidents ──────────────────────────────────────────────
      if (matchesQueue(queueId, 'fleet-incidents') && on(modules, 'fleet')) {
        const rows = await tx.fleetIncident.findMany({
          where: {
            outsourcingClientId: clientId,
            status: { in: ['open', 'investigating'] },
          },
          orderBy: { createdAt: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue['fleet-incidents'] = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          items.push({
            id: `fleet-incidents:${row.id}`,
            queueId: 'fleet-incidents',
            domainId: 'fleet-logistics',
            title: row.title,
            detail: `${row.incidentType} · ${row.severity} · ${row.status}`,
            tone: 'rose',
            href: `/dashboard/fleet/compliance?incident=${row.id}`,
            entityType: 'FleetIncident',
            entityId: row.id,
            actions: [
              { id: 'resolve', label: 'Resolve', variant: 'primary', requiresNote: true },
            ],
            meta: { severity: row.severity, status: row.status },
          });
        }
      }

      // ── Sales past-due + stalled ─────────────────────────────────────
      if (on(modules, 'sales')) {
        const openStages = ['lead', 'qualified', 'proposal', 'negotiation'] as const;
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const stalledBefore = new Date(Date.now() - 14 * 86400000);

        if (matchesQueue(queueId, 'sales-past-due')) {
          const rows = await tx.salesDeal.findMany({
            where: {
              organizationId: ctx.organizationId,
              stage: { in: [...openStages] },
              expectedCloseDate: { lt: today },
            },
            include: { accountsClient: { select: { name: true } } },
            orderBy: { expectedCloseDate: 'asc' },
            take: cap + 1,
          });
          hasMoreByQueue['sales-past-due'] = rows.length > cap;
          for (const row of rows.slice(0, cap)) {
            items.push({
              id: `sales-past-due:${row.id}`,
              queueId: 'sales-past-due',
              domainId: 'sales',
              title: row.name,
              detail: `${row.accountsClient?.name ?? 'Account'} · close was ${row.expectedCloseDate?.toISOString().slice(0, 10) ?? '—'} · ${row.stage}`,
              tone: 'rose',
              href: `/dashboard/sales/deals?id=${row.id}`,
              entityType: 'SalesDeal',
              entityId: row.id,
            actions: SALES_DEAL_ACTIONS,
            meta: { stage: row.stage, value: Number(row.value) },
          });
        }
      }

      if (matchesQueue(queueId, 'sales-stalled')) {
        const rows = await tx.salesDeal.findMany({
          where: {
            organizationId: ctx.organizationId,
            stage: { in: [...openStages] },
            updatedAt: { lt: stalledBefore },
          },
          include: { accountsClient: { select: { name: true } } },
          orderBy: { updatedAt: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue['sales-stalled'] = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          items.push({
            id: `sales-stalled:${row.id}`,
            queueId: 'sales-stalled',
            domainId: 'sales',
            title: row.name,
            detail: `${row.accountsClient?.name ?? 'Account'} · idle since ${row.updatedAt.toISOString().slice(0, 10)} · ${row.stage}`,
            tone: 'amber',
            href: `/dashboard/sales/deals?id=${row.id}`,
            entityType: 'SalesDeal',
            entityId: row.id,
            actions: SALES_DEAL_ACTIONS,
            meta: { stage: row.stage, value: Number(row.value) },
          });
        }
      }
      }

      // ── Credentials ──────────────────────────────────────────────────
      if (matchesQueue(queueId, 'credentials') && on(modules, 'core') && canCreds) {
        const now = new Date();
        const horizon = new Date(now.getTime() + 30 * 86400000);
        const rows = await tx.employeeCredential.findMany({
          where: {
            OR: [
              { status: 'expired' },
              { status: 'expiring_soon' },
              { expiryDate: { lt: horizon } },
            ],
            employee: { outsourcingClientId: clientId },
          },
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
          orderBy: { expiryDate: 'asc' },
          take: cap + 1,
        });
        hasMoreByQueue.credentials = rows.length > cap;
        for (const row of rows.slice(0, cap)) {
          const emp = `${row.employee.firstName} ${row.employee.lastName}`.trim();
          const expired =
            row.status === 'expired' ||
            (row.expiryDate != null && row.expiryDate.getTime() < now.getTime());
          items.push({
            id: `credentials:${row.id}`,
            queueId: 'credentials',
            domainId: 'legal-documents',
            title: row.credentialName,
            detail: `${emp} · ${expired ? 'expired' : 'expiring'} ${row.expiryDate?.toISOString().slice(0, 10) ?? ''}`,
            tone: expired ? 'rose' : 'amber',
            href: `/dashboard/credentials?status=${expired ? 'expired' : 'expiring_soon'}&id=${row.id}`,
            entityType: 'EmployeeCredential',
            entityId: row.id,
            actions: [
              { id: 'mark_renewed', label: 'Renewed', variant: 'primary' },
              { id: 'acknowledge', label: 'Noted', variant: 'secondary' },
            ],
            meta: { employeeName: emp, expired },
          });
        }
      }
    },
    { timeout: OVERVIEW_READ_TX_TIMEOUT_MS },
  );

  const sorted = sortWorkItems(items);
  return {
    items: sorted,
    summary: summarizeWorkItems(sorted),
    hasMoreByQueue,
  };
}
