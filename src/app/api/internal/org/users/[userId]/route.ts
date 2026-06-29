import { NextRequest, NextResponse } from "next/server";

import {
  parseOrgUserRole,
  removeOrganizationUser,
  updateOrganizationUser,
} from "@/lib/cell-org-users";
import {
  unauthorizedProvisionResponse,
  verifyCellProvisionAuth,
} from "@/lib/cell-provision-auth";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ userId: string }> };

/** PATCH /api/internal/org/users/:userId — update role, status, or promote to company admin. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  try {
    const user = await updateOrganizationUser({
      organizationId,
      userId,
      name: typeof body.name === "string" ? body.name : undefined,
      role: parseOrgUserRole(body.role) ?? undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
      makeCompanyAdmin: body.makeCompanyAdmin === true,
    });
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not a member") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** DELETE /api/internal/org/users/:userId — deactivate user and org membership. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!verifyCellProvisionAuth(request)) {
    return unauthorizedProvisionResponse();
  }

  const { userId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim();
  if (!userId || !organizationId) {
    return NextResponse.json(
      { error: "userId and organizationId query parameter are required" },
      { status: 400 },
    );
  }

  try {
    await removeOrganizationUser({ organizationId, userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not a member") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
