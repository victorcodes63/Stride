/**
 * Seed sample training programs and announcements for demo dashboards.
 * Run after vertical reseed: npx tsx prisma/seed-training-demo.ts
 */
import { PrismaClient, TrainingStatus, EnrollmentStatus, AnnouncementStatus, AnnouncementPriority } from '@prisma/client';

const prisma = new PrismaClient();

const PROGRAMS = [
  {
    title: 'Workplace Health & Safety induction',
    category: 'Compliance',
    provider: 'Stride Academy',
    isOnline: true,
    durationHours: 4,
    status: TrainingStatus.in_progress,
  },
  {
    title: 'Leadership fundamentals for supervisors',
    category: 'Leadership',
    provider: 'Kenya Institute of Management',
    location: 'Nairobi',
    durationHours: 16,
    status: TrainingStatus.scheduled,
  },
  {
    title: 'Data protection & confidentiality (GDPR-style)',
    category: 'Compliance',
    provider: 'Internal HR',
    isOnline: true,
    durationHours: 2,
    status: TrainingStatus.completed,
  },
] as const;

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    console.warn('No admin user — skip training/announcements seed.');
    return;
  }

  const existing = await prisma.trainingProgram.count();
  if (existing === 0) {
    for (const p of PROGRAMS) {
      const program = await prisma.trainingProgram.create({
        data: {
          ...p,
          description: `${p.title} — demo program for the Stride vertical showcase.`,
          currency: 'KES',
          createdByUserId: admin.id,
          materials: {
            create: [{ title: 'Participant handbook (PDF)', sortOrder: 0 }],
          },
        },
      });

      const employees = await prisma.employee.findMany({ take: 3, orderBy: { createdAt: 'asc' } });
      for (const [i, emp] of employees.entries()) {
        await prisma.trainingEnrollment.create({
          data: {
            programId: program.id,
            employeeId: emp.id,
            enrolleeName: `${emp.firstName} ${emp.lastName}`,
            status:
              p.status === TrainingStatus.completed
                ? EnrollmentStatus.completed
                : i === 0
                  ? EnrollmentStatus.in_progress
                  : EnrollmentStatus.enrolled,
            completedAt: p.status === TrainingStatus.completed ? new Date() : null,
          },
        });
      }
    }
    console.log(`→ Training: ${PROGRAMS.length} programs seeded with enrollments.`);
  } else {
    console.log(`→ Training: ${existing} program(s) already present — skip.`);
  }

  const announcementCount = await prisma.announcement.count();
  if (announcementCount === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          title: 'Welcome to your Stride demo workspace',
          body: 'This environment is pre-seeded for sector demos. Use the company switcher to explore SACCO, fuel retail, logistics, healthcare, and travel contexts.',
          status: AnnouncementStatus.published,
          priority: AnnouncementPriority.normal,
          authorUserId: admin.id,
          publishedAt: new Date(),
          isPinned: true,
        },
        {
          title: 'Q2 compliance training window open',
          body: 'All line managers should complete the Workplace Health & Safety induction by end of month.',
          status: AnnouncementStatus.published,
          priority: AnnouncementPriority.high,
          authorUserId: admin.id,
          publishedAt: new Date(),
        },
      ],
    });
    console.log('→ Announcements: 2 published items seeded.');
  } else {
    console.log(`→ Announcements: ${announcementCount} already present — skip.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
