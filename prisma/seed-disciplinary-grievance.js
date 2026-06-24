/**
 * Seed sample disciplinary cases + grievances for the HR dashboard demo.
 * Safe to re-run: deletes rows with reserved numbers DC-{year}-901..903 and GR-{year}-901..902, then recreates.
 *
 * Requires DATABASE_URL and at least one User + Employee in the database.
 *
 * Run (from repo root, after loading env):
 *   set -a && source .env.local 2>/dev/null; set +a && node prisma/seed-disciplinary-grievance.js
 * Or:
 *   npm run db:seed-disciplinary
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function daysFromNow(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[seed-disciplinary-grievance] DATABASE_URL is not set.');
    process.exit(1);
  }

  const year = new Date().getUTCFullYear();
  const DEMO_CASE_NUMBERS = [`DC-${year}-901`, `DC-${year}-902`, `DC-${year}-903`];
  const DEMO_GRIEVANCE_NUMBERS = [`GR-${year}-901`, `GR-${year}-902`];

  const hrUser = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!hrUser) {
    console.error('[seed-disciplinary-grievance] No active User found. Create a staff user first.');
    process.exit(1);
  }

  const employees = await prisma.employee.findMany({
    take: 6,
    orderBy: [{ employeeNumber: 'asc' }],
  });
  if (employees.length < 2) {
    console.error('[seed-disciplinary-grievance] Need at least 2 employees. Run npm run seed:demo or another employee seed first.');
    process.exit(1);
  }

  const [e0, e1, e2, e3] = [employees[0], employees[1], employees[2] ?? employees[0], employees[3] ?? employees[1]];

  const existingCases = await prisma.disciplinaryCase.findMany({
    where: { caseNumber: { in: DEMO_CASE_NUMBERS } },
    select: { id: true },
  });
  const caseIds = existingCases.map((c) => c.id);
  if (caseIds.length) {
    await prisma.disciplinaryAction.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.disciplinaryDocument.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.disciplinaryCase.deleteMany({ where: { id: { in: caseIds } } });
    console.log(`[seed-disciplinary-grievance] Removed ${caseIds.length} previous demo case(s).`);
  }

  await prisma.grievance.deleteMany({
    where: { grievanceNumber: { in: DEMO_GRIEVANCE_NUMBERS } },
  });

  const incidentPast = daysFromNow(-45);
  const incidentMid = daysFromNow(-20);

  const case1 = await prisma.disciplinaryCase.create({
    data: {
      employeeId: e0.id,
      caseNumber: DEMO_CASE_NUMBERS[0],
      type: 'ABSENTEEISM',
      status: 'OPEN',
      severity: 'MINOR',
      laborJurisdiction: 'KE',
      subject: 'Repeated late reporting — [Demo seed]',
      description:
        'Line manager reported a pattern of late clock-in for early shift (Theatres). Employee was counselled informally; formal verbal warning issued. [Demo seed]',
      incidentDate: incidentPast,
      reportedById: hrUser.id,
      showCauseResponseDueAt: null,
      hearingAt: null,
      actions: {
        create: {
          type: 'VERBAL_WARNING',
          description:
            'Verbal warning: improvement required within 14 days; repeated lateness may escalate per employer disciplinary policy and Employment Act procedures. [Demo seed]',
          actionDate: daysFromNow(-14),
          performedById: hrUser.id,
          employeeAcknowledged: true,
          acknowledgedAt: daysFromNow(-12),
        },
      },
    },
  });

  const case2 = await prisma.disciplinaryCase.create({
    data: {
      employeeId: e1.id,
      caseNumber: DEMO_CASE_NUMBERS[1],
      type: 'POLICY_VIOLATION',
      status: 'AWAITING_RESPONSE',
      severity: 'MODERATE',
      laborJurisdiction: 'KE',
      subject: 'PPE policy breach — [Demo seed]',
      description:
        'Failure to wear specified PPE in restricted area on one documented occasion; corrective coaching and written warning on file. Show-cause letter issued pending employee written explanation. [Demo seed]',
      incidentDate: incidentMid,
      reportedById: hrUser.id,
      showCauseResponseDueAt: daysFromNow(5),
      hearingAt: null,
      actions: {
        create: [
          {
            type: 'WRITTEN_WARNING',
            description: 'First written warning regarding health & safety policy compliance. [Demo seed]',
            actionDate: daysFromNow(-10),
            performedById: hrUser.id,
            employeeAcknowledged: true,
            acknowledgedAt: daysFromNow(-9),
          },
          {
            type: 'SHOW_CAUSE_LETTER',
            description:
              'Show-cause: explain in writing why further disciplinary action should not follow the documented breach. [Demo seed]',
            actionDate: daysFromNow(-3),
            performedById: hrUser.id,
            employeeAcknowledged: false,
          },
        ],
      },
    },
  });

  const case3 = await prisma.disciplinaryCase.create({
    data: {
      employeeId: e2.id,
      caseNumber: DEMO_CASE_NUMBERS[2],
      type: 'MISCONDUCT',
      status: 'HEARING_SCHEDULED',
      severity: 'SERIOUS',
      laborJurisdiction: 'UG',
      subject: 'Alleged breach of patient confidentiality — [Demo seed]',
      description:
        'Internal investigation completed; matter referred to disciplinary hearing under Uganda employment law frame (employer policy). Not real PHI — demo narrative only. [Demo seed]',
      incidentDate: daysFromNow(-30),
      reportedById: hrUser.id,
      showCauseResponseDueAt: daysFromNow(-7),
      hearingAt: daysFromNow(7),
      actions: {
        create: [
          {
            type: 'VERBAL_WARNING',
            description: 'Initial formal notice of concerns (historical step). [Demo seed]',
            actionDate: daysFromNow(-28),
            performedById: hrUser.id,
            employeeAcknowledged: true,
            acknowledgedAt: daysFromNow(-27),
          },
          {
            type: 'WRITTEN_WARNING',
            description: 'Written warning following investigation findings summary shared with employee. [Demo seed]',
            actionDate: daysFromNow(-18),
            performedById: hrUser.id,
            employeeAcknowledged: true,
            acknowledgedAt: daysFromNow(-17),
          },
          {
            type: 'HEARING',
            description:
              'Formal disciplinary hearing scheduled; employee invited to attend with union/steward if applicable per policy. [Demo seed]',
            actionDate: daysFromNow(-2),
            performedById: hrUser.id,
            employeeAcknowledged: false,
          },
        ],
      },
    },
  });

  await prisma.grievance.create({
    data: {
      employeeId: e2.id,
      grievanceNumber: DEMO_GRIEVANCE_NUMBERS[0],
      status: 'SUBMITTED',
      category: 'WORKPLACE_SAFETY',
      subject: 'Equipment maintenance backlog — [Demo seed]',
      description:
        'Concern about turnaround time for servicing a departmental device; requesting HR-facilitated discussion with facilities. [Demo seed]',
    },
  });

  await prisma.grievance.create({
    data: {
      employeeId: e3.id,
      grievanceNumber: DEMO_GRIEVANCE_NUMBERS[1],
      status: 'INVESTIGATING',
      category: 'MANAGEMENT',
      subject: 'Rota communication — [Demo seed]',
      description:
        'Short-notice shift changes via informal channels; asking for consistent written notice per policy. [Demo seed]',
      investigationNotes:
        'HR met with line manager; rota process review scheduled. [Demo seed — internal]',
    },
  });

  console.log('[seed-disciplinary-grievance] Done.');
  console.log(`  Cases: ${case1.caseNumber}, ${case2.caseNumber}, ${case3.caseNumber}`);
  console.log(`  Grievances: ${DEMO_GRIEVANCE_NUMBERS.join(', ')}`);
  console.log(`  Reporter / issuer user: ${hrUser.email}`);
}

main()
  .catch((e) => {
    if (e && e.code === 'P2021') {
      console.error(
        '[seed-disciplinary-grievance] Database tables are missing. Apply migrations first, e.g. `npm run db:migrate` or `npx prisma migrate deploy` with DATABASE_URL set.',
      );
    }
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
