/**
 * Dev helper: create Organization + OrganizationMembership when the full
 * tenancy migration has not been applied (e.g. failed mid-run on legacy DBs).
 *
 * Usage: npx tsx scripts/bootstrap-dev-tenancy.ts [adminEmail]
 */
import { randomUUID } from 'crypto';
import { PrismaClient, UserRole } from '@prisma/client';
import { DEFAULT_ORGANIZATION_ID } from '../src/lib/org-membership';

const prisma = new PrismaClient();

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function ensureOrgTables() {
  if (await tableExists('Organization')) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Organization" (
      "id" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "country" TEXT NOT NULL DEFAULT 'KE',
      "currency" TEXT NOT NULL DEFAULT 'KES',
      "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
      "settings" JSONB NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug")`,
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "OrganizationMembership" (
      "id" UUID NOT NULL,
      "userId" TEXT NOT NULL,
      "organizationId" UUID NOT NULL,
      "role" "UserRole" NOT NULL DEFAULT 'staff',
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId")`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  );

  console.log('Created Organization + OrganizationMembership tables.');
}

async function main() {
  const email = (process.argv[2] || process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || 'admin@demo.getstride.co.ke')
    .trim()
    .toLowerCase();

  await ensureOrgTables();

  await prisma.organization.upsert({
    where: { id: DEFAULT_ORGANIZATION_ID },
    update: { name: 'Default Organization', updatedAt: new Date() },
    create: {
      id: DEFAULT_ORGANIZATION_ID,
      name: 'Default Organization',
      slug: 'default',
      updatedAt: new Date(),
    },
  });

  const demoSlug = process.env.DEMO_PACK ? `demo-${process.env.DEMO_PACK}` : 'demo-imara-sacco';
  const demoName = process.env.NEXT_PUBLIC_ORG_NAME || 'Imara SACCO';
  await prisma.organization.upsert({
    where: { slug: demoSlug },
    update: { name: demoName, updatedAt: new Date() },
    create: {
      name: demoName,
      slug: demoSlug,
      updatedAt: new Date(),
    },
  });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user found for ${email}. Run demo seed or create the user first.`);
  }

  for (const organizationId of [DEFAULT_ORGANIZATION_ID, (await prisma.organization.findUnique({ where: { slug: demoSlug }, select: { id: true } }))!.id]) {
    await prisma.organizationMembership.upsert({
      where: {
        userId_organizationId: { userId: user.id, organizationId },
      },
      update: { role: user.role as UserRole, updatedAt: new Date() },
      create: {
        id: randomUUID(),
        userId: user.id,
        organizationId,
        role: user.role as UserRole,
        updatedAt: new Date(),
      },
    });
  }

  console.log(`Linked ${email} to default + demo organizations. You can sign in now.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
