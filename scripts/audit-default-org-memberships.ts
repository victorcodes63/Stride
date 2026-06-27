#!/usr/bin/env npx tsx
/**
 * ISO-02 audit: users with membership on the default org AND another tenant org.
 * Run against production (owner URL) before/after ISO-02 deploy — review rows manually.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/audit-default-org-memberships.ts
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_ORGANIZATION_ID } from '../src/lib/org-membership';

async function main() {
  const db = new PrismaClient();
  try {
    const rows = await db.organizationMembership.findMany({
      where: {
        status: 'active',
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        organization: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const dual: typeof rows = [];
    for (const row of rows) {
      const others = await db.organizationMembership.count({
        where: {
          userId: row.userId,
          status: 'active',
          organizationId: { not: DEFAULT_ORGANIZATION_ID },
        },
      });
      if (others > 0) dual.push(row);
    }

    console.log(`Active default-org memberships: ${rows.length}`);
    console.log(`Also member of another org: ${dual.length}`);
    for (const row of dual) {
      console.log(`  ${row.user.email} (${row.userId}) role=${row.role}`);
    }
    if (dual.length > 0) {
      console.log('\nVICTOR TODO: review whether default-org membership should be removed for customer-cell users.');
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
