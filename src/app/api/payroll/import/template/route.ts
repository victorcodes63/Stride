import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

const HEADERS = [
  'EMP No.',
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Job Title',
  'National ID',
  'KRA PIN',
  'NSSF Number',
  'NHIF Number',
  'Date of Joining (YYYY-MM-DD)',
  'Bank Name',
  'Bank Branch',
  'Bank Account Number',
  'Department Name',
  'Base Salary (monthly)',
] as const;

const EXAMPLE_ROW = [
  '001',
  'John',
  'Doe',
  'john.doe@example.com',
  '+254 700 123 456',
  'Accountant',
  '12345678',
  'A001234567K',
  '12345678901',
  '98765432101',
  '2024-01-15',
  'Equity',
  'Westlands',
  '01234567890',
  'Finance',
  '85000',
];

const PAYROLL_INPUT_HEADERS = [
  'Days Worked',
  'Incentives',
  'Allowances',
  'Overtime',
  'Holiday Pay',
  'Leave Pay',
  'Gross Pay',
] as const;

/**
 * Payroll-input template for the company's own workforce (primary workspace client).
 * Payroll-module scoped so internal payroll never depends on the HR Outsourcing module.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessPayroll(ctx.staff)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const { client, clientEmployees } = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          null,
          request,
          ctx.organizationId,
        );

        const c = await tx.outsourcingClient.findFirst({
          where: ctx.where({ id: clientId }),
          select: { id: true, name: true },
        });
        if (!c) return { client: null, clientEmployees: [] as Array<never> };

        const rows = await tx.employee.findMany({
          where: ctx.where({ outsourcingClientId: c.id }),
          include: { department: { select: { name: true } } },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
        const resolvedEmployees = rows.map((r) => ({
          employeeNumber: r.employeeNumber,
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          phone: r.phone,
          jobTitle: r.jobTitle,
          idNumber: r.idNumber,
          kraPin: r.kraPin,
          nssfNumber: r.nssfNumber,
          nhifNumber: r.nhifNumber,
          dateOfJoining: r.dateOfJoining,
          bankName: r.bankName,
          bankBranch: r.bankBranch,
          bankAccountNumber: r.bankAccountNumber,
          baseSalary: r.baseSalary as unknown,
          department: r.department ? { name: r.department.name } : null,
        }));
        return { client: c, clientEmployees: resolvedEmployees };
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Stride';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Payroll Input', {
        views: [{ state: 'frozen', ySplit: 2 }],
        properties: { tabColor: { argb: 'FF043d4a' } },
      });

      const clientInfo = client ? `Payroll input for: ${client.name}. ` : 'Payroll input template. ';
      sheet.addRow([
        `${clientInfo}Template includes existing employee fields plus payroll input columns. National ID is the strict match key. Fill payroll input columns (Days Worked, Incentives, Allowances, Overtime, Holiday Pay, Leave Pay, Gross Pay).`,
      ]);
      sheet.mergeCells('A1:W1');
      const instructionRow = sheet.getRow(1);
      instructionRow.font = { italic: true, size: 10, color: { argb: 'FF6b7280' } };
      instructionRow.height = 36;
      instructionRow.alignment = { wrapText: true, vertical: 'middle' };

      const headers = [...HEADERS, ...PAYROLL_INPUT_HEADERS];
      sheet.addRow(headers);
      const headerRow = sheet.getRow(2);
      headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF043d4a' } };
      headerRow.alignment = { wrapText: true, vertical: 'middle' };
      headerRow.height = 22;

      if (clientEmployees.length > 0) {
        for (const e of clientEmployees) {
          sheet.addRow([
            e.employeeNumber ?? '',
            e.firstName,
            e.lastName,
            e.email ?? '',
            e.phone ?? '',
            e.jobTitle ?? '',
            e.idNumber ?? '',
            e.kraPin ?? '',
            e.nssfNumber ?? '',
            e.nhifNumber ?? '',
            e.dateOfJoining ? e.dateOfJoining.toISOString().slice(0, 10) : '',
            e.bankName ?? '',
            e.bankBranch ?? '',
            e.bankAccountNumber ?? '',
            e.department?.name ?? '',
            e.baseSalary != null ? String(e.baseSalary) : '',
            '', '', '', '', '', '', '',
          ]);
        }
      } else {
        sheet.addRow([...EXAMPLE_ROW, '30', '2500', '1000', '0', '0', '0', '88500']);
        const exampleRow = sheet.getRow(3);
        exampleRow.font = { italic: true, size: 10, color: { argb: 'FF9ca3af' } };
      }

      sheet.columns = headers.map((_, i) => ({ width: i <= 3 ? 20 : 16 }));

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = client
        ? `payroll-input-template-${client.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`
        : 'payroll-input-template.xlsx';

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (e) {
      console.error('[payroll/import/template]', e);
      return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
    }
  });
}
