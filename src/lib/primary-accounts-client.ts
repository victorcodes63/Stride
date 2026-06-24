import type { PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function getOrCreatePrimaryAccountsClient(
  prisma: PrismaClient,
  request?: Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'> | NextRequest | null,
) {
  const workspaceId = await resolvePrimaryWorkspaceClientId(prisma, null, request ?? undefined);

  const workspace = await prisma.outsourcingClient.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    throw new Error(`OutsourcingClient not found: ${workspaceId}`);
  }

  const linked = await prisma.accountsClient.findUnique({
    where: { outsourcingClientId: workspace.id },
  });
  if (linked) return linked;

  return prisma.accountsClient.create({
    data: {
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
