import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { ensureUniqueSlug, jobSlugBase } from '@/lib/slug';

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

/** POST /api/outsourcing/clients/[id]/jobs — create an RPO job scoped to an end-client. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: outsourcingClientId } = await context.params;

  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Job title is required.' }, { status: 400 });
    }

    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    const employmentType =
      typeof body.employmentType === 'string' && body.employmentType.trim()
        ? body.employmentType.trim()
        : 'Full Time';
    const category =
      typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Outsourcing';
    const providedReferenceId =
      typeof body.referenceId === 'string' && body.referenceId.trim() ? body.referenceId.trim() : undefined;
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;

    const client = await ctx.run((tx) =>
      tx.outsourcingClient.findFirst({
        where: { id: outsourcingClientId, organizationId: ctx.organizationId },
        select: { id: true, name: true },
      }),
    );
    if (!client) {
      return NextResponse.json({ error: 'End-client not found.' }, { status: 404 });
    }

    try {
      const job = await ctx.run(async (tx) => {
        let referenceId = providedReferenceId;
        if (!referenceId) {
          const year = new Date().getFullYear();
          const prefix = `JOB-${year}-`;
          const existing = await tx.job.findMany({
            where: ctx.where({ referenceId: { startsWith: prefix } }),
            select: { referenceId: true },
            orderBy: { referenceId: 'desc' },
            take: 1,
          });
          const nextNum =
            existing.length === 0
              ? 1
              : parseInt(existing[0].referenceId?.replace(prefix, '') || '0', 10) + 1;
          referenceId = `${prefix}${String(nextNum).padStart(4, '0')}`;
        }

        const baseSlug = jobSlugBase(title, location);
        const slug = await ensureUniqueSlug(baseSlug, async (s) => {
          const found = await tx.job.findFirst({ where: ctx.where({ slug: s }) });
          return !!found;
        });

        return tx.job.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId,
            referenceId,
            slug,
            title,
            company: client.name,
            location,
            type: employmentType,
            category,
            description,
            requirements: [],
            responsibilities: [],
            benefits: [],
            skills: [],
            isActive,
            postedDate: new Date(),
          },
          select: {
            id: true,
            referenceId: true,
            title: true,
            isActive: true,
            postedDate: true,
          },
        });
      });

      return NextResponse.json(
        {
          id: job.id,
          referenceId: job.referenceId,
          title: job.title,
          isActive: job.isActive,
          postedDate: job.postedDate.toISOString(),
          applicationCount: 0,
        },
        { status: 201 },
      );
    } catch {
      return NextResponse.json({ error: 'Failed to create RPO job.' }, { status: 500 });
    }
  });
}
