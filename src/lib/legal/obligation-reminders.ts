import type { LegalObligationReminderKind, Prisma } from '@prisma/client';
import { daysBetweenYmd, nairobiYmd, prismaDateToYmd } from '@/lib/nairobi-calendar';
import { sendNotification } from '@/lib/notifications';

const SCHEDULER_KEY = 'legal-obligation-reminders';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HREF = '/dashboard/legal/obligations';

function milestoneLabel(kind: LegalObligationReminderKind): string {
  switch (kind) {
    case 'days_60':
      return '60 days before due';
    case 'days_30':
      return '30 days before due';
    case 'days_14':
      return '14 days before due';
    case 'days_7':
      return '7 days before due';
    case 'due_day':
      return 'due today';
    case 'overdue_weekly':
      return 'overdue (weekly reminder)';
    default:
      return 'obligation reminder';
  }
}

async function milestoneAlreadySent(
  db: Prisma.TransactionClient,
  obligationId: string,
  kind: LegalObligationReminderKind,
) {
  const row = await db.legalObligationReminderSent.findFirst({
    where: { obligationId, kind },
    select: { id: true },
  });
  return !!row;
}

async function notifyOwners(params: {
  obligationId: string;
  userIds: string[];
  title: string;
  body: string;
  kind: LegalObligationReminderKind;
}) {
  const urgent =
    params.kind === 'days_7' || params.kind === 'due_day' || params.kind === 'overdue_weekly';
  const priority = urgent ? 'urgent' : 'info';
  const channel = urgent ? 'both' : 'in_app';
  await sendNotification({
    event: 'legal_obligation_due',
    recipientUserIds: params.userIds,
    title: params.title,
    body: params.body,
    href: HREF,
    priority,
    channel,
    metadata: { obligationId: params.obligationId, kind: params.kind },
  });
}

/** Returns counts for observability. Caller runs once per Nairobi calendar day (scheduler lock). */
export async function runObligationReminders(
  db: Prisma.TransactionClient,
  options?: { now?: Date },
): Promise<{ milestones: number; weekly: number; lockSkipped: boolean }> {
  const now = options?.now ?? new Date();
  const today = nairobiYmd(now);

  const lock = await db.schedulerLock.findUnique({ where: { key: SCHEDULER_KEY } });
  if (lock && nairobiYmd(lock.lastRunAt) === today) {
    return { milestones: 0, weekly: 0, lockSkipped: true };
  }

  let milestones = 0;
  let weekly = 0;

  // Org-scoped admins (avoids cross-tenant notifications that a global role lookup would cause).
  const adminMemberships = await db.organizationMembership.findMany({
    where: { status: 'active', role: 'admin' },
    select: { organizationId: true, userId: true },
  });
  const adminsByOrg = new Map<string, string[]>();
  for (const m of adminMemberships) {
    const list = adminsByOrg.get(m.organizationId) ?? [];
    list.push(m.userId);
    adminsByOrg.set(m.organizationId, list);
  }

  const obligations = await db.legalObligation.findMany({
    where: { status: 'pending' },
    select: {
      id: true,
      organizationId: true,
      title: true,
      regulator: true,
      dueDate: true,
      ownerUserId: true,
    },
  });

  for (const o of obligations) {
    const dueYmd = prismaDateToYmd(o.dueDate);
    const orgAdmins = adminsByOrg.get(o.organizationId) ?? [];
    const recipientIds = [...new Set([...(o.ownerUserId ? [o.ownerUserId] : []), ...orgAdmins])];
    if (recipientIds.length === 0) continue;

    const label = o.title.trim() || 'Compliance obligation';
    const scope = o.regulator?.trim() ? ` (${o.regulator.trim()})` : '';

    if (today > dueYmd) {
      const latest = await db.legalObligationReminderSent.findFirst({
        where: { obligationId: o.id, kind: 'overdue_weekly' },
        orderBy: { sentAt: 'desc' },
      });
      if (latest && now.getTime() - latest.sentAt.getTime() < WEEK_MS) continue;

      await notifyOwners({
        obligationId: o.id,
        userIds: recipientIds,
        title: `Overdue obligation — ${label}`,
        body: `${label}${scope} was due on ${dueYmd}. Complete it or record a waiver.`,
        kind: 'overdue_weekly',
      });
      await db.legalObligationReminderSent.create({
        data: {
          organizationId: o.organizationId,
          obligationId: o.id,
          kind: 'overdue_weekly',
          sentOnYmd: today,
        },
      });
      weekly += 1;
      continue;
    }

    const milestoneChecks: { kind: LegalObligationReminderKind; match: boolean }[] = [
      { kind: 'days_60', match: daysBetweenYmd(today, dueYmd) === 60 },
      { kind: 'days_30', match: daysBetweenYmd(today, dueYmd) === 30 },
      { kind: 'days_14', match: daysBetweenYmd(today, dueYmd) === 14 },
      { kind: 'days_7', match: daysBetweenYmd(today, dueYmd) === 7 },
      { kind: 'due_day', match: today === dueYmd },
    ];

    for (const { kind, match } of milestoneChecks) {
      if (!match) continue;
      if (await milestoneAlreadySent(db, o.id, kind)) continue;

      await notifyOwners({
        obligationId: o.id,
        userIds: recipientIds,
        title: `Obligation reminder — ${label}`,
        body: `${label}${scope} — ${milestoneLabel(kind)} (due ${dueYmd}).`,
        kind,
      });
      await db.legalObligationReminderSent.create({
        data: {
          organizationId: o.organizationId,
          obligationId: o.id,
          kind,
          sentOnYmd: today,
        },
      });
      milestones += 1;
    }
  }

  await db.schedulerLock.upsert({
    where: { key: SCHEDULER_KEY },
    create: { key: SCHEDULER_KEY },
    update: { lastRunAt: now },
  });

  return { milestones, weekly, lockSkipped: false };
}
