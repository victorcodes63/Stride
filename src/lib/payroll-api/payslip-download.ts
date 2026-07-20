import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';
import { generatePayslipPdf, mergePdfBuffers, type PayslipPdfData } from '@/lib/payslip-pdf';
import { isBiweeklyClient } from '@/lib/biweekly-payroll';
import { normalizeAttendance } from '@/lib/biweekly-attendance';
import { resolvePayrollClientId, payrollApiBase, type PayrollHandlerOptions } from './scope';

type RouteContext = { params: Promise<{ id: string }> };

const PAYSLIP_EMPLOYEE_INCLUDE = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      client: { select: { name: true, payrollFrequency: true } },
      department: { select: { name: true } },
    },
  },
} as const;

type PayslipRow = {
  month: number;
  year: number;
  basicPay: unknown;
  allowances: unknown;
  deductions: unknown;
  grossPay: unknown;
  leavePay: unknown;
  paye: unknown;
  nssf: unknown;
  nhif: unknown;
  ahl: unknown;
  nita: unknown;
  netPay: unknown;
  period1Gross: unknown;
  period2Gross: unknown;
  biweeklyAttendance: unknown;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    client: { name: string; payrollFrequency: string | null };
    department: { name: string } | null;
  };
};

function num(value: unknown): string {
  return String(Number(value ?? 0));
}

function buildPayslipData(p: PayslipRow): PayslipPdfData {
  const employeeName = `${p.employee.firstName} ${p.employee.lastName}`.trim();
  const allowances = Array.isArray(p.allowances) ? (p.allowances as { name: string; amount: number }[]) : [];
  const deductions = Array.isArray(p.deductions) ? (p.deductions as { name: string; amount: number }[]) : [];
  const biweekly =
    isBiweeklyClient(p.employee.client.payrollFrequency) && p.period1Gross != null && p.period2Gross != null;

  return {
    employeeName,
    employeeNumber: p.employee.employeeNumber,
    clientName: p.employee.client.name,
    departmentName: p.employee.department?.name ?? null,
    basicPay: num(p.basicPay),
    allowances,
    deductions,
    grossPay: num(p.grossPay),
    leavePay: num(p.leavePay),
    paye: num(p.paye),
    nssf: num(p.nssf),
    nhif: num(p.nhif),
    ahl: num(p.ahl),
    employerNita: num(p.nita),
    netPay: num(p.netPay),
    ...(biweekly
      ? {
          biweekly: true,
          period1Gross: num(p.period1Gross),
          period2Gross: num(p.period2Gross),
          biweeklyAttendance: normalizeAttendance(p.biweeklyAttendance, p.year, p.month),
        }
      : {}),
  };
}

function pdfResponse(buffer: Buffer, filename: string, inline: boolean): NextResponse {
  const disposition = inline ? 'inline' : 'attachment';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function slug(value: string): string {
  return value.replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'payslip';
}

/** GET /api/(outsourcing/)payroll/[id]/pdf — single payslip PDF (preview or download). */
export function createPayrollPayslipPdfHandler(_options: PayrollHandlerOptions) {
  return async function GET(request: NextRequest, { params }: RouteContext) {
    return withTenant(request, async (ctx) => {
      if (!canAccessPayroll(ctx.staff)) {
        return forbiddenResponse('Payroll access is restricted to finance and admins.');
      }
      const { id } = await params;
      const p = await ctx.run((tx) =>
        tx.payroll.findFirst({
          where: { ...ctx.where(), id },
          include: PAYSLIP_EMPLOYEE_INCLUDE,
        }),
      );
      if (!p) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });

      const pdf = await generatePayslipPdf(buildPayslipData(p as unknown as PayslipRow), p.month, p.year);
      const name = `${p.employee.firstName} ${p.employee.lastName}`.trim();
      const filename = `payslip-${slug(name)}-${p.year}-${String(p.month).padStart(2, '0')}.pdf`;
      const inline = request.nextUrl.searchParams.get('inline') === '1';
      return pdfResponse(pdf, filename, inline);
    });
  };
}

/** GET /api/(outsourcing/)payroll/payslips-pdf — combined multi-page PDF for a period. */
export function createPayrollPayslipsPdfHandler({ scope }: PayrollHandlerOptions) {
  return async function GET(request: NextRequest) {
    return withTenant(request, async (ctx) => {
      if (!canAccessPayroll(ctx.staff)) {
        return forbiddenResponse('Payroll access is restricted to finance and admins.');
      }
      const sp = request.nextUrl.searchParams;
      const month = sp.get('month') ? parseInt(sp.get('month')!, 10) : new Date().getMonth() + 1;
      const year = sp.get('year') ? parseInt(sp.get('year')!, 10) : new Date().getFullYear();
      if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
        return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
      }
      const requestedClientId = sp.get('clientId') || undefined;
      const departmentId = sp.get('departmentId') || undefined;
      const employeeIds = (sp.get('employeeIds') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const clientId = await resolvePayrollClientId(
        scope,
        prisma,
        requestedClientId,
        request,
        ctx.organizationId,
      );

      const rows = await ctx.run((tx) =>
        tx.payroll.findMany({
          where: {
            ...ctx.where(),
            month,
            year,
            ...(employeeIds.length
              ? { employeeId: { in: employeeIds } }
              : {
                  employee: {
                    outsourcingClientId: clientId,
                    ...(departmentId ? { departmentId } : {}),
                    client: { organizationId: ctx.organizationId },
                  },
                }),
          },
          include: PAYSLIP_EMPLOYEE_INCLUDE,
          orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
        }),
      );

      if (rows.length === 0) {
        return NextResponse.json({ error: 'No payslips found for this period' }, { status: 404 });
      }

      const buffers: Buffer[] = [];
      for (const p of rows) {
        buffers.push(await generatePayslipPdf(buildPayslipData(p as unknown as PayslipRow), p.month, p.year));
      }
      const merged = await mergePdfBuffers(buffers);

      await ctx.audit({
        action: 'payslip.exported',
        entityType: 'PayrollBatch',
        entityId: `${year}-${month}-${clientId}`,
        route: `GET ${payrollApiBase(scope)}/payslips-pdf`,
        metadata: { month, year, count: rows.length },
      });

      const filename = `payslips-${year}-${String(month).padStart(2, '0')}.pdf`;
      const inline = sp.get('inline') === '1';
      return pdfResponse(merged, filename, inline);
    });
  };
}
