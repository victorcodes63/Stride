import { hash } from "bcryptjs";
import type { AuthProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalePack } from "@/lib/country-config";
import { setOrgContext } from "@/lib/org-context";
import { nameFromEmailLocalPart } from "@/lib/personal-display-name";

export type StaffAuthSetup =
  | "credentials"
  | "credentials_microsoft"
  | "credentials_google"
  | "microsoft"
  | "google";

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
  /** How staff sign-in is configured for this tenant (control-plane onboarding). */
  staffAuthSetup?: StaffAuthSetup;
};

export function staffAuthSetupToProviders(setup: StaffAuthSetup): AuthProvider[] {
  switch (setup) {
    case "credentials_microsoft":
      return ["microsoft", "credentials"];
    case "credentials_google":
      return ["google", "credentials"];
    case "microsoft":
      return ["microsoft"];
    case "google":
      return ["google"];
    default:
      return ["credentials"];
  }
}

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

function extractEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return null;
  return normalized.slice(at + 1);
}

async function ensureProvisionAuthBootstrap(
  tx: Prisma.TransactionClient,
  organizationId: string,
  adminEmail: string,
  staffAuthSetup: StaffAuthSetup = "credentials",
): Promise<void> {
  await setOrgContext(tx, organizationId);

  const emailDomain = extractEmailDomain(adminEmail);
  if (emailDomain) {
    await tx.organizationEmailDomain.upsert({
      where: {
        organizationId_domain: { organizationId, domain: emailDomain },
      },
      create: {
        organizationId,
        domain: emailDomain,
        verificationToken: `provision-${emailDomain}`,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        verifiedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  const staffEnabledProviders = staffAuthSetupToProviders(staffAuthSetup);
  const essEnabledProviders: AuthProvider[] = ["credentials"];

  await tx.organizationAuthConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      staffEnabledProviders,
      essEnabledProviders,
      updatedAt: new Date(),
    },
    update: {
      staffEnabledProviders,
      updatedAt: new Date(),
    },
  });
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

  const staffAuthSetup = input.staffAuthSetup ?? "credentials";
  const adminName = input.adminName?.trim() || nameFromEmailLocalPart(adminEmail) || "Admin";

  const existingOrg = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });
  if (existingOrg) {
    const password =
      input.adminPassword?.trim() ||
      process.env.PROVISION_ADMIN_PASSWORD?.trim() ||
      undefined;
    const passwordHash = password ? await hash(password, 12) : undefined;

    const user = await prisma.$transaction(async (tx) => {
      await setOrgContext(tx, existingOrg.id);

      const upserted = await tx.user.upsert({
        where: { email: adminEmail },
        create: {
          email: adminEmail,
          name: adminName,
          role: "admin",
          staffUserType: "operations",
          passwordHash: passwordHash ?? (await hash(`Stride-${Date.now().toString(36)}!`, 12)),
          isActive: true,
          updatedAt: new Date(),
        },
        update: {
          name: adminName,
          isActive: true,
          ...(passwordHash ? { passwordHash } : {}),
          updatedAt: new Date(),
        },
      });

      await tx.organizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId: upserted.id,
            organizationId: existingOrg.id,
          },
        },
        create: {
          userId: upserted.id,
          organizationId: existingOrg.id,
          role: "admin",
          updatedAt: new Date(),
        },
        update: {
          role: "admin",
          updatedAt: new Date(),
        },
      });

      await ensureProvisionAuthBootstrap(tx, existingOrg.id, adminEmail, staffAuthSetup);

      return upserted;
    });

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

    await ensureProvisionAuthBootstrap(tx, org.id, adminEmail, staffAuthSetup);

    return { org, user };
  });

  return {
    organizationId: result.org.id,
    organizationSlug: result.org.slug,
    adminUserId: result.user.id,
    created: true,
  };
}
