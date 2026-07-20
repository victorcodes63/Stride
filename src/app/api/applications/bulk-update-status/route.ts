/**
 * Bulk update application status.
 * POST { applicationIds: string[], status: ApplicationStatus, reason?: string, sendRejectionEmail?: boolean }
 * Updates every application in the selection to the target status, mirroring the
 * side effects of the single PATCH /api/applications/[id] route (audit log,
 * assessment-attempt creation, and optional rejection emails).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInMemoryApplications, updateInMemoryApplicationStatus } from '@/lib/applications-store';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';
import { createAssessmentAttemptsForApplication } from '@/lib/assessment-attempts';
import { sendApplicationRejectedEmail } from '@/lib/email';
import type { ApplicationStatus } from '@/types/dashboard';

const VALID_STATUSES: ApplicationStatus[] = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const b = body as {
      applicationIds?: string[];
      status?: string;
      reason?: string;
      sendRejectionEmail?: boolean;
    };
    const ids = b.applicationIds;
    const status = b.status;
    const reason = typeof b.reason === 'string' ? b.reason.trim() : undefined;
    const sendRejectionEmail = b.sendRejectionEmail === true;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'applicationIds array required (at least one).' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 applications per request.' }, { status: 400 });
    }
    if (!status || !VALID_STATUSES.includes(status as ApplicationStatus)) {
      return NextResponse.json({ error: 'Valid status required.' }, { status: 400 });
    }
    const targetStatus = status as ApplicationStatus;

    try {
      if (process.env.DATABASE_URL) {
        const rows = await ctx.run((tx) =>
          tx.application.findMany({
            where: ctx.where({ id: { in: ids } }),
            include: { candidate: true, job: { include: { client: true } } },
          }),
        );
        if (rows.length === 0) {
          return NextResponse.json({ error: 'No applications found in the selection.' }, { status: 400 });
        }

        const changed = rows.filter((a) => a.status !== targetStatus);
        if (changed.length > 0) {
          await ctx.run((tx) =>
            tx.application.updateMany({
              where: ctx.where({ id: { in: changed.map((a) => a.id) } }),
              data: { status: targetStatus },
            }),
          );
        }

        // Per-application side effects (audit, assessment attempts, emails).
        for (const a of changed) {
          await ctx.audit({
            action: 'application.status_changed',
            entityType: 'application',
            entityId: a.id,
            route: 'POST /api/applications/bulk-update-status',
            metadata: {
              from: a.status,
              to: targetStatus,
              reason: reason || null,
              bulk: true,
              candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`.trim(),
              jobTitle: a.job.title,
            },
          });
        }

        // Assessment attempts run for every affected application at the new status.
        for (const a of changed) {
          try {
            await createAssessmentAttemptsForApplication(prisma, {
              applicationId: a.id,
              jobId: a.jobId,
              organizationId: a.job.organizationId,
              applicationStatus: targetStatus,
            });
          } catch {
            // Non-fatal: never block a bulk status change on assessment provisioning.
          }
        }

        let emailsSent = 0;
        let emailsFailed = 0;
        if (targetStatus === 'rejected' && sendRejectionEmail) {
          for (const a of changed) {
            const result = await sendApplicationRejectedEmail({
              to: a.candidate.email,
              applicantFirstName: a.candidate.firstName,
              jobTitle: a.job.title,
              companyName: a.job.company,
            });
            if (result.sent) emailsSent += 1;
            else emailsFailed += 1;
          }
        }

        return NextResponse.json({
          total: rows.length,
          updated: changed.length,
          unchanged: rows.length - changed.length,
          status: targetStatus,
          emailsSent,
          emailsFailed,
        });
      }
    } catch (e) {
      await reportApiError({
        route: 'POST /api/applications/bulk-update-status',
        message: e instanceof Error ? e.message : String(e),
        context: { count: ids.length, status: targetStatus },
      });
      return NextResponse.json({ error: 'Failed to update applications.' }, { status: 500 });
    }

    // In-memory fallback (no database configured).
    const all = getInMemoryApplications();
    const selectable = all.filter((a) => ids.includes(a.id));
    let updated = 0;
    for (const a of selectable) {
      if (a.status !== targetStatus && updateInMemoryApplicationStatus(a.id, targetStatus)) updated += 1;
    }
    return NextResponse.json({
      total: selectable.length,
      updated,
      unchanged: selectable.length - updated,
      status: targetStatus,
      emailsSent: 0,
      emailsFailed: 0,
    });
  });
}
