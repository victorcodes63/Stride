/**
 * Seed sample training programs and announcements for demo dashboards.
 * Run after vertical reseed: npx tsx prisma/seed-training-demo.ts
 */
import { PrismaClient, TrainingStatus, EnrollmentStatus, AnnouncementStatus, AnnouncementPriority } from '@prisma/client';

const prisma = new PrismaClient();

type MaterialSpec = { title: string; externalUrl?: string; filePath?: string; sortOrder: number };
type EnrollmentSpec = {
  status: EnrollmentStatus;
  score?: number;
  feedback?: string;
  completed?: boolean;
};
type ProgramSpec = {
  title: string;
  category: string;
  provider: string;
  location?: string;
  isOnline?: boolean;
  durationHours: number;
  maxParticipants?: number;
  cost?: number;
  status: TrainingStatus;
  materials: MaterialSpec[];
  enrollments: EnrollmentSpec[];
};

const PROGRAMS: ProgramSpec[] = [
  {
    title: 'Workplace Health & Safety induction',
    category: 'Compliance',
    provider: 'Stride Academy',
    isOnline: true,
    durationHours: 4,
    maxParticipants: 40,
    cost: 0,
    status: TrainingStatus.in_progress,
    materials: [
      { title: 'Participant handbook (PDF)', filePath: 'training/hse-handbook.pdf', sortOrder: 0 },
      { title: 'OSHA workplace safety overview', externalUrl: 'https://www.osha.gov/workers', sortOrder: 1 },
    ],
    enrollments: [
      { status: EnrollmentStatus.in_progress },
      { status: EnrollmentStatus.enrolled },
      { status: EnrollmentStatus.completed, score: 92, feedback: 'Clear and practical.', completed: true },
      { status: EnrollmentStatus.withdrawn, feedback: 'Reassigned to a later cohort.' },
    ],
  },
  {
    title: 'Leadership fundamentals for supervisors',
    category: 'Leadership',
    provider: 'Kenya Institute of Management',
    location: 'Nairobi',
    durationHours: 16,
    maxParticipants: 25,
    cost: 45000,
    status: TrainingStatus.scheduled,
    materials: [
      { title: 'Pre-reading: Situational leadership', externalUrl: 'https://hbr.org/topic/leadership', sortOrder: 0 },
      { title: 'Course syllabus', filePath: 'training/leadership-syllabus.pdf', sortOrder: 1 },
      { title: 'Reflection worksheet', filePath: 'training/leadership-worksheet.docx', sortOrder: 2 },
    ],
    enrollments: [
      { status: EnrollmentStatus.enrolled },
      { status: EnrollmentStatus.enrolled },
      { status: EnrollmentStatus.in_progress },
    ],
  },
  {
    title: 'Data protection & confidentiality (GDPR-style)',
    category: 'Compliance',
    provider: 'Internal HR',
    isOnline: true,
    durationHours: 2,
    maxParticipants: 100,
    cost: 0,
    status: TrainingStatus.completed,
    materials: [
      { title: 'Data Protection Act (Kenya) reference', externalUrl: 'https://www.odpc.go.ke/', sortOrder: 0 },
      { title: 'Confidentiality policy', filePath: 'training/confidentiality-policy.pdf', sortOrder: 1 },
    ],
    enrollments: [
      { status: EnrollmentStatus.completed, score: 88, feedback: 'Very relevant to daily work.', completed: true },
      { status: EnrollmentStatus.completed, score: 95, feedback: 'Excellent refresher.', completed: true },
      { status: EnrollmentStatus.failed, score: 41, feedback: 'Needs to retake the assessment.', completed: true },
    ],
  },
  {
    title: 'Advanced Excel for finance teams',
    category: 'Technical',
    provider: 'Stride Academy',
    isOnline: true,
    durationHours: 8,
    maxParticipants: 20,
    cost: 12000,
    status: TrainingStatus.cancelled,
    materials: [
      { title: 'Sample workbook', filePath: 'training/excel-sample.xlsx', sortOrder: 0 },
      { title: 'Microsoft Excel functions reference', externalUrl: 'https://support.microsoft.com/excel', sortOrder: 1 },
    ],
    enrollments: [
      { status: EnrollmentStatus.withdrawn, feedback: 'Cohort cancelled — low sign-up.' },
      { status: EnrollmentStatus.enrolled },
    ],
  },
];

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
    const employees = await prisma.employee.findMany({ take: 12, orderBy: { createdAt: 'asc' } });
    let enrollmentCount = 0;
    let materialCount = 0;

    for (const p of PROGRAMS) {
      const program = await prisma.trainingProgram.create({
        data: {
          title: p.title,
          description: `${p.title} — demo program for the Stride vertical showcase.`,
          category: p.category,
          provider: p.provider,
          location: p.location ?? null,
          isOnline: p.isOnline ?? false,
          durationHours: p.durationHours,
          maxParticipants: p.maxParticipants ?? null,
          cost: p.cost ?? null,
          currency: 'KES',
          status: p.status,
          createdByUserId: admin.id,
          materials: {
            create: p.materials.map((m) => ({
              title: m.title,
              externalUrl: m.externalUrl ?? null,
              filePath: m.filePath ?? null,
              sortOrder: m.sortOrder,
            })),
          },
        },
      });
      materialCount += p.materials.length;

      for (const [i, spec] of p.enrollments.entries()) {
        // Pair each enrollment with a distinct employee when available so the
        // @@unique([programId, employeeId]) constraint is respected; fall back
        // to a name-only enrollment (null employeeId, which NULLs treat as
        // distinct) once we run out of demo employees.
        const emp = employees[i];
        await prisma.trainingEnrollment.create({
          data: {
            programId: program.id,
            employeeId: emp?.id ?? null,
            enrolleeName: emp ? `${emp.firstName} ${emp.lastName}` : `Demo Enrollee ${i + 1}`,
            status: spec.status,
            score: spec.score ?? null,
            feedback: spec.feedback ?? null,
            completedAt: spec.completed ? new Date() : null,
          },
        });
        enrollmentCount += 1;
      }
    }
    console.log(
      `→ Training: ${PROGRAMS.length} programs seeded with ${enrollmentCount} enrollments and ${materialCount} materials.`,
    );
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
