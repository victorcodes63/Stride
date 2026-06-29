import { NextRequest, NextResponse } from "next/server";

import {
  type OrgUserEmailKind,
  sendOrgUserAccountEmail,
} from "@/lib/cell-org-user-emails";
import {
  unauthorizedProvisionResponse,
  verifyCellProvisionAuth,
} from "@/lib/cell-provision-auth";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ userId: string }> };

const KINDS: OrgUserEmailKind[] = ["invite", "reset_link", "temporary_password"];

function parseKind(value: unknown): OrgUserEmailKind | null {
  if (value === "invite" || value === "reset_link" || value === "temporary_password") {
    return value;
  }
  return null;
}

/** POST /api/internal/org/users/:userId/account-email — invite, reset link, or temp password email. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!verifyCellProvisionAuth(request)) {
    return unauthorizedProvisionResponse();
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  const kind = parseKind(body.kind);

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "kind must be invite, reset_link, or temporary_password" },
      { status: 400 },
    );
  }

  try {
    const result = await sendOrgUserAccountEmail({
      organizationId,
      userId,
      kind,
      password: typeof body.password === "string" ? body.password : undefined,
    });

    if (!result.ok) {
      const status = result.reason === "resend_not_configured" ? 503 : 502;
      return NextResponse.json({ error: result.error, reason: result.reason }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not a member") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
