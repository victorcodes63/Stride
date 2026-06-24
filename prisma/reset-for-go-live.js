/**
 * Reset database for go-live: remove all applications, jobs, candidates,
 * interviews, and clients so the site starts clean. Keeps Users (staff) and Insights.
 *
 * Run locally: npm run db:reset-for-go-live
 * Run against production: DATABASE_URL="your-production-url" npm run db:reset-for-go-live
 *
 * Requires: DATABASE_URL set, Prisma schema applied (migrate or push).
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Resetting data for go-live...');

  const interview = await prisma.interview.deleteMany({});
  console.log(`  Deleted ${interview.count} interview(s).`);

  const application = await prisma.application.deleteMany({});
  console.log(`  Deleted ${application.count} application(s).`);

  const job = await prisma.job.deleteMany({});
  console.log(`  Deleted ${job.count} job(s).`);

  const candidate = await prisma.candidate.deleteMany({});
  console.log(`  Deleted ${candidate.count} candidate(s).`);

  const client = await prisma.client.deleteMany({});
  console.log(`  Deleted ${client.count} client(s).`);

  console.log('Done. Cleared: Interview, Application, Job, Candidate, Client.');
  console.log('Kept: User (staff), Insight.');
}

main()
  .catch((e) => {
    console.error('Reset failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
