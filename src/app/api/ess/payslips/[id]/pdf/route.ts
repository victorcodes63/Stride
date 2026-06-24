import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { generatePayslipPdf } from '@/lib/payslip-pdf';

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });

  const { id } = await params;
  const payroll = await prisma.payroll.findFirst({
    where: { id, employeeId: user.employeeId },
    include: {
      employee: {
        include: {
          client: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
  });

  if (!payroll) return NextResponse.json({ error: 'Payslip not found.' }, { status: 404 });

  const employeeName = `${payroll.employee.firstName} ${payroll.employee.lastName}`.trim();
  const allowances = Array.isArray(payroll.allowances) ? (payroll.allowances as { name: string; amount: number }[]) : [];
  const deductions = Array.isArray(payroll.deductions) ? (payroll.deductions as { name: string; amount: number }[]) : [];

  const pdfBuffer = await generatePayslipPdf(
    {
      employeeName,
      employeeNumber: payroll.employee.employeeNumber,
      clientName: payroll.employee.client.name,
      departmentName: payroll.employee.department?.name ?? null,
      basicPay: String(asNumber(payroll.basicPay)),
      allowances,
      deductions,
      grossPay: String(asNumber(payroll.grossPay)),
      leavePay: String(asNumber(payroll.leavePay)),
      paye: String(asNumber(payroll.paye)),
      nssf: String(asNumber(payroll.nssf)),
      nhif: String(asNumber(payroll.nhif)),
      ahl: String(asNumber(payroll.ahl)),
      employerNita: String(asNumber(payroll.nita)),
      netPay: String(asNumber(payroll.netPay)),
    },
    payroll.month,
    payroll.year,
  );

  const filename = `payslip-${payroll.year}-${String(payroll.month).padStart(2, '0')}.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
