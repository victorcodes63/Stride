import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse } from '@/lib/demo-route-access';
import {
  DEFAULT_OUTSOURCING_REPORT_SECTIONS,
  mapOutsourcingClientToJson,
  parseClientBody,
} from '@/lib/outsourcing-client';
import { withTenant, type TenantContext } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

const detailInclude = {
  _count: { select: { employees: true, departments: true } },
  rateCards: {
    orderBy: { effectiveFrom: 'desc' as const },
    include: { lines: { orderBy: { sortOrder: 'asc' as const } } },
  },
};

async function assertClientInOrg(
  clientId: string,
  organizationId: string,
  run: TenantContext['run'],
) {
  return run((tx) =>
    tx.outsourcingClient.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true },
    }),
  );
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  return withTenant(_request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const client = await ctx.run((tx) =>
        tx.outsourcingClient.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: detailInclude,
        }),
      );
      if (!client) {
        return forbiddenResponse('Client not found for this organization.');
      }
      return NextResponse.json(mapOutsourcingClientToJson(client));
    } catch (e) {
      console.error('[outsourcing/clients GET]', e);
      return NextResponse.json({ error: 'Failed to load client' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseClientBody(body as Record<string, unknown>);
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined || (key === 'name' && value === '')) continue;
    data[key] = value;
  }

  if (parsed.name) data.name = parsed.name;
  if (parsed.reportRecipientEmails !== undefined) {
    data.reportRecipientEmails = parsed.reportRecipientEmails;
  }
  if (parsed.reportSections !== undefined) {
    data.reportSections = parsed.reportSections ?? DEFAULT_OUTSOURCING_REPORT_SECTIONS;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
  }

  return withTenant(request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const existing = await assertClientInOrg(id, ctx.organizationId, ctx.run);
      if (!existing) {
        return forbiddenResponse('Client not found for this organization.');
      }

      const client = await ctx.run((tx) =>
        tx.outsourcingClient.update({
          where: { id },
          data,
          include: detailInclude,
        }),
      );
      return NextResponse.json(mapOutsourcingClientToJson(client));
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'P2025') return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      console.error('[outsourcing/clients PATCH]', e);
      return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
    }
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  return withTenant(_request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const existing = await assertClientInOrg(id, ctx.organizationId, ctx.run);
      if (!existing) {
        return forbiddenResponse('Client not found for this organization.');
      }

      await ctx.run((tx) => tx.outsourcingClient.delete({ where: { id } }));
      return NextResponse.json({ ok: true });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'P2025') return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      console.error('[outsourcing/clients DELETE]', e);
      return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
    }
  });
}
