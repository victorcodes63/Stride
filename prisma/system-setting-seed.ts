import type { Prisma, PrismaClient } from '@prisma/client';

/** Default org from RAV-62 tenancy backfill — used by demo/production seeds. */
export const SEED_DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

type Db = PrismaClient | Prisma.TransactionClient;

export function systemSettingUpsert(
  db: Db,
  organizationId: string,
  key: string,
  value: Prisma.InputJsonValue,
) {
  return db.systemSetting.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: { value },
    create: { organizationId, key, value },
  });
}
