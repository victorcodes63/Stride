import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ items: [] });

    const rows = await ctx.run((tx) =>
      tx.employeeDocument.findMany({
        where: ctx.where({ employeeId: ctx.employeeId! }),
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          fileName: true,
          expiresOn: true,
          isVerified: true,
          uploadedAt: true,
        },
      }),
    );

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        fileName: r.fileName,
        expiresOn: r.expiresOn?.toISOString().slice(0, 10) ?? null,
        isVerified: r.isVerified,
        uploadedAt: r.uploadedAt.toISOString(),
      })),
    });
  });
}
