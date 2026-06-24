import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedClientId = searchParams.get('clientId') || undefined;
  const mode = (searchParams.get('mode') || '').trim().toLowerCase();
  const isPayrollTemplate = mode === 'payroll-input';

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

    let client: { id: string; name: string; departments: { name: string }[] } | null = null;
    let clientEmployees: Array<{
      employeeNumber: string | null;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      jobTitle: string | null;
      idNumber: string | null;
      kraPin: string | null;
      nssfNumber: string | null;
      nhifNumber: string | null;
      dateOfJoining: Date | null;
      bankName: string | null;
      bankBranch: string | null;
      bankAccountNumber: string | null;
      baseSalary: unknown;
      department: { name: string } | null;
    }> = [];
    const c = await prisma.outsourcingClient.findUnique({
      where: { id: clientId },
      include: { departments: { orderBy: { name: 'asc' } } },
    });
    if (c) client = c;
    if (c && isPayrollTemplate) {
      const rows = await prisma.employee.findMany({
        where: { outsourcingClientId: c.id },
        include: { department: { select: { name: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      clientEmployees = rows.map((r) => ({
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
        baseSalary: r.baseSalary,
        department: r.department ? { name: r.department.name } : null,
      }));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Stride';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(isPayrollTemplate ? 'Payroll Input' : 'Employees', {
      views: [{ state: 'frozen', ySplit: 2 }],
      properties: { tabColor: { argb: 'FF043d4a' } },
    });

    // Instructions row
    if (isPayrollTemplate) {
      const clientInfo = client
        ? `Payroll input for: ${client.name}. `
        : 'Payroll input template. ';
      sheet.addRow([
        `${clientInfo}Template includes existing employee fields plus payroll input columns. National ID is the strict match key. Fill payroll input columns (Days Worked, Incentives, Allowances, Overtime, Holiday Pay, Leave Pay, Gross Pay).`,
      ]);
      sheet.mergeCells('A1:W1');
    } else {
      const deptList = client && client.departments.length > 0
        ? ` Departments for ${client.name}: ${client.departments.map((d) => d.name).join(', ')}`
        : client
          ? ' Add departments in the client detail page first.'
          : ' Select a client when importing. Department Name must match the client\'s departments exactly or leave blank.';
      const clientInfo = client ? `Import employees for: ${client.name}. ` : 'Import employees. Fill rows below, then select a client and use Import. ';
      sheet.addRow([
        `${clientInfo}Required: First Name, Last Name. Email optional (add later in Edit for e-payslips). National ID must be unique in the system when provided (no duplicate IDs). Department Name must match exactly or leave blank.${deptList}`,
      ]);
      sheet.mergeCells('A1:P1');
    }
    const instructionRow = sheet.getRow(1);
    instructionRow.font = { italic: true, size: 10, color: { argb: 'FF6b7280' } };
    instructionRow.height = 36;
    instructionRow.alignment = { wrapText: true, vertical: 'middle' };

    // Headers
    const headers = isPayrollTemplate ? [...HEADERS, ...PAYROLL_INPUT_HEADERS] : [...HEADERS];
    sheet.addRow(headers);
    const headerRow = sheet.getRow(2);
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF043d4a' },
    };
    headerRow.alignment = { wrapText: true, vertical: 'middle' };
    headerRow.height = 22;

    // Data rows / example row
    if (isPayrollTemplate && clientEmployees.length > 0) {
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
          '', // Days Worked
          '', // Incentives
          '', // Allowances
          '', // Overtime
          '', // Holiday Pay
          '', // Leave Pay
          '', // Gross Pay
        ]);
      }
    } else {
      const fallbackRow = isPayrollTemplate
        ? [...EXAMPLE_ROW, '30', '2500', '1000', '0', '0', '0', '88500']
        : EXAMPLE_ROW;
      sheet.addRow(fallbackRow);
      const exampleRow = sheet.getRow(3);
      exampleRow.font = { italic: true, size: 10, color: { argb: 'FF9ca3af' } };
    }

    // Set column widths
    sheet.columns = headers.map((_, i) => {
      if (isPayrollTemplate) return { width: i <= 3 ? 20 : 16 };
      return { width: i === 0 ? 10 : i <= 4 ? 20 : i === 10 ? 22 : 18 };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = isPayrollTemplate
      ? (client
        ? `payroll-input-template-${client.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`
        : 'payroll-input-template.xlsx')
      : (client
        ? `employee-import-template-${client.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`
        : 'employee-import-template.xlsx');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('[employees/template]', e);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
