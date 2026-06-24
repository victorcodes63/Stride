/**
 * RAV-69: Seed an active performance cycle with reviews for up to 50 employees.
 * Run: npm run db:seed-performance
 */
import { PrismaClient } from '@prisma/client';

import { activatePerformanceCycle } from '../src/lib/performance/service';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) {
    console.error('No Organization row — run tenancy migration / seed first.');
    process.exit(1);
  }

  const client = await prisma.outsourcingClient.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
  });

  const existing = await prisma.performanceCycle.findFirst({
    where: { organizationId: org.id, status: 'active' },
  });
  if (existing) {
    const count = await prisma.performanceReview.count({ where: { cycleId: existing.id } });
    console.log(`Active cycle already exists: ${existing.name} (${count} reviews)`);
    return;
  }

  const cycle = await prisma.performanceCycle.create({
    data: {
      organizationId: org.id,
      name: 'H1 2026 Performance Review',
      description: 'Demo mid-year review cycle (RAV-69)',
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-06-30T00:00:00.000Z'),
      outsourcingClientId: client?.id ?? null,
      status: 'draft',
    },
  });

  const result = await prisma.$transaction((tx) =>
    activatePerformanceCycle(tx, {
      organizationId: org.id,
      cycleId: cycle.id,
      maxEmployees: 50,
    }),
  );

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  // Demo progress: mark first 10 reviews as self-submitted
  const reviews = await prisma.performanceReview.findMany({
    where: { cycleId: cycle.id },
    take: 10,
    orderBy: { createdAt: 'asc' },
  });

  for (const [i, review] of reviews.entries()) {
    await prisma.performanceReview.update({
      where: { id: review.id },
      data: {
        status: 'self_submitted',
        overallSelfRating: 3 + (i % 3),
        selfSummary: 'Demo self-assessment for review cycle.',
        selfSubmittedAt: new Date(),
      },
    });
  }

  console.log(`Seeded performance cycle "${cycle.name}" with ${result.employeeCount} reviews.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
