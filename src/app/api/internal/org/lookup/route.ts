import { NextRequest, NextResponse } from "next/server";

import {
  unauthorizedProvisionResponse,
  verifyCellProvisionAuth,
} from "@/lib/cell-provision-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/internal/org/lookup?slug= — resolve tenant org id for control-plane linking. */
export async function GET(request: NextRequest) {
  if (!verifyCellProvisionAuth(request)) {
    return unauthorizedProvisionResponse();
  }

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug query parameter is required" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });

  if (!org) {
    return NextResponse.json({ error: `Organization not found for slug: ${slug}` }, { status: 404 });
  }

  return NextResponse.json({
    organizationId: org.id,
    organizationSlug: org.slug,
    organizationName: org.name,
  });
}
