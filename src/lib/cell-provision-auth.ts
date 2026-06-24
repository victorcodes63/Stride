import { NextRequest, NextResponse } from "next/server";

export function verifyCellProvisionAuth(request: NextRequest): boolean {
  const expected = process.env.STRIDE_CELL_PROVISION_KEY?.trim();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  return request.headers.get("x-stride-provision-key") === expected;
}

export function unauthorizedProvisionResponse() {
  return NextResponse.json(
    { error: "Unauthorized — invalid or missing STRIDE_CELL_PROVISION_KEY" },
    { status: 401 },
  );
}
