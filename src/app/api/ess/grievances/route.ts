import { NextRequest, NextResponse } from 'next/server';
import { toGrievanceNumber } from '@/lib/disciplinary';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) return NextResponse.json([]);

    const grievances = await ctx.run((tx) =>
      tx.grievance.findMany({
        where: ctx.where({ employeeId: ctx.essUser.employeeId! }),
        orderBy: { submittedAt: 'desc' },
      }),
    );

    await ctx.audit({
      action: 'ess.grievance.list',
      entityType: 'Grievance',
      route: 'GET /api/ess/grievances',
      metadata: { employeeId: ctx.essUser.employeeId },
    });

    return NextResponse.json(grievances);
  });
}

export async function POST(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) return NextResponse.json({ error: 'No linked employee profile' }, { status: 400 });

    const body = (await request.json()) as Record<string, unknown>;
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = (typeof body.category === 'string' ? body.category : 'OTHER') as never;
    if (!subject || !description) return NextResponse.json({ error: 'subject and description are required' }, { status: 400 });

    const grievance = await ctx.run(async (tx) => {
      const year = new Date().getUTCFullYear();
      const count = await tx.grievance.count({
        where: ctx.where({
          submittedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
        }),
      });
      return tx.grievance.create({
        data: {
          organizationId: ctx.organizationId,
          employeeId: ctx.essUser.employeeId!,
          grievanceNumber: toGrievanceNumber(year, count + 1),
          subject,
          description,
          category,
        },
      });
    });

    await ctx.audit({
      action: 'ess.grievance.created',
      entityType: 'Grievance',
      entityId: grievance.id,
      route: 'POST /api/ess/grievances',
      metadata: { employeeId: ctx.essUser.employeeId },
    });

    const hrUserIds = await getHrUserIds();
    await sendNotification({
      event: 'grievance_submitted',
      recipientUserIds: hrUserIds,
      title: `New grievance ${grievance.grievanceNumber}`,
      body: grievance.subject,
      href: `/dashboard/disciplinary/grievances/${grievance.id}`,
      priority: 'action_required',
      channel: 'in_app',
      metadata: { grievanceId: grievance.id },
    });

    return NextResponse.json(grievance, { status: 201 });
  });
}
