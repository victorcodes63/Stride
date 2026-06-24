import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const ROUNDS = 10;

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return /\S+@\S+\.\S+/.test(trimmed) ? trimmed : null;
}

function buildDefaultEssName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || 'Employee';
}

async function getDefaultEssPasswordHash() {
  const plain = process.env.ESS_DEFAULT_PASSWORD?.trim() || 'Welcome@123';
  return bcrypt.hash(plain, ROUNDS);
}

export async function ensureEssUserForEmployee(input: {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string | null;
}) {
  const email = normalizeEmail(input.email);
  if (!email) return { createdOrUpdated: false, reason: 'missing_email' as const };

  const name = buildDefaultEssName(input.firstName, input.lastName);
  const existingByEmployee = await prisma.essPortalUser.findFirst({
    where: { employeeId: input.employeeId },
  });

  if (existingByEmployee) {
    const nextData: {
      name?: string;
      email?: string;
      isActive?: boolean;
    } = {};
    if (existingByEmployee.name !== name) nextData.name = name;
    if (existingByEmployee.email !== email) nextData.email = email;
    if (!existingByEmployee.isActive) nextData.isActive = true;
    if (Object.keys(nextData).length > 0) {
      await prisma.essPortalUser.update({
        where: { id: existingByEmployee.id },
        data: nextData,
      });
    }
    return { createdOrUpdated: Object.keys(nextData).length > 0, reason: 'linked_existing' as const };
  }

  const existingByEmail = await prisma.essPortalUser.findUnique({ where: { email } });
  if (existingByEmail) {
    await prisma.essPortalUser.update({
      where: { id: existingByEmail.id },
      data: {
        employeeId: input.employeeId,
        name,
        isActive: true,
      },
    });
    return { createdOrUpdated: true, reason: 'attached_by_email' as const };
  }

  await prisma.essPortalUser.create({
    data: {
      employeeId: input.employeeId,
      email,
      name,
      role: 'employee',
      isActive: true,
      mustResetPassword: true,
      passwordHash: await getDefaultEssPasswordHash(),
    },
  });
  return { createdOrUpdated: true, reason: 'created' as const };
}

export async function syncEssUsersForAllEmployees() {
  const employees = await prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  let createdOrUpdated = 0;
  let skippedNoEmail = 0;
  for (const employee of employees) {
    const result = await ensureEssUserForEmployee({
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
    });
    if (result.reason === 'missing_email') skippedNoEmail += 1;
    if (result.createdOrUpdated) createdOrUpdated += 1;
  }

  return {
    employeesScanned: employees.length,
    createdOrUpdated,
    skippedNoEmail,
  };
}
