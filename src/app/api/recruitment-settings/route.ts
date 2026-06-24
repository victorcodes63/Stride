import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  getOrCreateRecruitmentSettings,
  settingsToDto,
} from '@/lib/recruitment-workspace';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Recruitment settings require a database (DATABASE_URL).' },
        { status: 503 }
      );
    }
    const row = await getOrCreateRecruitmentSettings(prisma);
    return NextResponse.json(settingsToDto(row));
  } catch (e) {
    await reportApiError({
      route: 'GET /api/recruitment-settings',
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Failed to load recruitment settings.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const employerName = str(b.employerName);
  const contactName =
    !('contactName' in b) ? undefined : b.contactName === null ? null : str(b.contactName);
  const contactEmail =
    !('contactEmail' in b) ? undefined : b.contactEmail === null ? null : str(b.contactEmail);
  const contactPhone =
    !('contactPhone' in b) ? undefined : b.contactPhone === null ? null : str(b.contactPhone);

  if (!employerName) {
    return NextResponse.json({ error: 'employerName is required.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Recruitment settings require a database (DATABASE_URL).' },
        { status: 400 }
      );
    }

    const current = await getOrCreateRecruitmentSettings(prisma);
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.recruitmentSettings.update({
        where: { id: current.id },
        data: {
          employerName,
          ...(contactName !== undefined && { contactName }),
          ...(contactEmail !== undefined && { contactEmail }),
          ...(contactPhone !== undefined && { contactPhone }),
        },
      });
      if (next.linkedClientId) {
        await tx.client.update({
          where: { id: next.linkedClientId },
          data: {
            name: employerName,
            ...(contactName !== undefined && { contactName }),
            ...(contactEmail !== undefined && { contactEmail }),
            ...(contactPhone !== undefined && { contactPhone }),
          },
        });
      }
      return next;
    });
    return NextResponse.json(settingsToDto(updated));
  } catch (e) {
    await reportApiError({
      route: 'PATCH /api/recruitment-settings',
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Failed to update recruitment settings.' }, { status: 500 });
  }
}
