import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreatePrimaryWorkspaceClient } from '@/lib/primary-workspace-client';
import { entityScopedClientWhere, resolveEntityIdOrDefault } from '@/lib/entity-request';
import {
  DEFAULT_OUTSOURCING_REPORT_SECTIONS,
  mapOutsourcingClientToJson,
  parseClientBody,
} from '@/lib/outsourcing-client';
import { withTenant } from '@/lib/tenant-api';

const listInclude = {
  _count: { select: { employees: true, departments: true } },
  rateCards: {
    where: { isActive: true },
    orderBy: { effectiveFrom: 'desc' as const },
    take: 1,
    include: { lines: { orderBy: { sortOrder: 'asc' as const } } },
  },
};

function buildCreateData(
  organizationId: string,
  parsed: ReturnType<typeof parseClientBody>,
) {
  const {
    name,
    status,
    whiteLabelReports,
    reportRecipientEmails,
    reportSections,
    ...rest
  } = parsed;

  const data: Record<string, unknown> = {
    organizationId,
    name,
    status: status ?? 'active',
    whiteLabelReports: whiteLabelReports ?? false,
    reportRecipientEmails: reportRecipientEmails ?? [],
    reportSections: reportSections ?? DEFAULT_OUTSOURCING_REPORT_SECTIONS,
  };

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) data[key] = value;
  }

  return data;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json([], { status: 200 });
      }
      // HR Outsourcing surfaces pass ?excludePrimary=1 so the end-client switcher never
      // lists the company's own "primary workspace client" (that's internal payroll).
      const excludePrimary = new URL(request.url).searchParams.get('excludePrimary') === '1';
      const entityId = await resolveEntityIdOrDefault(request, ctx.organizationId);
      if (entityId) {
        const scoped = await ctx.run((tx) =>
          tx.outsourcingClient.findFirst({
            where: entityScopedClientWhere(entityId, ctx.organizationId),
            include: listInclude,
          }),
        );
        if (!scoped) {
          return NextResponse.json([]);
        }
        if (excludePrimary) {
          const primary = await getOrCreatePrimaryWorkspaceClient(prisma, ctx.organizationId);
          if (scoped.id === primary.id) {
            return NextResponse.json([]);
          }
        }
        const row = mapOutsourcingClientToJson(scoped);
        const label = row.county ? `${row.name} — ${row.county}` : row.name;
        return NextResponse.json([{ ...row, label }]);
      }
      const primary = await getOrCreatePrimaryWorkspaceClient(prisma, ctx.organizationId);
      const primaryFull = await ctx.run((tx) =>
        tx.outsourcingClient.findUnique({
          where: { id: primary.id },
          include: listInclude,
        }),
      );
      if (!primaryFull) {
        return NextResponse.json([]);
      }
      const rest = await ctx.run((tx) =>
        tx.outsourcingClient.findMany({
          where: { organizationId: ctx.organizationId, id: { not: primary.id } },
          orderBy: { name: 'asc' },
          include: listInclude,
        }),
      );
      const ordered = excludePrimary ? rest : [primaryFull, ...rest];
      const mapped = ordered.map((c) => mapOutsourcingClientToJson(c));
      const nameLowerCounts = mapped.reduce((m, row) => {
        const k = row.name.trim().toLowerCase();
        m.set(k, (m.get(k) ?? 0) + 1);
        return m;
      }, new Map<string, number>());
      const withLabels = mapped.map((row) => {
        const dup = (nameLowerCounts.get(row.name.trim().toLowerCase()) ?? 0) > 1;
        const label = dup
          ? `${row.name} (${row.id.slice(0, 8)}…)`
          : row.county
            ? `${row.name} — ${row.county}`
            : row.name;
        return { ...row, label };
      });
      return NextResponse.json(withLabels);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[outsourcing/clients]', e);
      return NextResponse.json(
        {
          error: 'Failed to load outsourcing clients',
          ...(process.env.NODE_ENV === 'development' && { detail: msg }),
        },
        { status: 500 },
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const parsed = parseClientBody(body as Record<string, unknown>);
    if (!parsed.name) {
      return NextResponse.json({ error: 'Client name is required.' }, { status: 400 });
    }

    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }
      const client = await ctx.run((tx) =>
        tx.outsourcingClient.create({
          data: buildCreateData(ctx.organizationId, parsed),
          include: listInclude,
        }),
      );
      return NextResponse.json(mapOutsourcingClientToJson(client));
    } catch (e) {
      console.error('[outsourcing/clients POST]', e);
      return NextResponse.json({ error: 'Failed to create outsourcing client' }, { status: 500 });
    }
  });
}
