/**
 * Dev helper (RAV-63): add a second org + membership so the org switcher can be tested.
 * Usage: npx tsx scripts/seed-dev-second-org.ts [userEmail]
 */
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = (process.argv[2] || process.env.SMOKE_LOGIN_EMAIL || 'admin@imara.co.ke')
    .trim()
    .toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user found for ${email}`);
  }

  const slug = `dev-second-${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: 'Second Org (dev)',
      slug,
      country: 'KE',
      currency: 'KES',
      updatedAt: new Date(),
    },
  });

  await prisma.organizationMembership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: user.role,
      updatedAt: new Date(),
    },
  });

  console.log(`Added ${email} to org "${org.name}" (${org.id}). Re-login and use the org switcher.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
