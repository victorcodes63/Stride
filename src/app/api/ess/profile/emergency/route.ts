import { NextRequest, NextResponse } from 'next/server';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { withEssTenant } from '@/lib/ess-tenant-api';

const CONTACT_SELECT = {
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelationship: true,
  emergencyContactAltName: true,
  emergencyContactAltPhone: true,
  emergencyContactAltRelationship: true,
  updatedAt: true,
} as const;

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });
    }

    const employee = await ctx.run((tx) =>
      tx.employee.findFirst({
        where: ctx.where({ id: ctx.employeeId! }),
        select: CONTACT_SELECT,
      }),
    );
    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found.' }, { status: 404 });
    }

    return NextResponse.json({
      primary: {
        name: employee.emergencyContactName,
        phone: employee.emergencyContactPhone,
        relationship: employee.emergencyContactRelationship,
      },
      secondary: {
        name: employee.emergencyContactAltName,
        phone: employee.emergencyContactAltPhone,
        relationship: employee.emergencyContactAltRelationship,
      },
      updatedAt: employee.updatedAt.toISOString(),
    });
  });
}

export async function PUT(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const payload = body as {
      primary?: { name?: unknown; phone?: unknown; relationship?: unknown };
      secondary?: { name?: unknown; phone?: unknown; relationship?: unknown };
    };

    const primaryName = clean(payload.primary?.name);
    const primaryPhone = clean(payload.primary?.phone);
    const primaryRelationship = clean(payload.primary?.relationship);
    const secondaryName = clean(payload.secondary?.name);
    const secondaryPhone = clean(payload.secondary?.phone);
    const secondaryRelationship = clean(payload.secondary?.relationship);

    if ((primaryName && !primaryPhone) || (!primaryName && primaryPhone)) {
      return NextResponse.json(
        { error: 'Primary emergency contact needs both a name and phone number.' },
        { status: 400 },
      );
    }
    if ((secondaryName && !secondaryPhone) || (!secondaryName && secondaryPhone)) {
      return NextResponse.json(
        { error: 'Secondary emergency contact needs both a name and phone number.' },
        { status: 400 },
      );
    }

    const updated = await ctx.run((tx) =>
      tx.employee.update({
        where: { id: ctx.employeeId! },
        data: {
          emergencyContactName: primaryName,
          emergencyContactPhone: primaryPhone,
          emergencyContactRelationship: primaryRelationship,
          emergencyContactAltName: secondaryName,
          emergencyContactAltPhone: secondaryPhone,
          emergencyContactAltRelationship: secondaryRelationship,
        },
        select: CONTACT_SELECT,
      }),
    );

    await ctx.audit({
      action: 'ess.emergency_contacts.updated',
      entityType: 'Employee',
      entityId: ctx.employeeId,
      route: 'PUT /api/ess/profile/emergency',
      metadata: {
        hasPrimary: Boolean(primaryName),
        hasSecondary: Boolean(secondaryName),
      },
    });

    try {
      const hrUserIds = await getHrUserIds();
      await sendNotification({
        event: 'profile_change_requested',
        recipientUserIds: hrUserIds,
        title: 'Emergency contacts updated',
        body: `${ctx.essUser.name || ctx.essUser.email} updated their emergency contacts.`,
        href: '/dashboard/outsourcing/employees',
        priority: 'action_required',
        channel: 'in_app',
        metadata: { employeeId: ctx.employeeId },
      });
    } catch (err) {
      console.error('[notifications] Failed to send emergency contact update:', err);
    }

    return NextResponse.json({
      primary: {
        name: updated.emergencyContactName,
        phone: updated.emergencyContactPhone,
        relationship: updated.emergencyContactRelationship,
      },
      secondary: {
        name: updated.emergencyContactAltName,
        phone: updated.emergencyContactAltPhone,
        relationship: updated.emergencyContactAltRelationship,
      },
      updatedAt: updated.updatedAt.toISOString(),
    });
  });
}
