/**
 * RAV-62: Prove Org A data is invisible to Org B under Postgres RLS.
 * Requires a DB role without BYPASSRLS (Neon `neondb_owner` bypasses RLS — use an app role in production).
 */
import { prisma } from '../src/lib/prisma';
import { withOrgContext } from '../src/lib/org-context';

async function assertAppRoleForRls() {
  const [role] = await prisma.$queryRaw<{ rolname: string; rolbypassrls: boolean }[]>`
    SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  if (role?.rolbypassrls) {
    throw new Error(
      `Current DB role "${role.rolname}" has BYPASSRLS — RLS is not enforced. ` +
        'Create a Neon application role without BYPASSRLS and point DATABASE_URL at it for tenant isolation.',
    );
  }
}

async function createOrg(name: string, slug: string) {
  return prisma.organization.create({
    data: {
      name,
      slug,
      country: 'KE',
      currency: 'KES',
      updatedAt: new Date(),
    },
  });
}

async function main() {
  await assertAppRoleForRls();

  const suffix = Date.now();
  const orgA = await createOrg('Org Alpha Test', `org-alpha-${suffix}`);
  const orgB = await createOrg('Org Beta Test', `org-beta-${suffix}`);

  await withOrgContext(orgA.id, async (tx) => {
    await tx.auditEvent.create({
      data: {
        organizationId: orgA.id,
        action: 'test.created',
        entityType: 'test',
        entityId: 'alpha',
        actorEmail: `rls-a-${suffix}@example.com`,
      },
    });
  });

  let leaked = false;
  await withOrgContext(orgB.id, async (tx) => {
    const rows = await tx.auditEvent.findMany({ where: { entityId: 'alpha' } });
    if (rows.some((row) => row.organizationId === orgA.id)) {
      leaked = true;
    }
  });

  await prisma.auditEvent.deleteMany({
    where: { organizationId: { in: [orgA.id, orgB.id] } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [orgA.id, orgB.id] } },
  });

  if (leaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A audit rows');
  }

  console.log('RLS isolation check passed for AuditEvent.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
