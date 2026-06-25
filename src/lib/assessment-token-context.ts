import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { setOrgContext } from '@/lib/org-context';

const TOKEN_SETTING = 'app.assessment_access_token';

/** Candidate-facing routes: scope RLS to a single attempt via access token, then org. */
export async function withAssessmentAccessToken<T>(
  accessToken: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config(${TOKEN_SETTING}, ${accessToken}, true)`;
    const attempt = await tx.applicationAssessmentAttempt.findUnique({
      where: { accessToken },
      select: { organizationId: true },
    });
    if (!attempt) {
      throw new AssessmentTokenNotFoundError();
    }
    await setOrgContext(tx, attempt.organizationId);
    return fn(tx);
  });
}

export class AssessmentTokenNotFoundError extends Error {
  constructor() {
    super('Assessment not found.');
    this.name = 'AssessmentTokenNotFoundError';
  }
}
