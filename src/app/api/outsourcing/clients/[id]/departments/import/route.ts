import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant, type TenantContext } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

type ImportRow = { name: string; code?: string | null; description?: string | null };

function normalizeRows(input: unknown): ImportRow[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const rows: ImportRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      name,
      code: typeof r.code === 'string' && r.code.trim() ? r.code.trim() : null,
      description: typeof r.description === 'string' && r.description.trim() ? r.description.trim() : null,
    });
  }
  return rows;
}

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

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: clientId } = await context.params;
  if (!clientId) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rows = normalizeRows(body.rows);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid rows to import. Each row needs a name.' }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Too many rows (max 500 per import).' }, { status: 400 });
  }

  return withTenant(request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const client = await assertClientInOrg(clientId, ctx.organizationId, ctx.run);
      if (!client) {
        return forbiddenResponse('Client not found for this organization.');
      }

      const result = await ctx.run(async (tx) => {
        const existing = await tx.department.findMany({
          where: { organizationId: ctx.organizationId, outsourcingClientId: clientId },
          select: { name: true, code: true },
        });
        const existingNames = new Set(existing.map((d) => d.name.toLowerCase()));
        const existingCodes = new Set(existing.filter((d) => d.code).map((d) => d.code!.toLowerCase()));

        const created: string[] = [];
        const skipped: { name: string; reason: string }[] = [];
        const usedCodes = new Set(existingCodes);

        for (const row of rows) {
          if (existingNames.has(row.name.toLowerCase())) {
            skipped.push({ name: row.name, reason: 'duplicate name' });
            continue;
          }
          let code = row.code;
          if (code && usedCodes.has(code.toLowerCase())) {
            // Drop a clashing code rather than fail the whole row.
            code = null;
          }
          await tx.department.create({
            data: {
              organizationId: ctx.organizationId,
              outsourcingClientId: clientId,
              name: row.name,
              code: code ?? undefined,
              description: row.description ?? undefined,
            },
          });
          existingNames.add(row.name.toLowerCase());
          if (code) usedCodes.add(code.toLowerCase());
          created.push(row.name);
        }

        return { created, skipped };
      });

      await ctx.audit({
        action: 'department.imported',
        entityType: 'Department',
        route: 'POST /api/outsourcing/clients/[id]/departments/import',
        metadata: { clientId, created: result.created.length, skipped: result.skipped.length },
      });

      return NextResponse.json({
        created: result.created.length,
        skipped: result.skipped.length,
        skippedRows: result.skipped,
      });
    } catch (e) {
      console.error('[departments import POST]', e);
      return NextResponse.json({ error: 'Failed to import departments' }, { status: 500 });
    }
  });
}
