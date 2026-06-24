import { hash } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalePack } from "@/lib/country-config";

export type ProvisionOrgInput = {
  organizationSlug: string;
  organizationName: string;
  country: string;
  currency?: string;
  timezone?: string;
  customerSlug?: string;
  adminEmail: string;
  adminName?: string;
  adminPassword?: string;
};

export type ProvisionOrgResult = {
  organizationId: string;
  organizationSlug: string;
  adminUserId: string;
  created: boolean;
};

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function provisionOrganization(
  input: ProvisionOrgInput,
): Promise<ProvisionOrgResult> {
  const organizationSlug = slugify(input.organizationSlug);
  if (!organizationSlug) {
    throw new Error("organizationSlug is required");
  }

  const country = input.country.trim().toUpperCase() || "KE";
  const locale = await getLocalePack(country);
  const currency = input.currency ?? locale.currency;
  const timezone = input.timezone ?? locale.timezone;
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!adminEmail) {
    throw new Error("adminEmail is required");
  }

  const existingOrg = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });
  if (existingOrg) {
    const user = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!user) {
      throw new Error("Organization exists but admin user not found");
    }
    return {
      organizationId: existingOrg.id,
      organizationSlug: existingOrg.slug,
      adminUserId: user.id,
      created: false,
    };
  }

  const password =
    input.adminPassword?.trim() ||
    process.env.PROVISION_ADMIN_PASSWORD?.trim() ||
    `Stride-${Date.now().toString(36)}!`;

  const passwordHash = await hash(password, 12);
  const adminName = input.adminName?.trim() || input.organizationName;

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.organizationName.trim(),
        slug: organizationSlug,
        country,
        currency,
        timezone,
        settings: {
          customerSlug: input.customerSlug ?? null,
          provisionedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    const user = await tx.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        name: adminName,
        role: "admin",
        staffUserType: "operations",
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      },
      update: {
        name: adminName,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    await tx.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "admin",
        updatedAt: new Date(),
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: org.id,
        actorUserId: user.id,
        actorEmail: adminEmail,
        action: "organization.provisioned",
        entityType: "Organization",
        entityId: org.id,
        route: "POST /api/internal/provision/org",
        metadata: { customerSlug: input.customerSlug ?? null, country },
      },
    });

    return { org, user };
  });

  return {
    organizationId: result.org.id,
    organizationSlug: result.org.slug,
    adminUserId: result.user.id,
    created: true,
  };
}
