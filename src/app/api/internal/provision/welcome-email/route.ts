import { NextRequest, NextResponse } from "next/server";

import {
  unauthorizedProvisionResponse,
  verifyCellProvisionAuth,
} from "@/lib/cell-provision-auth";
import { sendTenantAdminWelcomeEmail } from "@/lib/email";
import type { StaffAuthSetup } from "@/lib/org-provision";

export const dynamic = "force-dynamic";

function parseStaffAuthSetup(value: unknown): StaffAuthSetup | undefined {
  if (
    value === "credentials" ||
    value === "credentials_microsoft" ||
    value === "credentials_google" ||
    value === "microsoft" ||
    value === "google"
  ) {
    return value;
  }
  return undefined;
}

/**
 * POST /api/internal/provision/welcome-email — control plane sends tenant admin credentials.
 * Auth: Authorization: Bearer {STRIDE_CELL_PROVISION_KEY}
 */
export async function POST(request: NextRequest) {
  if (!verifyCellProvisionAuth(request)) {
    return unauthorizedProvisionResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
  const adminName = typeof body.adminName === "string" ? body.adminName.trim() : "";
  const organizationName =
    typeof body.organizationName === "string" ? body.organizationName.trim() : "";
  const loginUrl = typeof body.loginUrl === "string" ? body.loginUrl.trim() : "";

  if (!to || !adminName || !organizationName || !loginUrl) {
    return NextResponse.json(
      { error: "to, adminName, organizationName, and loginUrl are required" },
      { status: 400 },
    );
  }

  const result = await sendTenantAdminWelcomeEmail({
    to,
    adminName,
    organizationName,
    loginUrl,
    staffAuthSetup: parseStaffAuthSetup(body.staffAuthSetup),
    password: typeof body.password === "string" ? body.password : undefined,
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: result.error, reason: result.reason },
      { status: result.reason === "resend_not_configured" ? 503 : 502 },
    );
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
