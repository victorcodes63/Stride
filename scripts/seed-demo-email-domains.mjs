#!/usr/bin/env node
/**
 * Seed verified OrganizationEmailDomain rows for the demo org so staff login resolves
 * without falling back to DEFAULT_ORGANIZATION_ID (which may not exist on demo Neon).
 *
 * Usage: npx tsx scripts/seed-demo-email-domains.mjs
 * Env: DATABASE_URL or DIRECT_DATABASE_URL, DEMO_PACK (default cargo-logistics),
 *      STAFF_ALLOWED_DOMAIN (comma-separated)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseDomains(raw) {
  return (raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  const pack = (process.env.DEMO_PACK || 'cargo-logistics').trim();
  const slug = `demo-${pack}`;
  const domains = parseDomains(process.env.STAFF_ALLOWED_DOMAIN);
  if (domains.length === 0) {
    throw new Error('STAFF_ALLOWED_DOMAIN is empty — set demo allowed domains');
  }

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    throw new Error(`Demo org not found (slug=${slug}). Run demo seed first.`);
  }

  const now = new Date();
  for (const domain of domains) {
    await prisma.organizationEmailDomain.upsert({
      where: {
        organizationId_domain: { organizationId: org.id, domain },
      },
      create: {
        organizationId: org.id,
        domain,
        verificationToken: `demo-${domain}`,
        verifiedAt: now,
        updatedAt: now,
      },
      update: {
        verifiedAt: now,
        updatedAt: now,
      },
    });
    console.log(`✓ verified domain ${domain} → ${org.name} (${org.id})`);
  }

  await prisma.organizationAuthConfig.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      staffEnabledProviders: ['credentials'],
      essEnabledProviders: ['credentials'],
      updatedAt: now,
    },
    update: { updatedAt: now },
  });
  console.log('✓ org auth config ensured');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
