import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInMemoryJobs } from '@/lib/jobs-store';

/** Returns unique category names from all jobs (for dropdown/datalist suggestions). */
export async function GET() {
  try {
    if (process.env.DATABASE_URL) {
      const jobs = await prisma.job.findMany({
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      });
      const categories = jobs.map((j) => j.category).filter(Boolean);
      return NextResponse.json(categories);
    }
  } catch (_e) {
    // Fall through to in-memory
  }
  const list = getInMemoryJobs(false, false);
  const set = new Set(list.map((j) => j.category).filter(Boolean));
  const categories = Array.from(set).sort((a, b) => a.localeCompare(b));
  return NextResponse.json(categories);
}
