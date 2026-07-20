import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import {
  computeStatus,
  normalizeReference,
  parseContractType,
  type ContractType,
} from '../_filters';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const row = await ctx.run(async (tx) => {
        const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(
          tx,
          ctx.organizationId,
          request,
        );
        return tx.accountsContract.findFirst({
          where: { ...ctx.where(), id, clientId: primaryAccountsClient.id },
          include: {
            managers: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        });
      });
      if (!row) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

      return NextResponse.json({
        id: row.id,
        title: row.title,
        reference: row.reference,
        contractType: parseContractType(row.reference),
        startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: row.endDate.toISOString().slice(0, 10),
        status: computeStatus(row.endDate),
        remindersDisabled: row.remindersDisabled,
        managers: row.managers.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
        })),
        updatedAt: row.updatedAt.toISOString(),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/people/contracts/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load contract.' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as
      | {
          title?: string;
          reference?: string;
          contractType?: string;
          startDate?: string | null;
          endDate?: string;
          remindersDisabled?: boolean;
          managerIds?: string[];
        }
      | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    try {
      const existing = await ctx.run(async (tx) => {
        const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(
          tx,
          ctx.organizationId,
          request,
        );
        return tx.accountsContract.findFirst({
          where: { ...ctx.where(), id, clientId: primaryAccountsClient.id },
          select: { id: true, reference: true },
        });
      });
      if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

      const data: Prisma.AccountsContractUpdateInput = {};

      if (typeof body.title === 'string') {
        const title = body.title.trim();
        if (!title) return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 });
        data.title = title;
      }

      if (typeof body.reference === 'string') {
        const type: ContractType =
          body.contractType === 'consultant' || body.contractType === 'employee'
            ? body.contractType
            : parseContractType(existing.reference);
        data.reference = normalizeReference(body.reference, type) || null;
      }

      let nextStart: Date | null | undefined;
      let nextEnd: Date | undefined;
      if (body.startDate !== undefined) {
        if (body.startDate === null || String(body.startDate).trim() === '') {
          nextStart = null;
        } else {
          const parsed = new Date(String(body.startDate));
          if (Number.isNaN(parsed.getTime())) {
            return NextResponse.json({ error: 'Invalid startDate.' }, { status: 400 });
          }
          nextStart = parsed;
        }
      }
      if (body.endDate !== undefined) {
        const parsed = new Date(String(body.endDate));
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: 'Invalid endDate.' }, { status: 400 });
        }
        nextEnd = parsed;
      }
      if (nextStart != null && nextEnd && nextStart > nextEnd) {
        return NextResponse.json({ error: 'startDate cannot be after endDate.' }, { status: 400 });
      }
      if (nextStart !== undefined) data.startDate = nextStart;
      if (nextEnd !== undefined) data.endDate = nextEnd;

      if (typeof body.remindersDisabled === 'boolean') {
        data.remindersDisabled = body.remindersDisabled;
      }

      const managerIds = Array.isArray(body.managerIds)
        ? [
            ...new Set(
              body.managerIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0),
            ),
          ]
        : null;

      await ctx.run(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.accountsContract.update({ where: { id }, data });
        }
        if (managerIds) {
          await tx.contractManager.deleteMany({ where: { contractId: id } });
          const finalIds = [...new Set([ctx.staff.id, ...managerIds])];
          if (finalIds.length) {
            await tx.contractManager.createMany({
              data: finalIds.map((userId) => ({
                organizationId: ctx.organizationId,
                contractId: id,
                userId,
              })),
              skipDuplicates: true,
            });
          }
        }
      });

      await ctx.audit({
        action: 'contract.updated',
        entityType: 'AccountsContract',
        entityId: id,
        route: 'PATCH /api/people/contracts/[id]',
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/people/contracts/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update contract.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const existing = await ctx.run(async (tx) => {
        const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(
          tx,
          ctx.organizationId,
          request,
        );
        return tx.accountsContract.findFirst({
          where: { ...ctx.where(), id, clientId: primaryAccountsClient.id },
          select: { id: true },
        });
      });
      if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

      await ctx.run(async (tx) => {
        // ContractManager rows cascade via the schema relation; remove them first
        // so the delete succeeds even where the FK isn't set to cascade.
        await tx.contractManager.deleteMany({ where: { contractId: id } });
        await tx.accountsContract.delete({ where: { id } });
      });

      await ctx.audit({
        action: 'contract.deleted',
        entityType: 'AccountsContract',
        entityId: id,
        route: 'DELETE /api/people/contracts/[id]',
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/people/contracts/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete contract.' }, { status: 500 });
    }
  });
}
