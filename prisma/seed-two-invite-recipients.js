/**
 * Seed 2 applicants (vichumo38@gmail.com, victor_chumo@outlook.com) with applications
 * and scheduled interviews. Run after db has jobs (e.g. npm run db:seed-full-dev).
 * Outputs interview IDs for sending invites.
 *
 * Run: node prisma/seed-two-invite-recipients.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CV_PATH = process.env.SEED_CV_PATH || process.env.SEED_RESUME_PATH || '/uploads/resumes/seed-cv.pdf';

const RECIPIENTS = [
  { email: 'vichumo38@gmail.com', firstName: 'Victor', lastName: 'Chumo' },
  { email: 'victor_chumo@outlook.com', firstName: 'Victor', lastName: 'Chumo' },
];

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function scheduleTime(daysFromNow, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const MINIMAL_FORM_DATA = {
  gender: 'Male',
  education: [{ level: 'bachelor', institution: 'University of Nairobi', grade: 'Second Class Upper', discipline: 'Computer Science' }],
  employmentHistory: [{ jobTitle: 'Software Engineer', companyName: 'Tech Co', industry: 'Technology', employmentType: 'Full-time', startDate: '2020-01', endDate: '2024-12', isCurrentJob: false }],
  declarations: { accurate: true, dataProcessing: true, backgroundChecks: true, talentPool: true },
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const jobs = await prisma.job.findMany({ where: { isActive: true }, take: 2, orderBy: { createdAt: 'asc' } });
  if (jobs.length < 2) {
    console.error('Need at least 2 active jobs. Run: npm run db:seed-full-dev');
    process.exit(1);
  }

  const interviewIds = [];

  for (let i = 0; i < RECIPIENTS.length; i++) {
    const r = RECIPIENTS[i];
    const job = jobs[i];

    let candidate = await prisma.candidate.findUnique({ where: { email: r.email } });
    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          phone: '+254 700 123 456',
          location: 'Nairobi',
          nationality: 'Kenyan',
          homeCounty: 'Nairobi',
          experience: 5,
          education: 'Bachelor Computer Science',
          resumePath: CV_PATH,
        },
      });
      console.log('Created candidate:', r.email);
    } else {
      console.log('Found existing candidate:', r.email);
    }

    let application = await prisma.application.findFirst({
      where: { candidateId: candidate.id, jobId: job.id },
    });
    if (!application) {
      application = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          status: 'shortlisted',
          appliedDate: daysAgo(5),
          coverLetter: `I am interested in the ${job.title} role.`,
          resumePath: CV_PATH,
          salaryExpectations: '150000-200000 KES',
          notes: 'Strong fit. Schedule interview.',
          formData: MINIMAL_FORM_DATA,
        },
      });
      console.log('Created application for', r.email, '->', job.title);
    } else {
      console.log('Found existing application:', r.email, '->', job.title);
    }

    let interview = await prisma.interview.findFirst({
      where: { applicationId: application.id, status: 'scheduled' },
    });
    if (!interview) {
      interview = await prisma.interview.create({
        data: {
          applicationId: application.id,
          scheduledAt: scheduleTime(3 + i, 10 + i),
          durationMinutes: 45,
          type: i === 0 ? 'video' : 'onsite',
          locationOrLink: i === 0 ? 'https://meet.google.com/abc-defg-hij' : 'Head Office, Nairobi - Room 2',
          notes: i === 0 ? 'Technical interview.' : 'Panel interview.',
          status: 'scheduled',
          inviteSentAt: null,
        },
      });
      console.log('Created interview for', r.email, '-', interview.type);
    } else {
      await prisma.interview.update({
        where: { id: interview.id },
        data: { inviteSentAt: null },
      });
      console.log('Reset inviteSentAt for existing interview:', r.email);
    }

    interviewIds.push(interview.id);
  }

  await prisma.job.updateMany({
    where: { id: { in: jobs.map((j) => j.id) } },
    data: {},
  });

  console.log('\nDone. Interview IDs to send invites:');
  console.log(JSON.stringify(interviewIds));
  console.log('\nSend invites with:');
  console.log('curl -X POST http://localhost:3000/api/test/send-invites-for-interviews -H "Content-Type: application/json" -d \'{"interviewIds":' + JSON.stringify(interviewIds) + '}\'');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
