import { NextRequest, NextResponse } from 'next/server';
import { getInMemoryJobs } from '@/lib/jobs-store';
import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { withTenant } from '@/lib/tenant-api';

async function resolvePublicCareersOrganizationId(): Promise<string | null> {
  const row = await prisma.recruitmentSettings.findUnique({
    where: { id: 'default' },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}

/** Returns unique category names from all jobs (for dropdown/datalist suggestions). */
export async function GET(request: NextRequest) {
  const staff = await requireStaffUser(request);
  if (staff) {
    return withTenant(request, async (ctx) => {
      try {
        if (process.env.DATABASE_URL) {
          const jobs = await ctx.run((tx) =>
            tx.job.findMany({
              where: ctx.where(),
              select: { category: true },
              distinct: ['category'],
              orderBy: { category: 'asc' },
            }),
          );
          const categories = jobs.map((j) => j.category).filter(Boolean);
          return NextResponse.json(categories);
        }
      } catch {
        // Fall through to in-memory
      }
      const list = getInMemoryJobs(false, false);
      const set = new Set(list.map((j) => j.category).filter(Boolean));
      return NextResponse.json(Array.from(set).sort((a, b) => a.localeCompare(b)));
    });
  }

  try {
    if (process.env.DATABASE_URL) {
      const orgId = await resolvePublicCareersOrganizationId();
      if (!orgId) return NextResponse.json([]);
      const jobs = await withOrgContext(orgId, (tx) =>
        tx.job.findMany({
          where: { organizationId: orgId },
          select: { category: true },
          distinct: ['category'],
          orderBy: { category: 'asc' },
        }),
      );
      const categories = jobs.map((j) => j.category).filter(Boolean);
      return NextResponse.json(categories);
    }
  } catch {
    // Fall through to in-memory
  }
  const list = getInMemoryJobs(false, false);
  const set = new Set(list.map((j) => j.category).filter(Boolean));
  return NextResponse.json(Array.from(set).sort((a, b) => a.localeCompare(b)));
}
