/**
 * Minimal production seed for a dedicated client deployment.
 *
 * Creates: workspace, admin user, RBAC catalog, Kenyan public holidays,
 * employee + staff leave types, recruitment settings, onboarding templates.
 *
 * Run after migrations on a fresh database:
 *   npm run seed:production
 *
 * Required env:
 *   PROVISION_ADMIN_EMAIL
 *   PROVISION_ADMIN_PASSWORD (or STAFF_PASSWORD)
 *
 * Recommended env:
 *   PROVISION_ORG_NAME, NEXT_PUBLIC_ORG_NAME, NEXT_PUBLIC_APP_NAME
 *   PROVISION_EMPLOYEE_PREFIX, PROVISION_CURRENCY, DEFAULT_COUNTRY=KE
 *   STAFF_ALLOWED_DOMAIN (must include admin email domain)
 */

import { PrismaClient, UserRole, StaffUserType, LeaveAccrualMode } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getProvisionAdminConfig, getWorkspaceDefaults, isMultiEntityEnvEnabled } from '../src/lib/deployment-config';
import { DEFAULT_COMPANY_SETUP, COMPANY_SETUP_SETTINGS_KEY } from '../src/lib/company-setup';
import {
  OPERATING_ENTITIES_SETTINGS_KEY,
  buildDefaultOperatingEntitiesSettings,
  sanitizeOperatingEntitiesSettings,
  syncOperatingEntitiesToOutsourcingClients,
} from '../src/lib/operating-entities';
import { ensurePermissionCatalog } from '../src/lib/admin-permissions';
import { getOrCreatePrimaryWorkspaceClient } from '../src/lib/primary-workspace-client';

const prisma = new PrismaClient();
const PASSWORD_ROUNDS = 10;

const KENYAN_HOLIDAYS = [
  { name: "New Year's Day", recurDay: 1, recurMonth: 1, recurring: true },
  { name: 'Labour Day', recurDay: 1, recurMonth: 5, recurring: true },
  { name: 'Madaraka Day', recurDay: 1, recurMonth: 6, recurring: true },
  { name: 'Mashujaa Day', recurDay: 20, recurMonth: 10, recurring: true },
  { name: 'Jamhuri Day', recurDay: 12, recurMonth: 12, recurring: true },
  { name: 'Christmas Day', recurDay: 25, recurMonth: 12, recurring: true },
  { name: 'Boxing Day', recurDay: 26, recurMonth: 12, recurring: true },
  { name: 'Utamaduni Day', recurDay: 10, recurMonth: 10, recurring: true },
];

const EMPLOYEE_LEAVE_TYPES = [
  { name: 'Annual Leave', daysPerYear: 21 },
  { name: 'Sick Leave', daysPerYear: 14 },
  { name: 'Compassionate Leave', daysPerYear: 5 },
  { name: 'Maternity Leave', daysPerYear: 90 },
  { name: 'Paternity Leave', daysPerYear: 14 },
  { name: 'Unpaid Leave', daysPerYear: 0 },
];

const STAFF_LEAVE_TYPES = [
  { name: 'Annual leave', daysPerYear: 21, color: '#043d4a', sortOrder: 0, description: 'Standard annual entitlement.' },
  { name: 'Sick leave', daysPerYear: 7, color: '#b45309', sortOrder: 1, description: 'Paid sick days.' },
  { name: 'Compassionate', daysPerYear: 5, color: '#64748b', sortOrder: 2 },
  { name: 'Unpaid leave', daysPerYear: 0, color: '#94a3b8', sortOrder: 99 },
];

async function seedPublicHolidays() {
  for (const h of KENYAN_HOLIDAYS) {
    const existing = await prisma.publicHoliday.findFirst({
      where: { name: h.name, recurring: h.recurring },
    });
    if (existing) continue;
    await prisma.publicHoliday.create({
      data: {
        name: h.name,
        recurDay: h.recurDay,
        recurMonth: h.recurMonth,
        recurring: h.recurring,
      },
    });
  }
}

async function seedEmployeeLeaveTypes(workspaceId: string) {
  for (const lt of EMPLOYEE_LEAVE_TYPES) {
    const existing = await prisma.leaveType.findFirst({ where: { name: lt.name } });
    if (!existing) {
      await prisma.leaveType.create({ data: lt });
    }
  }

  const leavePolicy = await prisma.leavePolicy.upsert({
    where: { id: `default-leave-${workspaceId}` },
    update: {
      outsourcingClientId: workspaceId,
      name: 'Standard Leave Policy',
      description: 'Default leave policy for this organisation.',
      isDefault: true,
      isActive: true,
    },
    create: {
      id: `default-leave-${workspaceId}`,
      outsourcingClientId: workspaceId,
      name: 'Standard Leave Policy',
      description: 'Default leave policy for this organisation.',
      isDefault: true,
      isActive: true,
    },
  });

  for (const lt of EMPLOYEE_LEAVE_TYPES) {
    const leaveType = await prisma.leaveType.findFirst({ where: { name: lt.name } });
    if (!leaveType) continue;
    const accrualMode =
      lt.daysPerYear > 0 ? LeaveAccrualMode.monthly_accrual : LeaveAccrualMode.annual_grant;
    await prisma.leavePolicyRule.upsert({
      where: {
        leavePolicyId_leaveTypeId: { leavePolicyId: leavePolicy.id, leaveTypeId: leaveType.id },
      },
      update: {
        accrualMode,
        annualEntitlement: lt.daysPerYear,
        monthlyAccrualDays: lt.daysPerYear > 0 ? lt.daysPerYear / 12 : 0,
        requiresApproval: lt.name !== 'Unpaid Leave',
        active: true,
      },
      create: {
        leavePolicyId: leavePolicy.id,
        leaveTypeId: leaveType.id,
        accrualMode,
        annualEntitlement: lt.daysPerYear,
        monthlyAccrualDays: lt.daysPerYear > 0 ? lt.daysPerYear / 12 : 0,
        requiresApproval: lt.name !== 'Unpaid Leave',
        active: true,
      },
    });
  }
}

async function seedStaffLeaveTypes(adminUserId: string) {
  const year = new Date().getFullYear();
  for (const t of STAFF_LEAVE_TYPES) {
    const existing = await prisma.staffLeaveType.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.staffLeaveType.create({ data: { ...t, active: true } });
    }
  }
  const types = await prisma.staffLeaveType.findMany({ where: { active: true } });
  for (const t of types) {
    await prisma.staffLeaveBalance.upsert({
      where: {
        userId_leaveTypeId_year: { userId: adminUserId, leaveTypeId: t.id, year },
      },
      update: {},
      create: {
        userId: adminUserId,
        leaveTypeId: t.id,
        year,
        entitledDays: t.daysPerYear,
        usedDays: 0,
        carriedOver: 0,
      },
    });
  }
}

async function seedRecruitmentSettings(orgName: string, contactEmail: string | null) {
  const existing = await prisma.recruitmentSettings.findUnique({ where: { id: 'default' } });
  if (existing) return;

  const client = await prisma.client.create({
    data: {
      name: orgName,
      isAnonymous: false,
      contactEmail,
    },
  });

  await prisma.recruitmentSettings.create({
    data: {
      id: 'default',
      employerName: orgName,
      contactEmail,
      linkedClientId: client.id,
    },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const admin = getProvisionAdminConfig();
  const workspaceDefaults = getWorkspaceDefaults();
  console.log(`Provisioning workspace: ${workspaceDefaults.name}`);

  const multiEntity = isMultiEntityEnvEnabled();
  let entitySettings = buildDefaultOperatingEntitiesSettings(workspaceDefaults.name);

  if (multiEntity) {
    entitySettings = sanitizeOperatingEntitiesSettings({
      multiEntityEnabled: true,
      defaultEntityId: workspaceDefaults.entityCode,
      entities: [
        {
          id: 'ke',
          legalName: `${workspaceDefaults.name} (Kenya)`,
          countryCode: 'KE',
          currency: 'KES',
          employeeNumberPrefix: `${workspaceDefaults.employeeNumberPrefix}-KE`,
          isActive: true,
        },
        {
          id: 'ug',
          legalName: `${workspaceDefaults.name} (Uganda)`,
          countryCode: 'UG',
          currency: 'UGX',
          employeeNumberPrefix: `${workspaceDefaults.employeeNumberPrefix}-UG`,
          isActive: true,
        },
      ],
    });
  }

  await syncOperatingEntitiesToOutsourcingClients(prisma, entitySettings);

  let workspace = await prisma.outsourcingClient.findFirst({
    where: { entityCode: entitySettings.defaultEntityId },
    orderBy: { createdAt: 'asc' },
  });
  if (workspace) {
    workspace = await prisma.outsourcingClient.update({
      where: { id: workspace.id },
      data: {
        name: entitySettings.entities.find((e) => e.id === workspace!.entityCode)?.legalName ?? workspaceDefaults.name,
        employeeNumberPrefix: workspaceDefaults.employeeNumberPrefix,
        currency: workspaceDefaults.currency,
        contactName: workspaceDefaults.contactName,
        contactEmail: workspaceDefaults.contactEmail,
        contactPhone: workspaceDefaults.contactPhone,
        entityCode: workspace.entityCode ?? workspaceDefaults.entityCode,
      },
    });
  } else {
    workspace = await getOrCreatePrimaryWorkspaceClient(prisma);
  }

  const passwordHash = await bcrypt.hash(admin.password, PASSWORD_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email: admin.email.toLowerCase() },
    update: {
      name: admin.name,
      passwordHash,
      role: UserRole.admin,
      staffUserType: StaffUserType.director,
      isActive: true,
    },
    create: {
      email: admin.email.toLowerCase(),
      name: admin.name,
      passwordHash,
      role: UserRole.admin,
      staffUserType: StaffUserType.director,
      isActive: true,
    },
  });

  await ensurePermissionCatalog();

  await seedPublicHolidays();
  await seedEmployeeLeaveTypes(workspace.id);
  await seedStaffLeaveTypes(user.id);
  await seedRecruitmentSettings(workspaceDefaults.name, workspaceDefaults.contactEmail);

  await prisma.systemSetting.upsert({
    where: { key: COMPANY_SETUP_SETTINGS_KEY },
    update: { value: DEFAULT_COMPANY_SETUP },
    create: { key: COMPANY_SETUP_SETTINGS_KEY, value: DEFAULT_COMPANY_SETUP },
  });

  await prisma.systemSetting.upsert({
    where: { key: OPERATING_ENTITIES_SETTINGS_KEY },
    update: { value: entitySettings },
    create: { key: OPERATING_ENTITIES_SETTINGS_KEY, value: entitySettings },
  });

  const deptCount = await prisma.department.count({
    where: { outsourcingClientId: workspace.id },
  });
  if (deptCount === 0) {
    await prisma.department.create({
      data: {
        outsourcingClientId: workspace.id,
        name: 'General',
      },
    });
  }

  console.log('\nProduction seed complete.');
  console.log(`  Organisation: ${workspace.name}`);
  console.log(`  Admin login:  ${user.email}`);
  console.log(`  Staff login:  /dashboard/login`);
  console.log('\nNext: run onboarding templates seed if needed:');
  console.log('  npm run db:seed-onboarding-templates');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
