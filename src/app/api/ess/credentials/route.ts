import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ items: [] });

  const rows = await prisma.employeeCredential.findMany({
    where: { employeeId: user.employeeId },
    orderBy: [{ expiryDate: 'asc' }, { credentialName: 'asc' }],
    select: {
      id: true,
      credentialName: true,
      category: true,
      credentialNumber: true,
      expiryDate: true,
      status: true,
      issuingAuthority: true,
    },
  });

  const now = Date.now();
  return NextResponse.json({
    items: rows.map((r) => {
      const expiryMs = r.expiryDate ? r.expiryDate.getTime() : null;
      const daysUntilExpiry =
        expiryMs != null ? Math.ceil((expiryMs - now) / (24 * 60 * 60 * 1000)) : null;
      return {
        id: r.id,
        credentialName: r.credentialName,
        category: r.category,
        credentialNumber: r.credentialNumber,
        expiryDate: r.expiryDate?.toISOString().slice(0, 10) ?? null,
        status: r.status,
        issuingAuthority: r.issuingAuthority,
        daysUntilExpiry,
        expiringSoon: daysUntilExpiry != null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0,
      };
    }),
  });
}
