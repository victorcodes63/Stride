import type { Prisma, PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

type DbClient = PrismaClient | Prisma.TransactionClient;
type RequestLike = Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'> | NextRequest;

export async function getOrCreatePrimaryAccountsClient(
  db: DbClient,
  organizationIdOrRequest?: string | RequestLike | null,
  request?: RequestLike | null,
) {
  let organizationId: string | undefined;
  let req = request;
  if (typeof organizationIdOrRequest === 'string') {
    organizationId = organizationIdOrRequest;
  } else if (organizationIdOrRequest) {
    req = organizationIdOrRequest;
  }

  if (!organizationId) {
    const existing = await db.accountsClient.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    throw new Error('organizationId is required to create the primary accounts client.');
  }

  const workspaceId = await resolvePrimaryWorkspaceClientId(db, null, req ?? undefined, organizationId);

  const workspace = await db.outsourcingClient.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    throw new Error(`OutsourcingClient not found: ${workspaceId}`);
  }

  const linked = await db.accountsClient.findUnique({
    where: { outsourcingClientId: workspace.id },
  });
  if (linked) return linked;

  return db.accountsClient.create({
    data: {
      organizationId: workspace.organizationId,
      type: 'outsourcing',
      outsourcingClientId: workspace.id,
      name: workspace.name,
      currency: workspace.currency || 'KES',
      contactName: workspace.contactName || null,
      contactEmail: workspace.contactEmail || null,
      contactPhone: workspace.contactPhone || null,
    },
  });
}
