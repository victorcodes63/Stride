import { NextResponse } from 'next/server';

/**
 * Legacy route: recruitment is single-organization. Use GET /api/recruitment-settings
 * and the Organization dashboard page instead of listing “clients.”
 */
export async function GET() {
  return NextResponse.json([]);
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Recruitment uses a single employer. Update organization details via PATCH /api/recruitment-settings or Dashboard → Recruitment → Organization.',
    },
    { status: 410 }
  );
}
