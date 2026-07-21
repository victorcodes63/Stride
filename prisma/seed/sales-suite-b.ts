/**
 * Phase B — Standard price book backfill (B1) + approval policy seed (B2).
 *
 * Per org:
 * - Ensure "Standard" default price book + minQty=1 entries from product.unitPrice
 * - Ensure SalesApprovalPolicy with default discount ladder
 *
 * Run: npx tsx prisma/seed/sales-suite-b.ts
 */
import { PrismaClient } from '@prisma/client';
import { backfillAllOrgsDefaultPriceBooks } from '../../src/lib/sales/default-price-book';
import { backfillAllOrgsApprovalPolicies } from '../../src/lib/sales/quote-approval';

const prisma = new PrismaClient();

async function main() {
  const results = await prisma.$transaction(
    async (tx) => {
      const priceBooks = await backfillAllOrgsDefaultPriceBooks(tx);
      const policies = await backfillAllOrgsApprovalPolicies(tx);
      return { priceBooks, policies };
    },
    {
      maxWait: 60_000,
      timeout: 300_000,
    },
  );

  let booksCreated = 0;
  let entriesCreated = 0;
  let entriesAlreadySynced = 0;
  for (const r of results.priceBooks) {
    if (r.bookCreated) booksCreated += 1;
    entriesCreated += r.entriesCreated;
    entriesAlreadySynced += r.entriesAlreadySynced;
  }
  const policiesCreated = results.policies.filter((p) => p.created).length;

  console.log(
    JSON.stringify(
      {
        orgs: results.priceBooks.length,
        booksCreated,
        entriesCreated,
        entriesAlreadySynced,
        policiesCreated,
        policies: results.policies,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
