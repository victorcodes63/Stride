import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import {
  computeStatus,
  contractFilterClauses,
  contractOrderBy,
  normalizeReference,
  parseContractQuery,
  parseContractType,
} from './_filters';

export const dynamic = 'force-dynamic';

type ContractRow = Prisma.AccountsContractGetPayload<{
  include: {
    managers: { include: { user: { select: { id: true; name: true; email: true } } } };
  };
}>;

function serializeContract(c: ContractRow) {
  return {
    id: c.id,
    title: c.title,
    reference: c.reference,
    contractType: parseContractType(c.reference),
    startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: c.endDate.toISOString().slice(0, 10),
    status: computeStatus(c.endDate),
    remindersDisabled: c.remindersDisabled,
    managers: c.managers.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    })),
    createdAt: c.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const query = parseContractQuery(request.nextUrl.searchParams);
    try {
      const result = await ctx.run(async (tx) => {
        const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(
          tx,
          ctx.organizationId,
          request,
        );
        const where: Prisma.AccountsContractWhereInput = {
          ...ctx.where(),
          clientId: primaryAccountsClient.id,
          AND: contractFilterClauses(query),
        };
        const orderBy = contractOrderBy(query);

        if (!query.paginated) {
          const rows = await tx.accountsContract.findMany({
            where,
            include: {
              managers: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
            orderBy,
            take: 1000,
          });
          return { rows, total: rows.length };
        }

        const [rows, total] = await Promise.all([
          tx.accountsContract.findMany({
            where,
            include: {
              managers: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
            orderBy,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.accountsContract.count({ where }),
        ]);
        return { rows, total };
      });

      const contracts = result.rows.map(serializeContract);

      // Back-compat: callers that don't opt into pagination get the plain array.
      if (!query.paginated) {
        return NextResponse.json(contracts);
      }

      return NextResponse.json({
        contracts,
        total: result.total,
        page: query.page,
        pageSize: query.pageSize,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/people/contracts',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load contracts.' }, { status: 500 });
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

    const contractType = body.contractType === 'consultant' ? 'consultant' : 'employee';
    const partyName = String(body.partyName || '').trim();
    const referenceInput = String(body.reference || '').trim();
    const reference = normalizeReference(referenceInput, contractType) || null;
    const startDateRaw = String(body.startDate || '').trim();
    const endDateRaw = String(body.endDate || '').trim();
    const remindersDisabled = body.remindersDisabled === true;
    const managerIdsInput = Array.isArray(body.managerIds)
      ? body.managerIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];

    if (!partyName || !endDateRaw) {
      return NextResponse.json({ error: 'partyName and endDate are required.' }, { status: 400 });
    }

    const startDate = startDateRaw ? new Date(startDateRaw) : null;
    const endDate = new Date(endDateRaw);
    if ((startDate && Number.isNaN(startDate.getTime())) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date values.' }, { status: 400 });
    }
    if (startDate && startDate > endDate) {
      return NextResponse.json({ error: 'startDate cannot be after endDate.' }, { status: 400 });
    }

    try {
      const created = await ctx.run(async (tx) => {
        const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(
          tx,
          ctx.organizationId,
          request,
        );
        const managerIds = [...new Set([ctx.staff.id, ...managerIdsInput])];

        return tx.accountsContract.create({
          data: {
            organizationId: ctx.organizationId,
            clientId: primaryAccountsClient.id,
            title: partyName,
            reference,
            startDate: startDate ?? null,
            endDate,
            remindersDisabled,
            managers: {
              create: managerIds.map((userId) => ({
                organizationId: ctx.organizationId,
                userId,
              })),
            },
          },
          include: {
            managers: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        });
      });

      await ctx.audit({
        action: 'contract.created',
        entityType: 'AccountsContract',
        entityId: created.id,
        route: 'POST /api/people/contracts',
      });

      return NextResponse.json(
        {
          id: created.id,
          title: created.title,
          reference: created.reference,
          contractType: parseContractType(created.reference),
          startDate: created.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: created.endDate.toISOString().slice(0, 10),
          remindersDisabled: created.remindersDisabled,
          managers: created.managers.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
          })),
          createdAt: created.createdAt.toISOString(),
        },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/people/contracts',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create contract.' }, { status: 500 });
    }
  });
}
