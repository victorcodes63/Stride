import type { CredentialReminderKind, Prisma } from '@prisma/client';
import { daysBetweenYmd, nairobiYmd, prismaDateToYmd } from '@/lib/nairobi-calendar';
import { createWorkflowRun, getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';

const SCHEDULER_KEY = 'credential-reminders';

function kindForDays(daysUntilExpiry: number): CredentialReminderKind | null {
  if (daysUntilExpiry === 30) return 'days_30';
  if (daysUntilExpiry === 14) return 'days_14';
  if (daysUntilExpiry === 7) return 'days_7';
  if (daysUntilExpiry < 0) return 'overdue';
  return null;
}

function kindLabel(kind: CredentialReminderKind): string {
  switch (kind) {
    case 'days_30':
      return 'expires in 30 days';
    case 'days_14':
      return 'expires in 14 days';
    case 'days_7':
      return 'expires in 7 days';
    case 'overdue':
      return 'is overdue';
    default:
      return 'needs attention';
  }
}

async function notifyUsers(
  db: Prisma.TransactionClient,
  params: {
    users: { id: string }[];
    title: string;
    body: string;
    href: string;
    credentialId: string;
    employeeId: string;
    kind: CredentialReminderKind;
    sentOnYmd: string;
  }
) {
  let workflowRunId: string | null = null;
  if (params.kind === 'overdue') {
    const existingRun = await db.workflowRun.findFirst({
      where: {
        module: 'credentials',
        entityType: 'EmployeeCredential',
        entityId: params.credentialId,
        status: { in: ['pending', 'in_progress', 'delegated', 'escalated'] },
      },
      select: { id: true },
    });
    workflowRunId = existingRun?.id ?? null;
    if (!workflowRunId) {
      const run = await createWorkflowRun({
        module: 'credentials',
        event: 'credential_expired',
        entityType: 'EmployeeCredential',
        entityId: params.credentialId,
        assigneeUserId: params.users[0]?.id ?? null,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: { kind: params.kind, employeeId: params.employeeId },
      });
      workflowRunId = run.id;
    }
  }
  for (const user of params.users) {
    const existing = await db.credentialReminderSent.findUnique({
      where: {
        credentialId_userId_kind_sentOnYmd: {
          credentialId: params.credentialId,
          userId: user.id,
          kind: params.kind,
          sentOnYmd: params.sentOnYmd,
        },
      },
      select: { id: true },
    });
    if (existing) continue;

    await db.credentialReminderSent.create({
      data: {
        credentialId: params.credentialId,
        userId: user.id,
        kind: params.kind,
        sentOnYmd: params.sentOnYmd,
      },
    });

    const recipientEssPortalUserIds: string[] = [];
    if (params.kind === 'days_7' || params.kind === 'overdue') {
      const essId = await getEssPortalUserIdForEmployee(params.employeeId);
      if (essId) recipientEssPortalUserIds.push(essId);
    }
    await sendNotification({
      event: params.kind === 'overdue' ? 'credential_expired' : 'credential_expiring',
      recipientUserIds: [user.id],
      recipientEssPortalUserIds,
      title: params.title,
      body: params.body,
      href: params.href,
      priority: params.kind === 'overdue' || params.kind === 'days_7' ? 'urgent' : 'info',
      channel: params.kind === 'overdue' || params.kind === 'days_7' ? 'both' : 'in_app',
      workflowRunId: workflowRunId ?? undefined,
      metadata: { credentialId: params.credentialId, kind: params.kind },
    });
  }
}

export async function runCredentialReminders(
  db: Prisma.TransactionClient,
  options?: { now?: Date }
): Promise<{ sent: number; lockSkipped: boolean }> {
  const now = options?.now ?? new Date();
  const today = nairobiYmd(now);

  const lock = await db.schedulerLock.findUnique({ where: { key: SCHEDULER_KEY } });
  if (lock && nairobiYmd(lock.lastRunAt) === today) {
    return { sent: 0, lockSkipped: true };
  }

  const users = await db.user.findMany({
    where: {
      isActive: true,
      role: { in: ['admin', 'staff'] },
    },
    select: { id: true },
  });

  if (users.length === 0) {
    await db.schedulerLock.upsert({
      where: { key: SCHEDULER_KEY },
      create: { key: SCHEDULER_KEY },
      update: { lastRunAt: now },
    });
    return { sent: 0, lockSkipped: false };
  }

  const credentials = await db.employeeCredential.findMany({
    where: { expiryDate: { not: null } },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, jobTitle: true, employeeNumber: true },
      },
    },
  });

  let sent = 0;
  for (const credential of credentials) {
    if (!credential.expiryDate) continue;
    const expiryYmd = prismaDateToYmd(credential.expiryDate);
    const daysToExpiry = daysBetweenYmd(today, expiryYmd);
    const kind = kindForDays(daysToExpiry);
    if (!kind) continue;

    const employeeName = `${credential.employee.firstName} ${credential.employee.lastName}`.trim();
    const title =
      kind === 'overdue'
        ? `Overdue credential — ${employeeName}`
        : `Credential reminder — ${employeeName}`;
    const body = `${credential.credentialName} (${credential.credentialNumber || 'no number'}) ${kindLabel(kind)}. Expiry date: ${expiryYmd}.`;

    await notifyUsers(db, {
      users,
      title,
      body,
      href: `/dashboard/credentials?employeeId=${credential.employee.id}`,
      credentialId: credential.id,
      employeeId: credential.employee.id,
      kind,
      sentOnYmd: today,
    });
    sent += users.length;
  }

  await db.schedulerLock.upsert({
    where: { key: SCHEDULER_KEY },
    create: { key: SCHEDULER_KEY },
    update: { lastRunAt: now },
  });

  return { sent, lockSkipped: false };
}
