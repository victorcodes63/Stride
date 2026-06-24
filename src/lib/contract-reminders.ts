import type { ContractReminderKind, Prisma } from '@prisma/client';
import {
  addCalendarMonthsYmd,
  daysBetweenYmd,
  nairobiYmd,
  prismaDateToYmd,
} from '@/lib/nairobi-calendar';
import { sendNotification } from '@/lib/notifications';

const SCHEDULER_KEY = 'contract-reminders';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function milestoneLabel(kind: ContractReminderKind): string {
  switch (kind) {
    case 'two_months':
      return '2 months before expiry';
    case 'one_month':
      return '1 month before expiry';
    case 'fourteen_days':
      return '14 days before expiry';
    case 'seven_days':
      return '7 days before expiry';
    case 'expiry_day':
      return 'expiry day';
    case 'expired_weekly':
      return 'expired (weekly reminder)';
    default:
      return 'contract reminder';
  }
}

function contractTitle(contract: { title: string | null; reference: string | null }) {
  return contract.title?.trim() || contract.reference?.trim() || 'Contract';
}

async function milestoneAlreadySent(
  db: Prisma.TransactionClient,
  contractId: string,
  kind: ContractReminderKind,
) {
  const row = await db.contractReminderSent.findFirst({
    where: { contractId, kind },
    select: { id: true },
  });
  return !!row;
}

async function notifyManagers(
  params: {
    contractId: string;
    userIds: string[];
    title: string;
    body: string;
    href: string;
    kind: ContractReminderKind;
  },
) {
  const priority = params.kind === 'seven_days' || params.kind === 'expiry_day' ? 'urgent' : 'info';
  const channel = params.kind === 'seven_days' || params.kind === 'expiry_day' ? 'both' : 'in_app';
  await sendNotification({
    event: 'contract_expiring',
    recipientUserIds: params.userIds,
    title: params.title,
    body: params.body,
    href: params.href,
    priority,
    channel,
    metadata: {
      contractId: params.contractId,
      kind: params.kind,
    },
  });
}

/** Returns counts for observability. Caller runs once per Nairobi calendar day (scheduler lock). */
export async function runContractReminders(
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

  const contracts = await db.accountsContract.findMany({
    where: { remindersDisabled: false },
    include: {
      client: { select: { name: true } },
      managers: { select: { userId: true } },
    },
  });

  for (const c of contracts) {
    const endYmd = prismaDateToYmd(c.endDate);
    const managerIds = [...new Set(c.managers.map((m) => m.userId))];
    const label = contractTitle(c);
    const clientName = c.client.name;
    const href = `/dashboard/people/contracts/${c.id}`;
    const endDisplay = endYmd;

    if (managerIds.length === 0) continue;

    if (today > endYmd) {
      const latest = await db.contractReminderSent.findFirst({
        where: { contractId: c.id, kind: 'expired_weekly' },
        orderBy: { sentAt: 'desc' },
      });
      if (latest && now.getTime() - latest.sentAt.getTime() < WEEK_MS) continue;

      const body = `${label} (${clientName}) ended on ${endDisplay}. Follow up or turn off reminders on the contract.`;
      await notifyManagers({
        contractId: c.id,
        userIds: managerIds,
        title: `Expired contract — ${clientName}`,
        body,
        href,
        kind: 'expired_weekly',
      });
      await db.contractReminderSent.create({
        data: { contractId: c.id, kind: 'expired_weekly' },
      });
      weekly += 1;
      continue;
    }

    const milestoneChecks: { kind: ContractReminderKind; match: boolean }[] = [
      {
        kind: 'two_months',
        match: today === addCalendarMonthsYmd(endYmd, -2),
      },
      {
        kind: 'one_month',
        match: today === addCalendarMonthsYmd(endYmd, -1),
      },
      {
        kind: 'fourteen_days',
        match: daysBetweenYmd(today, endYmd) === 14,
      },
      { kind: 'seven_days', match: daysBetweenYmd(today, endYmd) === 7 },
      { kind: 'expiry_day', match: today === endYmd },
    ];

    for (const { kind, match } of milestoneChecks) {
      if (!match) continue;
      if (await milestoneAlreadySent(db, c.id, kind)) continue;

      const body = `${label} for ${clientName} — ${milestoneLabel(kind)} (ends ${endDisplay}).`;
      await notifyManagers({
        contractId: c.id,
        userIds: managerIds,
        title: `Contract reminder — ${clientName}`,
        body,
        href,
        kind,
      });
      await db.contractReminderSent.create({
        data: { contractId: c.id, kind },
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

