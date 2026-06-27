import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';
import { generatePayslipPdf } from '@/lib/payslip-pdf';
import { logSensitiveFieldAccess } from '@/lib/sensitive-access-log';

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });

    const payroll = await ctx.run((tx) =>
      tx.payroll.findFirst({
        where: ctx.where({ id, employeeId: ctx.employeeId! }),
        include: {
          employee: {
            include: {
              client: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
        },
      }),
    );

    if (!payroll) return NextResponse.json({ error: 'Payslip not found.' }, { status: 404 });

    await logSensitiveFieldAccess({
      actor: { userId: ctx.essUser.id, email: ctx.essUser.email, name: ctx.essUser.name },
      fieldGroup: 'payslip',
      entityType: 'Payroll',
      entityId: payroll.id,
      route: 'GET /api/ess/payslips/[id]/pdf',
      metadata: { month: payroll.month, year: payroll.year },
    });

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
  });
}
