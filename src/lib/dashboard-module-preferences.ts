import { prisma } from '@/lib/prisma';
import { getAccountsAccess } from '@/lib/accounts-access';
import type { StaffUserType, UserRole } from '@/types/dashboard';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';

export {
  CANONICAL_MODULE_ORDER,
  getDefaultModuleOrderForUser,
  isDashboardModuleDomainId,
  orderModuleDomains,
  parseModuleOrderIds,
  sanitizeModuleOrder,
} from '@/lib/dashboard-module-order-utils';

import {
  CANONICAL_MODULE_ORDER,
  getDefaultModuleOrderForUser,
  parseModuleOrderIds,
  sanitizeModuleOrder,
} from '@/lib/dashboard-module-order-utils';

export async function resolveUserModuleOrder(userId: string): Promise<{
  moduleOrder: DashboardModuleDomainId[];
  isCustom: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dashboardModuleOrder: true,
      role: true,
      staffUserType: true,
    },
  });
  if (!user) {
    return { moduleOrder: [...CANONICAL_MODULE_ORDER], isCustom: false };
  }

  const stored = parseModuleOrderIds(user.dashboardModuleOrder);
  if (stored.length > 0) {
    return { moduleOrder: sanitizeModuleOrder(stored), isCustom: true };
  }

  const accountsAccess = await getAccountsAccess(userId, user.role);
  return {
    moduleOrder: getDefaultModuleOrderForUser({
      role: user.role as UserRole,
      staffUserType: user.staffUserType as StaffUserType,
      hasAccountsAccess: accountsAccess.hasAccountsAccess,
    }),
    isCustom: false,
  };
}

export async function setUserModuleOrder(
  userId: string,
  order: DashboardModuleDomainId[],
): Promise<DashboardModuleDomainId[]> {
  const sanitized = sanitizeModuleOrder(order);
  await prisma.user.update({
    where: { id: userId },
    data: { dashboardModuleOrder: sanitized },
  });
  return sanitized;
}

export async function clearUserModuleOrder(userId: string): Promise<DashboardModuleDomainId[]> {
  await prisma.user.update({
    where: { id: userId },
    data: { dashboardModuleOrder: null },
  });
  return (await resolveUserModuleOrder(userId)).moduleOrder;
}
