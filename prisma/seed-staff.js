/**
 * Seed a single staff account (for dev or initial setup).
 * Run: node prisma/seed-staff.js
 * Requires: DATABASE_URL set, migrations applied.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const STAFF_EMAIL = 'vchumo@example.com';
// Default dev password; override with STAFF_PASSWORD in production.
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'stabex-demo-hris';
const STAFF_NAME = 'Victor Chumo';
const ROUNDS = 10;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(STAFF_PASSWORD, ROUNDS);
  await prisma.user.upsert({
    where: { email: STAFF_EMAIL },
    update: {
      name: STAFF_NAME,
      passwordHash,
      role: 'staff',
      isActive: true,
    },
    create: {
      email: STAFF_EMAIL,
      name: STAFF_NAME,
      passwordHash,
      role: 'staff',
      isActive: true,
    },
  });

  console.log('Staff account password updated:', STAFF_EMAIL);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
