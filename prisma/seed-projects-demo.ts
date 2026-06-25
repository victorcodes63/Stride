/**
 * Seed construction site projects with milestones and tasks for the construction vertical demo.
 * Run after seed-demo-multi-vertical or seed-demo-enrichment.
 */
import { PrismaClient } from '@prisma/client';
import { allocateProjectCode } from '../src/lib/projects/project-code';

const prisma = new PrismaClient();

const CONSTRUCTION_SITES = [
  {
    name: 'Westlands Tower — Phase 1',
    department: 'Site Operations',
    status: 'active' as const,
    budgetAmount: 45_000_000,
    dueDays: 120,
    milestones: [
      { title: 'Foundation complete', status: 'done' as const, sortOrder: 1 },
      { title: 'Structural frame', status: 'in_progress' as const, sortOrder: 2 },
      { title: 'MEP rough-in', status: 'pending' as const, sortOrder: 3 },
    ],
    tasks: [
      { title: 'Pour slab level 3', status: 'in_progress' as const, priority: 'high' as const },
      { title: 'Steel delivery inspection', status: 'todo' as const, priority: 'medium' as const },
      { title: 'Subcontractor mobilization', status: 'done' as const, priority: 'medium' as const },
    ],
  },
  {
    name: 'Thika Road Depot',
    department: 'Plant & Equipment',
    status: 'active' as const,
    budgetAmount: 12_500_000,
    dueDays: 90,
    milestones: [
      { title: 'Site clearance', status: 'done' as const, sortOrder: 1 },
      { title: 'Hardstanding & drainage', status: 'in_progress' as const, sortOrder: 2 },
    ],
    tasks: [
      { title: 'Excavator hire extension', status: 'todo' as const, priority: 'high' as const },
      { title: 'QS cost report — week 8', status: 'in_progress' as const, priority: 'medium' as const },
    ],
  },
  {
    name: 'Karen Residential — Plot 14',
    department: 'Site Operations',
    status: 'planning' as const,
    budgetAmount: 8_200_000,
    dueDays: 180,
    milestones: [
      { title: 'Planning approval', status: 'in_progress' as const, sortOrder: 1 },
      { title: 'Groundworks', status: 'pending' as const, sortOrder: 2 },
    ],
    tasks: [
      { title: 'NCA submission pack', status: 'in_progress' as const, priority: 'high' as const },
      { title: 'Subcontractor RFQ — roofing', status: 'backlog' as const, priority: 'low' as const },
    ],
  },
];

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function seedConstructionProjects() {
  const clients = await prisma.outsourcingClient.findMany({
    where: { entityCode: { startsWith: 'construction__' } },
    select: { id: true, name: true, entityCode: true },
  });

  if (!clients.length) {
    console.log('→ Projects demo: no construction entities — skipped');
    return;
  }

  const admin =
    (await prisma.user.findFirst({ where: { email: 'admin@demo.getstride.co.ke' } })) ??
    (await prisma.user.findFirst({ where: { role: 'admin', isActive: true } }));

  if (!admin) {
    console.warn('→ Projects demo: no admin user — skipped');
    return;
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: admin.id },
    select: { organizationId: true },
  });
  const organizationId = membership?.organizationId;
  if (!organizationId) {
    console.warn('→ Projects demo: no organization membership — skipped');
    return;
  }

  for (const client of clients) {
    const existing = await prisma.project.count({ where: { outsourcingClientId: client.id } });
    if (existing > 0) {
      console.log(`  · ${client.name}: ${existing} projects already — skipped`);
      continue;
    }

    for (const site of CONSTRUCTION_SITES) {
      const projectCode = await allocateProjectCode(prisma, client.id);
      const startDate = daysFromNow(-30);
      const dueDate = daysFromNow(site.dueDays);

      const project = await prisma.project.create({
        data: {
          organizationId,
          outsourcingClientId: client.id,
          projectCode,
          name: site.name,
          description: `Construction site project — ${site.department}`,
          department: site.department,
          status: site.status,
          currency: 'KES',
          budgetAmount: site.budgetAmount,
          startDate,
          dueDate,
          ownerUserId: admin.id,
          createdByUserId: admin.id,
        },
      });

      const milestoneIds: string[] = [];
      for (const ms of site.milestones) {
        const milestone = await prisma.projectMilestone.create({
          data: {
            organizationId,
            projectId: project.id,
            title: ms.title,
            status: ms.status,
            sortOrder: ms.sortOrder,
            dueDate: daysFromNow(ms.sortOrder * 30),
            ...(ms.status === 'done' ? { completedAt: new Date() } : {}),
          },
        });
        milestoneIds.push(milestone.id);
      }

      for (let i = 0; i < site.tasks.length; i++) {
        const task = site.tasks[i]!;
        await prisma.projectTask.create({
          data: {
            organizationId,
            projectId: project.id,
            milestoneId: milestoneIds[Math.min(i, milestoneIds.length - 1)] ?? null,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueDate: daysFromNow(7 + i * 5),
            createdByUserId: admin.id,
            ...(task.status === 'done' ? { completedAt: new Date() } : {}),
          },
        });
      }
    }

    console.log(`  ✓ ${client.name} — ${CONSTRUCTION_SITES.length} site projects seeded`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  console.log('\nSeeding construction site projects…\n');
  await seedConstructionProjects();
  console.log('\nConstruction projects demo complete.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
