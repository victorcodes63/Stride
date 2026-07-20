/**
 * Seed published job descriptions for the active demo pack.
 * Titles match employee jobTitles so performance cycles bind scorecards.
 *
 * Run: npx tsx scripts/seed-demo-job-descriptions.ts
 * Prefer DEMO_PACK=cargo-logistics (SwiftFreight).
 */
import { PrismaClient } from '@prisma/client';

import { SWIFTFREIGHT_JD_MANUAL } from '../src/lib/performance/jd/swiftfreight-jd-manual';
import {
  ensureJdParserConfigManual,
  importJdManual,
} from '../src/lib/performance/jd/service';
import { generateScorecardFromJobDescription } from '../src/lib/performance/scorecard/service';

const prisma = new PrismaClient();

async function resolveDemoOrg() {
  const packId = process.env.DEMO_PACK?.trim();
  if (packId) {
    const bySlug = await prisma.organization.findUnique({
      where: { slug: `demo-${packId}` },
    });
    if (bySlug) return bySlug;
  }
  return prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
}

async function main() {
  const org = await resolveDemoOrg();
  if (!org) {
    console.error('No Organization row — run demo seed first.');
    process.exit(1);
  }

  const manual = SWIFTFREIGHT_JD_MANUAL;

  // Avoid one long interactive transaction — Neon pooler closes idle txs.
  await ensureJdParserConfigManual(prisma, org.id);
  const importResult = await importJdManual(prisma, {
    organizationId: org.id,
    manual,
    publish: true,
    skipDuplicates: true,
  });

  if (!importResult.ok) {
    console.error(importResult.error);
    process.exit(1);
  }

  const published = await prisma.jobDescription.findMany({
    where: {
      organizationId: org.id,
      status: 'published',
      title: { in: manual.roles.map((r) => r.title) },
    },
    select: { id: true, title: true },
  });

  let scorecards = 0;
  for (const jd of published) {
    const result = await generateScorecardFromJobDescription(prisma, {
      organizationId: org.id,
      jobDescriptionId: jd.id,
    });
    if (result.ok) scorecards += 1;
  }

  const employees = await prisma.employee.findMany({
    where: { organizationId: org.id, employmentStatus: 'active' },
    select: { firstName: true, lastName: true, jobTitle: true },
  });
  const jdTitles = new Set(manual.roles.map((r) => r.title.toLowerCase()));
  const matched = employees.filter((e) => e.jobTitle && jdTitles.has(e.jobTitle.toLowerCase()));

  console.log(
    `JD manual "${importResult.manualName}" for ${org.slug}: ` +
      `${importResult.roleCount} roles created, ${importResult.skippedCount} skipped, ` +
      `${scorecards} scorecards, ${matched.length}/${employees.length} staff titles matched.`,
  );
  for (const e of matched) {
    console.log(`  ✓ ${e.firstName} ${e.lastName} → ${e.jobTitle}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
