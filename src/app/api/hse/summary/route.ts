import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import {
  HSE_INCIDENT_TYPE_LABELS,
  HSE_SEVERITY_LABELS,
} from '@/lib/hse/serialize';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'] as const;

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ bySeverity: [], byType: [], monthlyTrend: [] });
  }

  return withTenant(request, async (ctx) => {
    try {
      const monthsRaw = Number.parseInt(request.nextUrl.searchParams.get('months') ?? '12', 10) || 12;
      const months = Math.min(12, Math.max(6, monthsRaw));

      const now = new Date();
      // First day of the earliest month window (inclusive).
      const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const scope = { ...ctx.where(), outsourcingClientId: clientId } as Prisma.HseIncidentWhereInput;

        const [bySeverity, byType, trendRows] = await Promise.all([
          tx.hseIncident.groupBy({
            by: ['severity'],
            where: scope,
            _count: { _all: true },
          }),
          tx.hseIncident.groupBy({
            by: ['incidentType'],
            where: scope,
            _count: { _all: true },
          }),
          // Only pull occurredAt within the trend window — never the full rows.
          tx.hseIncident.findMany({
            where: { ...scope, occurredAt: { gte: windowStart } },
            select: { occurredAt: true },
          }),
        ]);

        return { bySeverity, byType, trendRows };
      });

      const severityCounts = new Map<string, number>();
      for (const row of result.bySeverity) severityCounts.set(row.severity, row._count._all);
      const bySeverity = SEVERITY_ORDER.map((value) => ({
        key: value,
        label: HSE_SEVERITY_LABELS[value],
        count: severityCounts.get(value) ?? 0,
      }));

      const byType = result.byType
        .map((row) => ({
          key: row.incidentType,
          label: HSE_INCIDENT_TYPE_LABELS[row.incidentType],
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count);

      // Build an ordered list of month buckets, then tally.
      const buckets: { key: string; label: string; count: number }[] = [];
      const bucketIndex = new Map<string, number>();
      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' });
        bucketIndex.set(key, buckets.length);
        buckets.push({ key, label, count: 0 });
      }
      for (const row of result.trendRows) {
        const d = row.occurredAt;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const idx = bucketIndex.get(key);
        if (idx != null) buckets[idx].count += 1;
      }

      return NextResponse.json({ bySeverity, byType, monthlyTrend: buckets });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/hse/summary',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load HSE analytics.' }, { status: 500 });
    }
  });
}
