import type { Prisma } from '@prisma/client';

/**
 * Multi-step approval chains for internal-staff leave.
 *
 * We cannot add schema columns, so the chain is derived from the existing
 * org graph (User.leaveApproverId, User.department, User.role/staffUserType)
 * following a sensible, configurable default policy:
 *
 *   1. Direct manager      — the applicant's `leaveApproverId`
 *   2. Department head     — a business_manager/director in the same department
 *   3. HR / admin sign-off — an organization admin (falls back to a manager)
 *
 * Stages that resolve to the same person, or to nobody, are collapsed, so a
 * small org naturally ends up with a single approval step and behaviour is
 * backward-compatible with the previous single-step implementation.
 */

export type ApprovalStageKind = 'manager' | 'department_head' | 'hr_admin';

export const DEFAULT_STAFF_LEAVE_APPROVAL_STAGES: ApprovalStageKind[] = [
  'manager',
  'department_head',
  'hr_admin',
];

export const APPROVAL_STAGE_LABELS: Record<ApprovalStageKind, string> = {
  manager: 'Direct manager',
  department_head: 'Department head',
  hr_admin: 'HR / admin',
};

export type ResolvedApprovalStage = {
  order: number;
  kind: ApprovalStageKind;
  approverUserId: string;
  approverName: string;
};

type ApproverRow = { id: string; name: string };

/**
 * Resolve the ordered approver chain for a leave application. Returns an empty
 * array when the leave type needs no approval (auto-approved path).
 */
export async function resolveStaffLeaveApprovalChain(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    applicantId: string;
    requiresApproval: boolean;
    stages?: ApprovalStageKind[];
  },
): Promise<ResolvedApprovalStage[]> {
  if (!input.requiresApproval) return [];

  const stages = input.stages ?? DEFAULT_STAFF_LEAVE_APPROVAL_STAGES;

  const applicant = await tx.user.findUnique({
    where: { id: input.applicantId },
    select: { id: true, leaveApproverId: true, department: true },
  });

  const resolved: Array<{ kind: ApprovalStageKind; approver: ApproverRow }> = [];
  const seen = new Set<string>([input.applicantId]);

  const pushIf = (kind: ApprovalStageKind, approver: ApproverRow | null | undefined) => {
    if (!approver || seen.has(approver.id)) return;
    seen.add(approver.id);
    resolved.push({ kind, approver });
  };

  for (const kind of stages) {
    if (kind === 'manager') {
      if (applicant?.leaveApproverId && !seen.has(applicant.leaveApproverId)) {
        const manager = await tx.user.findFirst({
          where: { id: applicant.leaveApproverId, isActive: true } as Prisma.UserWhereInput,
          select: { id: true, name: true },
        });
        pushIf('manager', manager);
      }
    } else if (kind === 'department_head') {
      const department = applicant?.department?.trim();
      if (department) {
        const head = await tx.user.findFirst({
          where: {
            isActive: true,
            department,
            id: { notIn: Array.from(seen) },
            OR: [{ staffUserType: 'business_manager' }, { staffUserType: 'director' }],
          } as Prisma.UserWhereInput,
          orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
          select: { id: true, name: true },
        });
        pushIf('department_head', head);
      }
    } else if (kind === 'hr_admin') {
      const admin = await tx.user.findFirst({
        where: {
          isActive: true,
          id: { notIn: Array.from(seen) },
          OR: [{ role: 'admin' }, { staffUserType: 'business_manager' }],
        } as Prisma.UserWhereInput,
        orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, name: true },
      });
      pushIf('hr_admin', admin);
    }
  }

  // Fallback: an approval-required type must have at least one approver, so
  // fall back to any admin / business manager (previous default behaviour).
  if (resolved.length === 0) {
    const fallback = await tx.user.findFirst({
      where: {
        isActive: true,
        id: { not: input.applicantId },
        OR: [{ role: 'admin' }, { staffUserType: 'business_manager' }],
      } as Prisma.UserWhereInput,
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    });
    pushIf('hr_admin', fallback);
  }

  return resolved.map((entry, index) => ({
    order: index + 1,
    kind: entry.kind,
    approverUserId: entry.approver.id,
    approverName: entry.approver.name,
  }));
}
