import { NextRequest, NextResponse } from "next/server";

import {
  createOrganizationUser,
  listOrganizationUsers,
  parseOrgUserRole,
} from "@/lib/cell-org-users";
import {
  unauthorizedProvisionResponse,
  verifyCellProvisionAuth,
} from "@/lib/cell-provision-auth";

export const dynamic = "force-dynamic";

function parseOrganizationId(request: NextRequest): string | null {
  const fromQuery = request.nextUrl.searchParams.get("organizationId")?.trim();
  if (fromQuery) return fromQuery;
  return null;
}

/** GET /api/internal/org/users?organizationId= — list staff users for a tenant org. */
export async function GET(request: NextRequest) {
  if (!verifyCellProvisionAuth(request)) {
    return unauthorizedProvisionResponse();
  }

  const organizationId = parseOrganizationId(request);
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId query parameter is required" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const users = await listOrganizationUsers(organizationId);
    return NextResponse.json({ organizationId, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/internal/org/users — invite/create a staff user on a tenant org. */
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

  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  const email = typeof body.email === "string" ? body.email : "";
  const name = typeof body.name === "string" ? body.name : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = parseOrgUserRole(body.role) ?? "staff";

  if (!organizationId || !email || !name || !password) {
    return NextResponse.json(
      { error: "organizationId, email, name, and password are required" },
      { status: 400 },
    );
  }

  try {
    const user = await createOrganizationUser({
      organizationId,
      email,
      name,
      password,
      role,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
