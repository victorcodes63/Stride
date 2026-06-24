import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });

  const status = request.nextUrl.searchParams.get('status')?.trim().toLowerCase();
  const clientId = await resolvePrimaryWorkspaceClientId(
    prisma,
    request.nextUrl.searchParams.get('clientId'),
    request,
  );

  const rows = await prisma.leaveApplication.findMany({
    where: {
      employee: { outsourcingClientId: clientId },
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      leaveType: { select: { id: true, name: true } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          department: { select: { name: true } },
        },
      },
    },
    take: 200,
  });

  return NextResponse.json(
    rows.map((item) => ({
      id: item.id,
      employeeId: item.employeeId,
      employeeName: `${item.employee.firstName} ${item.employee.lastName}`.trim(),
      employeeNumber: item.employee.employeeNumber,
      departmentName: item.employee.department?.name ?? null,
      leaveTypeId: item.leaveTypeId,
      leaveTypeName: item.leaveType.name,
      startDate: item.startDate.toISOString().slice(0, 10),
      endDate: item.endDate.toISOString().slice(0, 10),
      days: item.days,
      status: item.status,
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
    })),
  );
}
