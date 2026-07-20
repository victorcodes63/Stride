import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import { parseFormat, respondWithReport } from '@/app/api/reports/_shared';
import type { Cell } from '@/lib/excel-export';
import {
  computeStatus,
  contractFilterClauses,
  contractOrderBy,
  parseContractQuery,
  parseContractType,
} from '../_filters';

export const dynamic = 'force-dynamic';

const HEADERS = ['Type', 'Party', 'Reference', 'Start', 'End', 'Status', 'Managers'];

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  expiring: 'Expiring',
  expired: 'Expired',
};

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const format = parseFormat(request);
    const query = parseContractQuery(request.nextUrl.searchParams);

    try {
      const rows = await ctx.run(async (tx) => {
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
        return tx.accountsContract.findMany({
          where,
          include: {
            managers: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
          orderBy: contractOrderBy(query),
          take: 5000,
        });
      });

      const dataRows: Cell[][] = rows.map((c) => {
        const type = parseContractType(c.reference);
        const status = computeStatus(c.endDate);
        return [
          type === 'consultant' ? 'Consultant' : 'Employee',
          c.title ?? '',
          c.reference ?? '',
          c.startDate?.toISOString().slice(0, 10) ?? '',
          c.endDate.toISOString().slice(0, 10),
          STATUS_LABEL[status] ?? status,
          c.managers.map((m) => m.user.name).join(', '),
        ];
      });

      const json = rows.map((c) => ({
        id: c.id,
        contractType: parseContractType(c.reference),
        title: c.title,
        reference: c.reference,
        startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: c.endDate.toISOString().slice(0, 10),
        status: computeStatus(c.endDate),
        managers: c.managers.map((m) => m.user.name),
      }));

      return respondWithReport({
        format,
        json,
        title: 'Contracts',
        sheetName: 'Contracts',
        baseFilename: `contracts-${new Date().toISOString().slice(0, 10)}`,
        headers: HEADERS,
        rows: dataRows,
        summaryLines: [`${rows.length} contract(s)`],
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/people/contracts/export',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to export contracts.' }, { status: 500 });
    }
  });
}
