import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const counts = {
    essPortalUser: await prisma.essPortalUser.count(),
    user: await prisma.user.count(),
    employee: await prisma.employee.count(),
    outsourcingClient: await prisma.outsourcingClient.count(),
    job: await prisma.job.count(),
    systemSetting: await prisma.systemSetting.count(),
    client: await prisma.client.count(),
  };

  const ess = await prisma.essPortalUser.findMany({
    select: { email: true, name: true, employeeId: true },
  });
  const staff = await prisma.user.findMany({ select: { email: true, role: true } });
  const settings = await prisma.systemSetting.findMany({ select: { key: true } });

  console.log('Row counts:', counts);
  console.log('ESS users:', ess);
  console.log('Staff users:', staff);
  console.log('System settings:', settings.map((s) => s.key));
}

main()
  .finally(() => prisma.$disconnect());
