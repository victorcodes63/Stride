import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** GET /api/outsourcing/clients/[id]/jobs — OUT-06 RPO jobs for an end-client. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: outsourcingClientId } = await context.params;

  return withTenant(request, async (ctx) => {
    const client = await ctx.run((tx) =>
      tx.outsourcingClient.findFirst({
        where: { id: outsourcingClientId, organizationId: ctx.organizationId },
        select: { id: true, name: true },
      }),
    );
    if (!client) {
      return NextResponse.json({ error: 'End-client not found.' }, { status: 404 });
    }

    const jobs = await ctx.run((tx) =>
      tx.job.findMany({
        where: {
          organizationId: ctx.organizationId,
          outsourcingClientId,
        },
        select: {
          id: true,
          referenceId: true,
          title: true,
          isActive: true,
          postedDate: true,
          applicationCount: true,
          _count: { select: { applications: true } },
        },
        orderBy: { postedDate: 'desc' },
        take: 50,
      }),
    );

    return NextResponse.json({
      client,
      jobs: jobs.map((job) => ({
        id: job.id,
        referenceId: job.referenceId,
        title: job.title,
        isActive: job.isActive,
        postedDate: job.postedDate.toISOString(),
        applicationCount: job._count.applications,
      })),
    });
  });
}
