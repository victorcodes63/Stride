import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { unauthorizedResponse } from '@/lib/demo-route-access';

export async function GET(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ activeJobs: 0, companies: 0, candidates: 0, applications: 0 });
    }

    const [activeJobs, settingsRow, candidates, applications] = await Promise.all([
      prisma.job.count({ where: { isActive: true } }),
      prisma.recruitmentSettings.findUnique({ where: { id: 'default' } }),
      prisma.candidate.count(),
      prisma.application.count(),
    ]);

    const companies = settingsRow ? 1 : 0;

    return NextResponse.json({ activeJobs, companies, candidates, applications });
  } catch (e) {
    console.error('[/api/stats]', e);
    return NextResponse.json({ activeJobs: 0, companies: 0, candidates: 0, applications: 0 });
  }
}
