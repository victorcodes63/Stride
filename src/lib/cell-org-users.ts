import type { UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { withOrgContext } from "@/lib/org-context";

export type TenantOrgUserRow = {
  userId: string;
  membershipId: string;
  email: string;
  name: string;
  role: UserRole;
  globalRole: UserRole;
  staffUserType: string;
  isActive: boolean;
  membershipStatus: string;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLES: UserRole[] = ["admin", "staff", "viewer"];

export function parseOrgUserRole(value: unknown): UserRole | null {
  if (value === "admin" || value === "staff" || value === "viewer") return value;
  return null;
}

export async function listOrganizationUsers(organizationId: string): Promise<TenantOrgUserRow[]> {
  const rows = await withOrgContext(organizationId, (tx) =>
    tx.organizationMembership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            staffUserType: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ user: { name: "asc" } }],
    }),
  );

  return rows.map((row) => ({
    userId: row.user.id,
    membershipId: row.id,
    email: row.user.email,
    name: row.user.name,
    role: row.role,
    globalRole: row.user.role,
    staffUserType: row.user.staffUserType,
    isActive: row.user.isActive,
    membershipStatus: row.status,
    lastLoginAt: row.user.lastLoginAt?.toISOString() ?? null,
    createdAt: row.user.createdAt.toISOString(),
  }));
}

export async function createOrganizationUser(input: {
  organizationId: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
}): Promise<TenantOrgUserRow> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Valid email is required.");
  if (!input.name.trim()) throw new Error("Name is required.");
  if (input.password.length < 6) throw new Error("Password must be at least 6 characters.");
  if (!ROLES.includes(input.role)) throw new Error("Invalid role.");

  const passwordHash = await hash(input.password, 12);

  return withOrgContext(input.organizationId, async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      create: {
        email,
        name: input.name.trim(),
        role: input.role,
        staffUserType: "operations",
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      },
      update: {
        name: input.name.trim(),
        isActive: true,
        ...(input.role === "admin" ? { role: "admin" as const } : {}),
        updatedAt: new Date(),
      },
    });

    const membership = await tx.organizationMembership.upsert({
      where: {
        userId_organizationId: { userId: user.id, organizationId: input.organizationId },
      },
      create: {
        userId: user.id,
        organizationId: input.organizationId,
        role: input.role,
        status: "active",
        updatedAt: new Date(),
      },
      update: {
        role: input.role,
        status: "active",
        updatedAt: new Date(),
      },
    });

    return {
      userId: user.id,
      membershipId: membership.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      globalRole: user.role,
      staffUserType: user.staffUserType,
      isActive: user.isActive,
      membershipStatus: membership.status,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  });
}

export async function updateOrganizationUser(input: {
  organizationId: string;
  userId: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
  makeCompanyAdmin?: boolean;
}): Promise<TenantOrgUserRow> {
  if (input.role && !ROLES.includes(input.role)) throw new Error("Invalid role.");
  if (input.password !== undefined && input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const effectiveRole = input.makeCompanyAdmin ? "admin" : input.role;

  return withOrgContext(input.organizationId, async (tx) => {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: input.userId,
          organizationId: input.organizationId,
        },
      },
      include: { user: true },
    });
    if (!membership) throw new Error("User is not a member of this organization.");

    const passwordHash =
      input.password !== undefined ? await hash(input.password, 12) : undefined;

    const user = await tx.user.update({
      where: { id: input.userId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(input.makeCompanyAdmin || effectiveRole === "admin" ? { role: "admin" as const } : {}),
        updatedAt: new Date(),
      },
    });

    const updatedMembership = await tx.organizationMembership.update({
      where: { id: membership.id },
      data: {
        ...(effectiveRole !== undefined ? { role: effectiveRole } : {}),
        ...(input.isActive === false ? { status: "inactive" } : { status: "active" }),
        updatedAt: new Date(),
      },
    });

    return {
      userId: user.id,
      membershipId: updatedMembership.id,
      email: user.email,
      name: user.name,
      role: updatedMembership.role,
      globalRole: user.role,
      staffUserType: user.staffUserType,
      isActive: user.isActive,
      membershipStatus: updatedMembership.status,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  });
}

export async function removeOrganizationUser(input: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  await withOrgContext(input.organizationId, async (tx) => {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: input.userId,
          organizationId: input.organizationId,
        },
      },
    });
    if (!membership) throw new Error("User is not a member of this organization.");

    await tx.organizationMembership.update({
      where: { id: membership.id },
      data: { status: "inactive", updatedAt: new Date() },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: { isActive: false, updatedAt: new Date() },
    });
  });
}
