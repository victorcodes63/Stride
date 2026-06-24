/**
 * RAV-65: Seed country_config packs (KE full, UG/TZ stubs).
 * Run: npm run db:country-packs (uses DIRECT_DATABASE_URL / owner for global table writes).
 */
import { PrismaClient, CountryPackKind } from '@prisma/client';
import {
  DEFAULT_KENYA_STATUTORY_RATES,
  KENYA_HOLIDAYS_2026,
  KENYA_LOCALE_PACK,
  TANZANIA_STATUTORY_STUB,
  UGANDA_STATUTORY_STUB,
} from '../src/lib/country-config';

const EFFECTIVE_FROM = new Date('2026-01-01');

const packs: Array<{
  country: string;
  kind: CountryPackKind;
  config: unknown;
}> = [
  { country: 'KE', kind: CountryPackKind.statutory, config: DEFAULT_KENYA_STATUTORY_RATES },
  { country: 'KE', kind: CountryPackKind.locale, config: KENYA_LOCALE_PACK },
  { country: 'KE', kind: CountryPackKind.holidays, config: KENYA_HOLIDAYS_2026 },
  { country: 'UG', kind: CountryPackKind.statutory, config: UGANDA_STATUTORY_STUB },
  {
    country: 'UG',
    kind: CountryPackKind.locale,
    config: { currency: 'UGX', locale: 'en-UG', timezone: 'Africa/Kampala' },
  },
  { country: 'UG', kind: CountryPackKind.holidays, config: { holidays: [] } },
  { country: 'TZ', kind: CountryPackKind.statutory, config: TANZANIA_STATUTORY_STUB },
  {
    country: 'TZ',
    kind: CountryPackKind.locale,
    config: { currency: 'TZS', locale: 'sw-TZ', timezone: 'Africa/Dar_es_Salaam' },
  },
  { country: 'TZ', kind: CountryPackKind.holidays, config: { holidays: [] } },
];

async function seed() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL or DIRECT_DATABASE_URL required');
  const db = new PrismaClient({ datasources: { db: { url } } });

  try {
    for (const pack of packs) {
      const existing = await db.countryConfig.findFirst({
        where: {
          country: pack.country,
          kind: pack.kind,
          effectiveFrom: EFFECTIVE_FROM,
        },
      });
      if (existing) {
        await db.countryConfig.update({
          where: { id: existing.id },
          data: { config: pack.config as object },
        });
      } else {
        await db.countryConfig.create({
          data: {
            country: pack.country,
            kind: pack.kind,
            effectiveFrom: EFFECTIVE_FROM,
            config: pack.config as object,
          },
        });
      }
      console.log(`✓ ${pack.country} ${pack.kind}`);
    }
    console.log('Country packs seeded.');
  } finally {
    await db.$disconnect();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
