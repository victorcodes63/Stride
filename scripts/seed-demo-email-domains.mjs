#!/usr/bin/env node
/**
 * Seed verified OrganizationEmailDomain rows for demo org(s) so staff login resolves
 * without falling back to DEFAULT_ORGANIZATION_ID (which may not exist on demo Neon).
 *
 * Usage: npx tsx scripts/seed-demo-email-domains.mjs
 * Env: DATABASE_URL or DIRECT_DATABASE_URL,
 *      STAFF_ALLOWED_DOMAIN (comma-separated),
 *      DEMO_MULTI_CONTEXT=true → single shared org demo-multi-vertical,
 *      else DEMO_PACK (default cargo-logistics) → single org slug demo-${pack}
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MULTI_VERTICAL_ORG_SLUG = 'demo-multi-vertical';

function parseDomains(raw) {
  return (raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

async function ensureDomainsForOrg(org, domains) {
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
    console.log(`✓ verified domain ${domain} → ${org.name} (${org.slug})`);
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
  console.log(`✓ org auth config ensured (${org.slug})`);
}

async function main() {
  const domains = parseDomains(process.env.STAFF_ALLOWED_DOMAIN);
  if (domains.length === 0) {
    throw new Error('STAFF_ALLOWED_DOMAIN is empty — set demo allowed domains');
  }

  const multi = process.env.DEMO_MULTI_CONTEXT === 'true';
  /** @type {Array<{ id: string; name: string; slug: string }>} */
  let orgs = [];

  if (multi) {
    const org = await prisma.organization.findUnique({ where: { slug: MULTI_VERTICAL_ORG_SLUG } });
    if (!org) {
      throw new Error(
        `Shared demo org not found (slug=${MULTI_VERTICAL_ORG_SLUG}). Run multi-vertical seed first.`,
      );
    }
    orgs = [org];

    // Remove ambiguous imara.co.ke (and other STAFF domains) from leftover per-pack orgs
    // so login always resolves to the shared tenant.
    const stale = await prisma.organizationEmailDomain.findMany({
      where: {
        domain: { in: domains },
        organizationId: { not: org.id },
      },
      select: { id: true, domain: true, organizationId: true },
    });
    if (stale.length > 0) {
      await prisma.organizationEmailDomain.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      });
      console.log(`→ Removed ${stale.length} ambiguous domain row(s) from non-shared orgs`);
    }
  } else {
    const pack = (process.env.DEMO_PACK || 'cargo-logistics').trim();
    const slug = `demo-${pack}`;
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      throw new Error(`Demo org not found (slug=${slug}). Run demo seed first.`);
    }
    orgs = [org];
  }

  for (const org of orgs) {
    await ensureDomainsForOrg(org, domains);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
