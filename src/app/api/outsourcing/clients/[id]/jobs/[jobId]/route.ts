import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** GET /api/outsourcing/clients/[id]/jobs/[jobId] — single RPO job for an end-client. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: outsourcingClientId, jobId } = await context.params;

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

    const job = await ctx.run((tx) =>
      tx.job.findFirst({
        where: {
          id: jobId,
          organizationId: ctx.organizationId,
          outsourcingClientId,
        },
        select: {
          id: true,
          referenceId: true,
          title: true,
          company: true,
          location: true,
          type: true,
          category: true,
          description: true,
          isActive: true,
          postedDate: true,
          _count: { select: { applications: true } },
        },
      }),
    );
    if (!job) {
      return NextResponse.json({ error: 'RPO job not found.' }, { status: 404 });
    }

    return NextResponse.json({
      client,
      job: {
        id: job.id,
        referenceId: job.referenceId,
        title: job.title,
        company: job.company,
        location: job.location,
        employmentType: job.type,
        category: job.category,
        description: job.description,
        isActive: job.isActive,
        postedDate: job.postedDate.toISOString(),
        applicationCount: job._count.applications,
      },
    });
  });
}

/** PATCH /api/outsourcing/clients/[id]/jobs/[jobId] — edit basic fields / toggle status. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: outsourcingClientId, jobId } = await context.params;

  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const existing = await ctx.run((tx) =>
      tx.job.findFirst({
        where: { id: jobId, organizationId: ctx.organizationId, outsourcingClientId },
        select: { id: true },
      }),
    );
    if (!existing) {
      return NextResponse.json({ error: 'RPO job not found.' }, { status: 404 });
    }

    const data: {
      title?: string;
      description?: string;
      location?: string;
      type?: string;
      isActive?: boolean;
    } = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (typeof body.description === 'string') data.description = body.description.trim();
    if (typeof body.location === 'string') data.location = body.location.trim();
    if (typeof body.employmentType === 'string' && body.employmentType.trim())
      data.type = body.employmentType.trim();
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

    const job = await ctx.run((tx) =>
      tx.job.update({
        where: { id: jobId },
        data,
        select: {
          id: true,
          referenceId: true,
          title: true,
          company: true,
          location: true,
          type: true,
          category: true,
          description: true,
          isActive: true,
          postedDate: true,
          _count: { select: { applications: true } },
        },
      }),
    );

    return NextResponse.json({
      job: {
        id: job.id,
        referenceId: job.referenceId,
        title: job.title,
        company: job.company,
        location: job.location,
        employmentType: job.type,
        category: job.category,
        description: job.description,
        isActive: job.isActive,
        postedDate: job.postedDate.toISOString(),
        applicationCount: job._count.applications,
      },
    });
  });
}
