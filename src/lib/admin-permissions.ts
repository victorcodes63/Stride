import { prisma } from '@/lib/prisma';
import type { UserRole } from '@/types/dashboard';

export type PermissionSeed = {
  key: string;
  label: string;
  module: string;
  description: string;
  defaults: Record<UserRole, boolean>;
};

export const PERMISSION_SEEDS: PermissionSeed[] = [
  {
    key: 'users.manage',
    label: 'Manage system users',
    module: 'Admin',
    description: 'Create, update, and deactivate internal staff users.',
    defaults: { admin: true, staff: false, viewer: false },
  },
  {
    key: 'ess.manage',
    label: 'Manage ESS users',
    module: 'ESS',
    description: 'Provision and update self-service portal users.',
    defaults: { admin: true, staff: false, viewer: false },
  },
  {
    key: 'audit.view',
    label: 'View audit log',
    module: 'Admin',
    description: 'Access immutable admin/system activity trails.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'settings.manage',
    label: 'Manage system settings',
    module: 'Settings',
    description: 'Change global organization and policy settings.',
    defaults: { admin: true, staff: false, viewer: false },
  },
  {
    key: 'payroll.approve',
    label: 'Approve payroll runs',
    module: 'Payroll',
    description: 'Approve payroll batches before payment.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'payroll.export.bulk',
    label: 'Run payroll/bulk exports',
    module: 'Payroll',
    description: 'Generate bank exports and other bulk payroll output files.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'statutory.submit',
    label: 'Submit statutory returns',
    module: 'Payroll',
    description: 'Prepare and submit PAYE/NSSF/SHIF/AHL monthly statutory obligations.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'finance.critical.write',
    label: 'Execute critical finance actions',
    module: 'Accounts',
    description: 'Create invoices, vendor bills, and other high-impact finance entries.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'sales.admin',
    label: 'Administer sales settings',
    module: 'Sales',
    description: 'Manage price books, products settings, and sales admin configuration.',
    defaults: { admin: true, staff: false, viewer: false },
  },
  {
    key: 'sales.manage',
    label: 'Manage sales CRM',
    module: 'Sales',
    description: 'Create and update deals, quotes, contacts, and view product margins.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'sales.manage_commissions',
    label: 'Manage sales commissions and targets',
    module: 'Sales',
    description: 'Approve targets and manage commission rules / payroll push.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'sales.approve_quotes',
    label: 'Approve sales quote discounts',
    module: 'Sales',
    description: 'Approve or reject quote discount requests above policy thresholds.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'sales.orders',
    label: 'Manage sales orders',
    module: 'Sales',
    description: 'Create, confirm, ship, and invoice sales orders.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'sales.credit_override',
    label: 'Override sales credit warnings',
    module: 'Sales',
    description: 'Acknowledge credit-hold warnings when confirming orders or invoicing.',
    defaults: { admin: true, staff: true, viewer: false },
  },
  {
    key: 'inventory.manage',
    label: 'Manage inventory',
    module: 'Inventory',
    description: 'Receive stock, adjust levels, and view ATP across warehouses.',
    defaults: { admin: true, staff: true, viewer: false },
  },
];

export async function ensurePermissionCatalog(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const allDefs = await Promise.all(
    PERMISSION_SEEDS.map((seed) =>
      prisma.permissionDefinition.upsert({
        where: { key: seed.key },
        update: {
          label: seed.label,
          module: seed.module,
          description: seed.description,
        },
        create: {
          key: seed.key,
          label: seed.label,
          module: seed.module,
          description: seed.description,
        },
      }),
    ),
  );

  for (const seed of PERMISSION_SEEDS) {
    const def = allDefs.find((row) => row.key === seed.key);
    if (!def) continue;
    for (const role of ['admin', 'staff', 'viewer'] as const) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: def.id } },
        update: {},
        create: {
          role,
          permissionId: def.id,
          isAllowed: seed.defaults[role],
        },
      });
    }
  }
}
