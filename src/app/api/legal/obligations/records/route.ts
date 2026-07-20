import { NextRequest, NextResponse } from 'next/server';
import type { LegalObligationCategory, LegalObligationPriority, LegalObligationStatus, Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

const CATEGORIES = new Set<LegalObligationCategory>([
  'filing',
  'permit',
  'licence',
  'board',
  'regulator',
  'insurance',
  'other',
]);
const STATUSES = new Set<LegalObligationStatus>(['pending', 'completed', 'waived']);
const PRIORITIES = new Set<LegalObligationPriority>(['low', 'medium', 'high', 'critical']);
const SORT_KEYS = new Set(['dueDate', 'priority', 'title', 'status']);

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DUE_SOON_DAYS = 60;

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseInt0(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

type ObligationRow = {
  id: string;
  title: string;
  description: string | null;
  category: LegalObligationCategory;
  priority: LegalObligationPriority;
  dueDate: Date;
  status: LegalObligationStatus;
  regulator: string | null;
  reminderDays: number;
  recurrenceMonths: number | null;
  completedAt: Date | null;
  waivedReason: string | null;
  evidencePath: string | null;
  evidenceFileName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; name: string; email: string } | null;
};

export function toRecord(row: ObligationRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    dueDate: row.dueDate.toISOString().slice(0, 10),
    status: row.status,
    regulator: row.regulator,
    reminderDays: row.reminderDays,
    recurrenceMonths: row.recurrenceMonths,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    waivedReason: row.waivedReason,
    evidencePath: row.evidencePath,
    evidenceFileName: row.evidenceFileName,
    notes: row.notes,
    owner: row.owner
      ? { id: row.owner.id, name: row.owner.name, email: row.owner.email }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const sp = request.nextUrl.searchParams;
      const status = sp.get('status')?.trim();
      const category = sp.get('category')?.trim();
      const priority = sp.get('priority')?.trim();
      const ownerUserId = sp.get('ownerUserId')?.trim();
      const q = sp.get('q')?.trim();
      const dueBefore = parseDate(sp.get('dueBefore'));
      const dueAfter = parseDate(sp.get('dueAfter'));
      const sort = sp.get('sort')?.trim();
      const dir = sp.get('dir')?.trim() === 'desc' ? 'desc' : 'asc';
      const page = Math.max(1, parseInt0(sp.get('page')) ?? 1);
      const pageSizeRaw = parseInt0(sp.get('pageSize')) ?? DEFAULT_PAGE_SIZE;
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));

      const dueFilter: Prisma.DateTimeFilter = {};
      if (dueAfter) dueFilter.gte = dueAfter;
      if (dueBefore) dueFilter.lte = dueBefore;

      const where: Prisma.LegalObligationWhereInput = {
        ...ctx.where(),
        ...(status && STATUSES.has(status as LegalObligationStatus)
          ? { status: status as LegalObligationStatus }
          : {}),
        ...(category && CATEGORIES.has(category as LegalObligationCategory)
          ? { category: category as LegalObligationCategory }
          : {}),
        ...(priority && PRIORITIES.has(priority as LegalObligationPriority)
          ? { priority: priority as LegalObligationPriority }
          : {}),
        ...(ownerUserId ? { ownerUserId } : {}),
        ...(Object.keys(dueFilter).length ? { dueDate: dueFilter } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { regulator: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const orderBy: Prisma.LegalObligationOrderByWithRelationInput[] =
        sort && SORT_KEYS.has(sort)
          ? [{ [sort]: dir } as Prisma.LegalObligationOrderByWithRelationInput, { title: 'asc' }]
          : [{ dueDate: 'asc' }, { title: 'asc' }];

      const { rows, total, owners, summaryRows } = await ctx.run(async (tx) => {
        const [rows, total, memberships, summaryRows] = await Promise.all([
          tx.legalObligation.findMany({
            where,
            include: { owner: { select: { id: true, name: true, email: true } } },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          tx.legalObligation.count({ where }),
          tx.organizationMembership.findMany({
            where: { organizationId: ctx.organizationId, status: 'active' },
            select: { user: { select: { id: true, name: true, email: true } } },
          }),
          tx.legalObligation.findMany({
            where: ctx.where(),
            select: { status: true, dueDate: true },
          }),
        ]);
        const owners = memberships
          .map((m) => m.user)
          .filter((u): u is { id: string; name: string; email: string } => !!u)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        return { rows, total, owners, summaryRows };
      });

      const now = new Date();
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const soonCutoff = todayUtc + DUE_SOON_DAYS * 86_400_000;
      let overdue = 0;
      let dueSoon = 0;
      let completed = 0;
      for (const r of summaryRows) {
        if (r.status === 'completed') {
          completed += 1;
          continue;
        }
        if (r.status !== 'pending') continue;
        const due = Date.UTC(
          r.dueDate.getUTCFullYear(),
          r.dueDate.getUTCMonth(),
          r.dueDate.getUTCDate(),
        );
        if (due < todayUtc) overdue += 1;
        else if (due <= soonCutoff) dueSoon += 1;
      }

      return NextResponse.json({
        records: rows.map(toRecord),
        total,
        page,
        pageSize,
        owners,
        summary: {
          total: summaryRows.length,
          dueSoon,
          overdue,
          completed,
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/legal/obligations/records',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load compliance obligations.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const dueDate = parseDate(body.dueDate);
    const category =
      typeof body.category === 'string' && CATEGORIES.has(body.category as LegalObligationCategory)
        ? (body.category as LegalObligationCategory)
        : ('other' as LegalObligationCategory);
    const priority =
      typeof body.priority === 'string' && PRIORITIES.has(body.priority as LegalObligationPriority)
        ? (body.priority as LegalObligationPriority)
        : ('medium' as LegalObligationPriority);
    const status =
      typeof body.status === 'string' && STATUSES.has(body.status as LegalObligationStatus)
        ? (body.status as LegalObligationStatus)
        : ('pending' as LegalObligationStatus);
    const ownerUserId =
      typeof body.ownerUserId === 'string' && body.ownerUserId.trim()
        ? body.ownerUserId.trim()
        : null;
    const reminderDaysParsed = parseInt0(body.reminderDays);
    const reminderDays = reminderDaysParsed != null && reminderDaysParsed >= 0 ? reminderDaysParsed : 30;
    const recurrenceMonthsParsed = parseInt0(body.recurrenceMonths);
    const recurrenceMonths =
      recurrenceMonthsParsed != null && recurrenceMonthsParsed > 0 ? recurrenceMonthsParsed : null;

    if (!title || !dueDate) {
      return NextResponse.json({ error: 'title and dueDate are required.' }, { status: 400 });
    }

    try {
      const created = await ctx.run(async (tx) => {
        const row = await tx.legalObligation.create({
          data: {
            organizationId: ctx.organizationId,
            title,
            description:
              typeof body.description === 'string' ? body.description.trim() || null : null,
            category,
            priority,
            dueDate,
            status,
            ownerUserId,
            regulator: typeof body.regulator === 'string' ? body.regulator.trim() || null : null,
            reminderDays,
            recurrenceMonths,
            evidencePath:
              typeof body.evidencePath === 'string' ? body.evidencePath.trim() || null : null,
            evidenceFileName:
              typeof body.evidenceFileName === 'string'
                ? body.evidenceFileName.trim() || null
                : null,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
          },
          include: { owner: { select: { id: true, name: true, email: true } } },
        });
        await tx.legalObligationEvent.create({
          data: {
            organizationId: ctx.organizationId,
            obligationId: row.id,
            actorUserId: ctx.staff.id,
            type: 'created',
            toStatus: row.status,
          },
        });
        return row;
      });

      await ctx.audit({
        action: 'legal_obligation.created',
        entityType: 'LegalObligation',
        entityId: created.id,
        route: 'POST /api/legal/obligations/records',
      });

      return NextResponse.json(toRecord(created), { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/legal/obligations/records',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create compliance obligation.' }, { status: 500 });
    }
  });
}
