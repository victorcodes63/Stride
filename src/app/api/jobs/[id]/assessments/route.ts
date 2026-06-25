import { NextRequest, NextResponse } from 'next/server';
import type { ApplicationStatus } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { createAssessmentAttemptsForApplication } from '@/lib/assessment-attempts';
import { prisma } from '@/lib/prisma';

const VALID_STATUSES: ApplicationStatus[] = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(_request, async (ctx) => {
    const { id: jobId } = await params;

    const job = await ctx.run((tx) =>
      tx.job.findFirst({ where: ctx.where({ id: jobId }), select: { id: true } }),
    );
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

    const assignments = await ctx.run((tx) =>
      tx.jobAssessmentAssignment.findMany({
        where: { jobId },
        include: { template: { select: { id: true, name: true, timeLimitMinutes: true, isActive: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return NextResponse.json(assignments);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id: jobId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const templateId = typeof body.templateId === 'string' ? body.templateId.trim() : '';
    if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });

    const triggerStatusRaw = typeof body.triggerStatus === 'string' ? body.triggerStatus : null;
    const triggerStatus =
      triggerStatusRaw && VALID_STATUSES.includes(triggerStatusRaw as ApplicationStatus)
        ? (triggerStatusRaw as ApplicationStatus)
        : null;

    const job = await ctx.run((tx) =>
      tx.job.findFirst({
        where: ctx.where({ id: jobId }),
        select: { id: true, organizationId: true },
      }),
    );
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

    const template = await ctx.run((tx) =>
      tx.assessmentTemplate.findFirst({ where: ctx.where({ id: templateId }) }),
    );
    if (!template) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

    const assignment = await ctx.run((tx) =>
      tx.jobAssessmentAssignment.upsert({
        where: { jobId_templateId: { jobId, templateId } },
        create: {
          organizationId: job.organizationId,
          jobId,
          templateId,
          triggerStatus,
        },
        update: { triggerStatus },
        include: { template: { select: { id: true, name: true } } },
      }),
    );

    if (!triggerStatus) {
      const applications = await ctx.run((tx) =>
        tx.application.findMany({
          where: { jobId, status: 'pending' },
          select: { id: true, status: true },
        }),
      );
      for (const app of applications) {
        await createAssessmentAttemptsForApplication(prisma, {
          applicationId: app.id,
          jobId,
          organizationId: job.organizationId,
          applicationStatus: app.status,
        });
      }
    }

    return NextResponse.json(assignment, { status: 201 });
  });
}
