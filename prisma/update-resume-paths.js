/**
 * Set all candidates and applications to use the shared sample resume path.
 * Run after placing a PDF at public/uploads/resumes/sample-resume.pdf.
 *
 * Usage: node prisma/update-resume-paths.js
 * Or:    npm run db:update-resume-paths
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Use your PDF filename (spaces encoded as %20 for URLs)
const SAMPLE_RESUME_PATH = '/uploads/resumes/CV%20Justin%20Ombui.pdf';

async function main() {
  const candidates = await prisma.candidate.updateMany({
    data: { resumePath: SAMPLE_RESUME_PATH },
  });
  const applications = await prisma.application.updateMany({
    data: { resumePath: SAMPLE_RESUME_PATH },
  });
  console.log(`Updated ${candidates.count} candidates and ${applications.count} applications to use ${SAMPLE_RESUME_PATH}`);
  console.log('Resume preview in the Applications sidebar will now work for all of them.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
