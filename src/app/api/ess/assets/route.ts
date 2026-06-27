import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ items: [] });

    const rows = await ctx.run((tx) =>
      tx.companyAsset.findMany({
        where: ctx.where({
          assignedEmployeeId: ctx.employeeId!,
          status: 'assigned',
        }),
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
      }),
    );

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
  });
}
