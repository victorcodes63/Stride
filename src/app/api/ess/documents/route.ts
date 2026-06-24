import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ items: [] });

  const rows = await prisma.employeeDocument.findMany({
    where: { employeeId: user.employeeId },
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
  });

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
}
