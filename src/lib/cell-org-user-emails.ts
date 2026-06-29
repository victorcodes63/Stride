import { randomBytes } from "crypto";
import { hash } from "bcryptjs";

import { sendAccountInviteEmail, sendPasswordResetEmail, sendTenantAdminWelcomeEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/brand";
import { withOrgContext } from "@/lib/org-context";

export type OrgUserEmailKind = "invite" | "reset_link" | "temporary_password";

export type OrgUserEmailResult =
  | { ok: true; messageId?: string; password?: string }
  | { ok: false; error: string; reason?: string };

function generateTemporaryPassword(): string {
  const token = randomBytes(9)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `Stride-${token}!`;
}

async function loadOrgUser(organizationId: string, userId: string) {
  return withOrgContext(organizationId, async (tx) => {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      include: {
        user: true,
        organization: { select: { name: true } },
      },
    });
    if (!membership) {
      throw new Error("User is not a member of this organization.");
    }
    return membership;
  });
}

export async function sendOrgUserAccountEmail(input: {
  organizationId: string;
  userId: string;
  kind: OrgUserEmailKind;
  password?: string;
}): Promise<OrgUserEmailResult> {
  const membership = await loadOrgUser(input.organizationId, input.userId);
  const user = membership.user;

  if (!user.isActive || membership.status !== "active") {
    return { ok: false, error: "User must be active to receive account emails." };
  }

  if (input.kind === "invite") {
    const result = await sendAccountInviteEmail({
      to: user.email,
      name: user.name ?? "",
      portal: "staff",
      userId: user.id,
    });
    if (!result.sent) {
      return { ok: false, error: result.error ?? "Invite email failed.", reason: result.reason };
    }
    return { ok: true, messageId: result.messageId };
  }

  if (input.kind === "reset_link") {
    const result = await sendPasswordResetEmail({
      to: user.email,
      name: user.name ?? "",
      portal: "staff",
      userId: user.id,
    });
    if (!result.sent) {
      return { ok: false, error: result.error ?? "Reset email failed.", reason: result.reason };
    }
    return { ok: true, messageId: result.messageId };
  }

  const password = input.password?.trim() || generateTemporaryPassword();
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const passwordHash = await hash(password, 12);
  await withOrgContext(input.organizationId, (tx) =>
    tx.user.update({
      where: { id: user.id },
      data: { passwordHash, updatedAt: new Date() },
    }),
  );

  const loginUrl = `${getSiteUrl().replace(/\/$/, "")}/dashboard/login`;
  const result = await sendTenantAdminWelcomeEmail({
    to: user.email,
    adminName: user.name ?? "",
    organizationName: membership.organization.name,
    loginUrl,
    staffAuthSetup: "credentials",
    password,
  });

  if (!result.sent) {
    return {
      ok: false,
      error: result.error ?? "Password updated but email failed.",
      reason: result.reason,
    };
  }

  return { ok: true, messageId: result.messageId, password };
}
