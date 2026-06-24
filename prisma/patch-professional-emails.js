/**
 * Rewrite sandbox-style staff emails to professional addresses (data preserved).
 * Also renames generic admin placeholder names for client-facing demos.
 * Run: npm run db:patch-emails
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function professionalizeEmail(email) {
  const lower = email.toLowerCase().trim();
  const at = lower.lastIndexOf('@');
  if (at <= 0) return lower;

  let local = lower.slice(0, at);
  let domain = lower.slice(at + 1);

  const localRewrites = {
    'demo-admin': 'admin',
    'demo-approver': 'wanjiku.mwangi',
    'demo-staff': 'james.otieno',
  };
  if (localRewrites[local]) {
    local = localRewrites[local];
  } else if (local.startsWith('demo-')) {
    local = local.slice(5);
  } else if (local.endsWith('.demo')) {
    local = local.slice(0, -5);
  } else if (local === 'demo') {
    local = 'admin';
  }

  if (domain === 'eaglehr' || domain === 'eaglehr.demo') {
    domain = 'eaglehr.co.ke';
  }

  domain = domain
    .replace(/\.demo(?=\.|$)/gi, '')
    .replace(/^demo\./i, '');

  return `${local}@${domain}`;
}

const ADMIN_NAME = 'Amina Njeri';

async function patchAdminNames() {
  const admins = await prisma.user.findMany({
    where: {
      role: 'admin',
      name: { in: ['System Administrator', 'System Admin', 'Admin'] },
    },
    select: { id: true, email: true, name: true },
  });

  let updated = 0;
  for (const user of admins) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: ADMIN_NAME },
    });
    console.log('Renamed admin:', user.email, user.name, '→', ADMIN_NAME);
    updated++;
  }
  return updated;
}

async function main() {
  const namesUpdated = await patchAdminNames();
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const next = professionalizeEmail(user.email);
    if (next === user.email.toLowerCase()) continue;

    const clash = await prisma.user.findUnique({ where: { email: next } });
    if (clash && clash.id !== user.id) {
      console.warn('Skip (collision):', user.email, '→', next);
      skipped++;
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { email: next },
    });
    console.log('Updated:', user.email, '→', next);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} emails, ${skipped} skipped, ${namesUpdated} admin name(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
