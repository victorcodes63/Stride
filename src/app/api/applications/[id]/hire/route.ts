import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { canConvertHire, getAtsEntityJobWhere } from '@/lib/ats-governance';
import { buildEmployeeFromHireConversion, validateHireProfileInput, type HireProfileInput } from '@/lib/ats-hire-conversion';
import { logAuditEvent } from '@/lib/audit-events';
import { assertEmployeeProfileCompleteness } from '@/lib/hr-core-employee';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canConvertHire(user)) return forbiddenResponse();
  const { id: applicationId } = await params;

  const application = await prisma.application.findFirst({
    where: { id: applicationId, job: { ...(getAtsEntityJobWhere(request) ?? {}) } },
    include: { candidate: true, job: true, hireConversion: true },
  });
  if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  if (application.hireConversion) return NextResponse.json({ error: 'Application already converted to employee.' }, { status: 409 });

  const approvedOffer = await prisma.jobOfferApproval.findFirst({
    where: { applicationId, status: 'approved' },
    orderBy: { actedAt: 'desc' },
  });
  if (!approvedOffer) return NextResponse.json({ error: 'Cannot hire before an approved offer exists.' }, { status: 409 });

  const body = (await request.json().catch(() => null)) as { profile?: Partial<HireProfileInput> } | null;
  const profile = body?.profile ?? {};
  const missing = validateHireProfileInput(profile);
  if (missing.length) return NextResponse.json({ error: `Missing required profile fields: ${missing.join(', ')}` }, { status: 400 });

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

  const existingNationalId = await prisma.employee.findFirst({ where: { idNumber: payload.idNumber }, select: { id: true } });
  if (existingNationalId) return NextResponse.json({ error: 'An employee with this National ID already exists.' }, { status: 409 });

  const created = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
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
        applicationId,
        employeeId: employee.id,
        convertedByUserId: user.id,
        metadata: {
          offerApprovalId: approvedOffer.id,
          source: 'ats_to_hr_core',
        },
      },
    });

    return { employeeId: employee.id, conversionId: conversion.id };
  });

  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
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

  return NextResponse.json({ applicationId, employeeId: created.employeeId, conversionId: created.conversionId }, { status: 201 });
}
