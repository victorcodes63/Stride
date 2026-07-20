import { brand } from '@/lib/brand';
import { isDemoSandboxCell, GENERIC_ORG_PLACEHOLDER } from '@/lib/deployment-cell';

/**
 * Public employer name when the DB is not configured (aligns with the job form default).
 *
 * Kept in its own lightweight module (no `node:crypto` / Prisma imports) so brand resolution
 * (`resolve-public-brand`) can use it without dragging server-only dependencies into client/edge
 * bundles.
 */
export function recruitmentEmployerNameFromEnv(): string {
  if (!isDemoSandboxCell()) {
    return GENERIC_ORG_PLACEHOLDER;
  }
  return (
    process.env.NEXT_PUBLIC_RECRUITMENT_EMPLOYER_NAME?.trim() ||
    process.env.RECRUITMENT_EMPLOYER_NAME?.trim() ||
    brand.orgName
  );
}
