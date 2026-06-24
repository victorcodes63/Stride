import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ items: [] });

  const rows = await prisma.companyAsset.findMany({
    where: { assignedEmployeeId: user.employeeId, status: 'assigned' },
    orderBy: { assignedAt: 'desc' },
    select: {
      id: true,
      assetTag: true,
      name: true,
      category: true,
      serialNumber: true,
      assignedAt: true,
      location: true,
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      assetTag: r.assetTag,
      name: r.name,
      category: r.category,
      serialNumber: r.serialNumber,
      assignedAt: r.assignedAt?.toISOString() ?? null,
      location: r.location,
    })),
  });
}
