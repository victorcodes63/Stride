import { NextRequest, NextResponse } from "next/server";

import {
  unauthorizedProvisionResponse,
  verifyCellProvisionAuth,
} from "@/lib/cell-provision-auth";
import { provisionOrganization } from "@/lib/org-provision";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/provision/org — control plane creates a tenant org on this cell (RAV-66).
 * Auth: Authorization: Bearer {STRIDE_CELL_PROVISION_KEY}
 */
export async function POST(request: NextRequest) {
  if (!verifyCellProvisionAuth(request)) {
    return unauthorizedProvisionResponse();
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const organizationSlug =
    typeof body.organizationSlug === "string" ? body.organizationSlug : "";
  const organizationName =
    typeof body.organizationName === "string" ? body.organizationName : "";
  const adminEmail = typeof body.adminEmail === "string" ? body.adminEmail : "";

  if (!organizationSlug || !organizationName || !adminEmail) {
    return NextResponse.json(
      { error: "organizationSlug, organizationName, and adminEmail are required" },
      { status: 400 },
    );
  }

  try {
    const result = await provisionOrganization({
      organizationSlug,
      organizationName,
      country: typeof body.country === "string" ? body.country : "KE",
      currency: typeof body.currency === "string" ? body.currency : undefined,
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
      customerSlug: typeof body.customerSlug === "string" ? body.customerSlug : undefined,
      adminEmail,
      adminName: typeof body.adminName === "string" ? body.adminName : undefined,
      adminPassword: typeof body.adminPassword === "string" ? body.adminPassword : undefined,
    });

    return NextResponse.json({
      ok: true,
      organizationId: result.organizationId,
      organizationSlug: result.organizationSlug,
      adminUserId: result.adminUserId,
      created: result.created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
