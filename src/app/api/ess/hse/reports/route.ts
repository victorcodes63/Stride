import { NextRequest, NextResponse } from 'next/server';
import type { HseIncidentSeverity, HseIncidentType } from '@prisma/client';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { allocateIncidentNumber } from '@/lib/hse/incident-code';
import { HSE_INCIDENT_STATUS_LABELS, serializeIncident } from '@/lib/hse/serialize';
import { withEssTenant } from '@/lib/ess-tenant-api';

function essSeverityToType(severity: string): HseIncidentType {
  if (severity === 'high') return 'injury';
  if (severity === 'medium') return 'near_miss';
  if (severity === 'low') return 'hazard';
  return 'other';
}

function essSeverityToLevel(severity: string): HseIncidentSeverity {
  if (severity === 'high') return 'high';
  if (severity === 'low') return 'low';
  return 'medium';
}

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) return NextResponse.json({ items: [] });

    const items = await ctx.run((tx) =>
      tx.hseIncident.findMany({
        where: ctx.where({ reportedByEmployeeId: ctx.essUser.employeeId! }),
        orderBy: { reportedAt: 'desc' },
        include: {
          reportedByUser: { select: { name: true } },
          reportedByEmployee: { select: { firstName: true, lastName: true } },
          actions: { select: { id: true, status: true } },
        },
        take: 50,
      }),
    );

    return NextResponse.json({
      items: items.map((item) => {
        const row = serializeIncident(item);
        return {
          id: row.id,
          incidentNumber: row.incidentNumber,
          title: row.title,
          status: row.status,
          statusLabel: row.statusLabel,
          submittedAt: row.reportedAt,
        };
      }),
    });
  });
}

export async function POST(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) {
      return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    const location = typeof payload.location === 'string' ? payload.location.trim() : '';
    const severity = typeof payload.severity === 'string' ? payload.severity.trim() : 'medium';
    const happenedAt = typeof payload.happenedAt === 'string' ? payload.happenedAt.trim() : '';

    if (!description) {
      return NextResponse.json({ error: 'Please describe what happened.' }, { status: 400 });
    }

    const report = await ctx.run(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: ctx.where({ id: ctx.essUser.employeeId! }),
        select: { organizationId: true, outsourcingClientId: true },
      });
      if (!employee) return null;

      const incidentNumber = await allocateIncidentNumber(tx, employee.outsourcingClientId);
      const title = location ? `HSE report: ${location}` : 'HSE report: Incident or near-miss';
      const occurredAt = happenedAt ? new Date(happenedAt) : new Date();
      const level = essSeverityToLevel(severity);

      return tx.hseIncident.create({
        data: {
          organizationId: employee.organizationId,
          outsourcingClientId: employee.outsourcingClientId,
          incidentNumber,
          title,
          description,
          incidentType: essSeverityToType(severity),
          severity: level,
          location: location || null,
          occurredAt,
          reportedByEmployeeId: ctx.essUser.employeeId!,
        },
        include: {
          reportedByUser: { select: { name: true } },
          reportedByEmployee: { select: { firstName: true, lastName: true } },
          actions: { select: { id: true, status: true } },
        },
      });
    });

    if (!report) {
      return NextResponse.json({ error: 'Employee record not found.' }, { status: 400 });
    }

    await ctx.audit({
      action: 'ess.hse.report.created',
      entityType: 'HseIncident',
      entityId: report.id,
      route: 'POST /api/ess/hse/reports',
      metadata: { employeeId: ctx.essUser.employeeId, severity, location },
    });

    const hrUserIds = await getHrUserIds();
    await sendNotification({
      event: 'grievance_submitted',
      recipientUserIds: hrUserIds,
      title: `New HSE report ${report.incidentNumber}`,
      body: `${ctx.essUser.name} reported ${location || 'an incident or near-miss'}.`,
      href: '/dashboard/hse',
      priority: severity === 'high' ? 'urgent' : 'action_required',
      channel: 'in_app',
      metadata: { reportId: report.id, severity, location },
    });

    const row = serializeIncident(report);
    return NextResponse.json(
      {
        id: row.id,
        incidentNumber: row.incidentNumber,
        title: row.title,
        status: row.status,
        statusLabel: HSE_INCIDENT_STATUS_LABELS[report.status],
        submittedAt: row.reportedAt,
      },
      { status: 201 },
    );
  });
}
