import { NextRequest, NextResponse } from 'next/server';
import {
  assertReportsStaffRole,
  parseDateParam,
  parseFormat,
  respondWithReport,
  startOfDayUtc,
  ymd,
} from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function formatEnum(value: string | null): string {
  if (!value) return 'Unspecified';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const denied = assertReportsStaffRole(ctx.staff);
    if (denied) return denied;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const params = request.nextUrl.searchParams;
    const format = parseFormat(request);
    const defaultFrom = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const from = startOfDayUtc(parseDateParam(params.get('from'), defaultFrom));
    const toDay = startOfDayUtc(parseDateParam(params.get('to'), new Date()));
    const to = new Date(toDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );

    const incidents = await ctx.run((tx) =>
      tx.hseIncident.findMany({
        where: {
          outsourcingClientId: workspaceClientId,
          client: { organizationId: ctx.organizationId },
          occurredAt: { gte: from, lte: to },
        },
        select: {
          incidentNumber: true,
          title: true,
          incidentType: true,
          severity: true,
          status: true,
          location: true,
          siteName: true,
          occurredAt: true,
          lostTimeInjury: true,
          lostTimeDays: true,
          reportableToAuthority: true,
        },
        orderBy: { occurredAt: 'desc' },
      }),
    );

    const bySeverityMap = new Map<string, { severity: string; count: number }>();
    const byTypeMap = new Map<string, { type: string; count: number }>();
    const byStatusMap = new Map<string, { status: string; count: number }>();
    let lostTimeInjuries = 0;
    let lostTimeDays = 0;
    let reportable = 0;
    let openIncidents = 0;

    for (const incident of incidents) {
      const severity = formatEnum(incident.severity);
      const sev = bySeverityMap.get(severity) ?? { severity, count: 0 };
      sev.count += 1;
      bySeverityMap.set(severity, sev);

      const type = formatEnum(incident.incidentType);
      const t = byTypeMap.get(type) ?? { type, count: 0 };
      t.count += 1;
      byTypeMap.set(type, t);

      const status = formatEnum(incident.status);
      const st = byStatusMap.get(status) ?? { status, count: 0 };
      st.count += 1;
      byStatusMap.set(status, st);

      if (incident.lostTimeInjury) {
        lostTimeInjuries += 1;
        lostTimeDays += incident.lostTimeDays ?? 0;
      }
      if (incident.reportableToAuthority) reportable += 1;
      if (incident.status !== 'closed' && incident.status !== 'resolved') openIncidents += 1;
    }

    const bySeverity = Array.from(bySeverityMap.values()).sort((a, b) => b.count - a.count);
    const byType = Array.from(byTypeMap.values()).sort((a, b) => b.count - a.count);
    const byStatus = Array.from(byStatusMap.values()).sort((a, b) => b.count - a.count);

    const details = incidents.map((incident) => ({
      incidentNumber: incident.incidentNumber,
      title: incident.title,
      type: formatEnum(incident.incidentType),
      severity: formatEnum(incident.severity),
      status: formatEnum(incident.status),
      site: incident.siteName ?? incident.location ?? '',
      occurredAt: ymd(incident.occurredAt),
      lostTime: incident.lostTimeInjury ? 'Yes' : 'No',
    }));

    const report = {
      from: ymd(from),
      to: ymd(toDay),
      totalIncidents: incidents.length,
      openIncidents,
      lostTimeInjuries,
      lostTimeDays,
      reportableToAuthority: reportable,
      bySeverity,
      byType,
      byStatus,
      details,
    };

    return respondWithReport({
      format,
      json: report,
      title: 'HSE Incident Report',
      sheetName: 'HSE',
      baseFilename: `hse-${ymd(from)}_${ymd(toDay)}`,
      headers: ['Severity', 'Incidents'],
      rows: bySeverity.map((row) => [row.severity, row.count]),
      summaryLines: [
        `Period: ${ymd(from)} → ${ymd(toDay)}`,
        `Total incidents: ${report.totalIncidents}`,
        `Open: ${report.openIncidents}`,
        `Lost-time injuries: ${report.lostTimeInjuries} (${report.lostTimeDays} days)`,
        `Reportable to authority: ${report.reportableToAuthority}`,
      ],
    });
  });
}
