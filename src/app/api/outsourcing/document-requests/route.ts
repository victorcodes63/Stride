import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

/** GET — employee document requests from ESS (empty until requests are submitted). */
export async function GET(request: NextRequest) {
  return withTenant(request, async () => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    return NextResponse.json([]);
  });
}
