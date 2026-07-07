#!/usr/bin/env npx tsx
/**
 * RAV-283 — QA-04 deterministic seeds for demo + isolation test orgs.
 *
 * Creates:
 *  1. stride-qa-demo — all-modules enterprise entitlements (UAT / E2E)
 *  2. iso-qa-alpha / iso-qa-beta — distinct isolation orgs for QA-02
 *
 * Run: npm run db:seed-qa-orgs
 */
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

import { MODULE_DEFINITIONS, type ModuleKey } from '../src/lib/modules';
import type { DeploymentEntitlements } from '../src/lib/entitlements-types';

const PASSWORD = process.env.QA_SEED_PASSWORD ?? 'StrideQA2026!';
const PASSWORD_ROUNDS = 10;

function allModulesEntitlements(slug: string): DeploymentEntitlements {
  const modules = MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      acc[def.key as ModuleKey] = true;
      return acc;
    },
    {} as Record<ModuleKey, boolean>,
  );

  return {
    slug,
    accountStatus: 'active',
    planId: 'enterprise',
    seatLimit: 500,
    periodEnd: null,
    modules,
    features: {},
    horizontalQuota: 99,
    verticalEnginesAllowed: true,
    syncedAt: new Date().toISOString(),
  };
}

async function upsertOrg(
  db: PrismaClient,
  input: { name: string; slug: string; entitlements?: DeploymentEntitlements },
) {
  const settings = input.entitlements ? { entitlements: input.entitlements } : undefined;
  return db.organization.upsert({
    where: { slug: input.slug },
    create: {
      name: input.name,
      slug: input.slug,
      country: 'KE',
      currency: 'KES',
      settings,
      updatedAt: new Date(),
    },
    update: {
      name: input.name,
      settings,
      updatedAt: new Date(),
    },
  });
}

async function ensureStaffUser(
  db: PrismaClient,
  organizationId: string,
  email: string,
  displayName: string,
) {
  const passwordHash = await bcrypt.hash(PASSWORD, PASSWORD_ROUNDS);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({
      where: { email },
      data: { passwordHash, name: displayName, isActive: true },
    });
    await db.organizationMembership.upsert({
      where: {
        userId_organizationId: { userId: existing.id, organizationId },
      },
      update: { role: UserRole.admin, updatedAt: new Date() },
      create: {
        userId: existing.id,
        organizationId,
        role: UserRole.admin,
        updatedAt: new Date(),
      },
    });
    return existing;
  }
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      name: displayName,
      role: UserRole.admin,
      isActive: true,
    },
  });
  await db.organizationMembership.create({
    data: {
      userId: user.id,
      organizationId,
      role: UserRole.admin,
      updatedAt: new Date(),
    },
  });
  return user;
}

async function seedIsolationOrg(
  db: PrismaClient,
  slug: string,
  name: string,
  employeeEmail: string,
) {
  const org = await upsertOrg(db, { name, slug });

  let client = await db.outsourcingClient.findFirst({
    where: { organizationId: org.id },
  });
  if (!client) {
    client = await db.outsourcingClient.create({
      data: {
        organizationId: org.id,
        name: `${name} Client`,
        updatedAt: new Date(),
      },
    });
  }

  await db.employee.deleteMany({ where: { organizationId: org.id } });
  await db.employee.create({
    data: {
      organizationId: org.id,
      outsourcingClientId: client.id,
      firstName: name.split(' ')[0] ?? 'QA',
      lastName: 'Isolation',
      email: employeeEmail,
      employmentStatus: 'active',
      updatedAt: new Date(),
    },
  });

  return org;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Source .env.local before seeding.');
  }

  const db = new PrismaClient();
  const suffix = new Date().toISOString().slice(0, 10);

  try {
    const demo = await upsertOrg(db, {
      name: 'Stride QA Demo',
      slug: 'stride-qa-demo',
      entitlements: allModulesEntitlements('stride-qa-demo'),
    });

    await ensureStaffUser(db, demo.id, 'qa.demo@stride.test', 'Stride QA');

    const alpha = await seedIsolationOrg(
      db,
      'iso-qa-alpha',
      'ISO QA Alpha',
      `alpha-${suffix}@iso-qa.stride.test`,
    );
    const beta = await seedIsolationOrg(
      db,
      'iso-qa-beta',
      'ISO QA Beta',
      `beta-${suffix}@iso-qa.stride.test`,
    );

    console.log('\nQA org seed complete (RAV-283)\n');
    console.log('  Demo org (all modules):');
    console.log(`    slug: stride-qa-demo`);
    console.log(`    admin: qa.demo@stride.test / ${PASSWORD}`);
    console.log('  Isolation orgs:');
    console.log(`    alpha: iso-qa-alpha (${alpha.id})`);
    console.log(`    beta:  iso-qa-beta (${beta.id})`);
    console.log('\n  Run isolation tests: npm run test:cross-tenant\n');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
