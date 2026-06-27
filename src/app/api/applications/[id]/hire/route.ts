import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { canConvertHire } from '@/lib/ats-governance';
import { buildEmployeeFromHireConversion, validateHireProfileInput, type HireProfileInput } from '@/lib/ats-hire-conversion';
import { assertEmployeeProfileCompleteness } from '@/lib/hr-core-employee';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canConvertHire(ctx.staff)) return forbiddenResponse();
    const { id: applicationId } = await params;

    const application = await ctx.run((tx) =>
      tx.application.findFirst({
        where: ctx.where({ id: applicationId }),
        include: { candidate: true, job: true, hireConversion: true },
      }),
    );
    if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    if (application.hireConversion) {
      return NextResponse.json({ error: 'Application already converted to employee.' }, { status: 409 });
    }

    const approvedOffer = await ctx.run((tx) =>
      tx.jobOfferApproval.findFirst({
        where: ctx.where({ applicationId, status: 'approved' }),
        orderBy: { actedAt: 'desc' },
      }),
    );
    if (!approvedOffer) {
      return NextResponse.json({ error: 'Cannot hire before an approved offer exists.' }, { status: 409 });
    }

    const body = (await request.json().catch(() => null)) as { profile?: Partial<HireProfileInput> } | null;
    const profile = body?.profile ?? {};
    const missing = validateHireProfileInput(profile);
    if (missing.length) {
      return NextResponse.json({ error: `Missing required profile fields: ${missing.join(', ')}` }, { status: 400 });
    }

    const payload = buildEmployeeFromHireConversion({
      candidate: application.candidate,
      job: { title: application.job.title },
      offer: {
        startDate: approvedOffer.startDate,
        proposedGrossSalary: approvedOffer.proposedGrossSalary ? Number(approvedOffer.proposedGrossSalary) : null,
      },
      profile: profile as HireProfileInput,
    });
    assertEmployeeProfileCompleteness(payload);

    const existingNationalId = await ctx.run((tx) =>
      tx.employee.findFirst({
        where: { idNumber: payload.idNumber, ...ctx.where() },
        select: { id: true },
      }),
    );
    if (existingNationalId) {
      return NextResponse.json({ error: 'An employee with this National ID already exists.' }, { status: 409 });
    }

    const created = await ctx.run(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          organizationId: ctx.organizationId,
          outsourcingClientId: payload.clientId,
          departmentId: payload.departmentId,
          managerEmployeeId: payload.managerEmployeeId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          idNumber: payload.idNumber,
          kraPin: payload.kraPin,
          nssfNumber: payload.nssfNumber,
          nhifNumber: payload.nhifNumber,
          dateOfJoining: payload.dateOfJoining,
          jobTitle: payload.jobTitle,
          costCenterCode: payload.costCenterCode,
          costCenterName: payload.costCenterName,
          bankName: payload.bankName,
          bankBranch: payload.bankBranch,
          bankAccountNumber: payload.bankAccountNumber,
          baseSalary: payload.baseSalary != null ? new Decimal(payload.baseSalary) : null,
        },
        select: { id: true },
      });

      await tx.application.update({
        where: { id: applicationId },
        data: { status: 'hired' },
      });

      const conversion = await tx.applicationHireConversion.create({
        data: {
          organizationId: ctx.organizationId,
          applicationId,
          employeeId: employee.id,
          convertedByUserId: ctx.staff.id,
          metadata: {
            offerApprovalId: approvedOffer.id,
            source: 'ats_to_hr_core',
          },
        },
      });

      return { employeeId: employee.id, conversionId: conversion.id };
    });

    await ctx.audit({
      action: 'ats.hire_conversion.completed',
      entityType: 'Application',
      entityId: applicationId,
      route: 'POST /api/applications/[id]/hire',
      metadata: {
        employeeId: created.employeeId,
        conversionId: created.conversionId,
        offerApprovalId: approvedOffer.id,
      },
    });

    return NextResponse.json(
      { applicationId, employeeId: created.employeeId, conversionId: created.conversionId },
      { status: 201 },
    );
  });
}
