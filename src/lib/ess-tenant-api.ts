import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { withOrgContext } from '@/lib/org-context';
import { requireEssUser, type EssUser } from '@/lib/ess-api-auth';
import { reportApiError } from '@/lib/monitoring';
import type { TenantAuditInput } from '@/lib/tenant-api';

export type EssTenantContext = {
  request: NextRequest;
  essUser: EssUser;
  employeeId: string | null;
  organizationId: string;
  run: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
  where: <T extends Record<string, unknown>>(extra?: T) => T & { organizationId: string };
  audit: (input: TenantAuditInput) => Promise<void>;
};

export async function withEssTenant(
  request: NextRequest,
  handler: (ctx: EssTenantContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const essUser = await requireEssUser(request);
    if (!essUser) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const organizationId = essUser.organizationId;
    const ctx: EssTenantContext = {
      request,
      essUser,
      employeeId: essUser.employeeId,
      organizationId,
      run: (fn) => withOrgContext(organizationId, fn),
      where: <T extends Record<string, unknown>>(extra?: T) =>
        ({ ...(extra ?? {}), organizationId }) as T & { organizationId: string },
      audit: (input) =>
        withOrgContext(organizationId, async (tx) => {
          await tx.auditEvent.create({
            data: {
              organizationId,
              actorEmail: essUser.email,
              action: input.action,
              entityType: input.entityType,
              entityId: input.entityId ?? null,
              route: input.route ?? null,
              metadata: input.metadata == null ? undefined : (input.metadata as Prisma.InputJsonValue),
            },
          });
        }),
    };

    return await handler(ctx);
  } catch (error) {
    const route = request.nextUrl?.pathname ?? 'unknown';
    void reportApiError({
      route,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Request failed.' }, { status: 500 });
  }
}
