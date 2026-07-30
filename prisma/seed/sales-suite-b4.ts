/**
 * Phase B4 seed — ensure won-deal automation settings row exists (defaults off).
 * Run via seed-all or: npx tsx prisma/seed/sales-suite-b4.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_WON_DEAL_SETTINGS,
  WON_DEAL_SETTINGS_KEY,
} from '../../src/lib/sales/won-deal-settings';
import { systemSettingCreate, systemSettingWhere } from '../../src/lib/system-setting-store';

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const created: string[] = [];
  for (const org of orgs) {
    const existing = await prisma.systemSetting.findUnique({
      where: systemSettingWhere(org.id, WON_DEAL_SETTINGS_KEY),
    });
    if (existing) continue;
    await prisma.systemSetting.create({
      data: systemSettingCreate(
        org.id,
        WON_DEAL_SETTINGS_KEY,
        DEFAULT_WON_DEAL_SETTINGS as never,
      ),
    });
    created.push(org.name);
  }
  console.log(JSON.stringify({ orgs: orgs.length, settingsCreated: created.length, created }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
