import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parsePayrollImportWorkbook } from '@/lib/payroll-import-template';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requestedClientId = String(formData.get('clientId') ?? '').trim();
    const month = parseInt(String(formData.get('month') ?? ''), 10);
    const year = parseInt(String(formData.get('year') ?? ''), 10);
    if (!file || !Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year)) {
      return NextResponse.json({ error: 'file, month, and year are required.' }, { status: 400 });
    }

    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

    const client = await prisma.outsourcingClient.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, invalidRows } = await parsePayrollImportWorkbook(buffer);
    const idValues = [
      ...new Set(
        rows
          .map((r) => normalizeEmployeeNationalId(r.nationalId))
          .filter((x): x is string => Boolean(x)),
      ),
    ];

    const employees = await prisma.employee.findMany({
      where: {
        outsourcingClientId: clientId,
        idNumber: { in: idValues },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        idNumber: true,
        baseSalary: true,
      },
    });
    const employeeByIdNumber = new Map(
      employees.map((e) => [normalizeEmployeeNationalId(e.idNumber) ?? '', e]),
    );

    const duplicateNationalIds: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const key = normalizeEmployeeNationalId(r.nationalId) ?? '';
      if (!key) continue;
      if (seen.has(key) && !duplicateNationalIds.includes(r.nationalId)) duplicateNationalIds.push(r.nationalId);
      seen.add(key);
    }

    const matchedRows = [];
    const unmatchedRows = [];
    const duplicateRows = rows
      .filter((row) =>
        duplicateNationalIds.some(
          (id) => normalizeEmployeeNationalId(id) === normalizeEmployeeNationalId(row.nationalId),
        ),
      )
      .map((row) => ({
        row: row.excelRow,
        nationalId: row.nationalId,
        employeeName: row.employeeName,
        input: {
          grossPay: row.grossPay,
          daysWorked: row.daysWorked,
        },
      }));
    for (const row of rows) {
      const key = normalizeEmployeeNationalId(row.nationalId) ?? '';
      const employee = key ? employeeByIdNumber.get(key) : undefined;
      if (!employee) {
        unmatchedRows.push({
          row: row.excelRow,
          nationalId: row.nationalId,
          employeeName: row.employeeName,
          email: row.email,
          reason: 'Employee with this National ID was not found for the selected client.',
          seed: {
            nationalId: row.nationalId,
            employeeName: row.employeeName,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
          },
          input: {
            daysWorked: row.daysWorked,
            incentives: row.incentives,
            allowances: row.allowances,
            overtime: row.overtime,
            holidayPay: row.holidayPay,
            leavePay: row.leavePay,
            grossPay: row.grossPay,
          },
        });
        continue;
      }
      matchedRows.push({
        row: row.excelRow,
        nationalId: row.nationalId,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeEmail: employee.email,
        baseSalary: employee.baseSalary != null ? Number(employee.baseSalary) : null,
        input: {
          daysWorked: row.daysWorked,
          incentives: row.incentives,
          allowances: row.allowances,
          overtime: row.overtime,
          holidayPay: row.holidayPay,
          leavePay: row.leavePay,
          grossPay: row.grossPay,
        },
      });
    }

    const invalidGrossRows = matchedRows
      .filter((row) => row.baseSalary != null && row.input.grossPay < row.baseSalary)
      .map((row) => ({
        row: row.row,
        nationalId: row.nationalId,
        grossPay: row.input.grossPay,
        baseSalary: row.baseSalary as number,
        reason: `Gross Pay (${row.input.grossPay}) cannot be lower than Base Salary (${row.baseSalary}) for National ID ${row.nationalId}.`,
      }));
    const allInvalidRows = [...invalidRows, ...invalidGrossRows];

    return NextResponse.json({
      month,
      year,
      clientId,
      totals: {
        parsedRows: rows.length,
        matched: matchedRows.length,
        unmatched: unmatchedRows.length,
        invalid: allInvalidRows.length,
      },
      duplicateNationalIds,
      duplicateRows,
      grossBelowBaseRows: invalidGrossRows,
      matchedRows,
      unmatchedRows,
      invalidRows: allInvalidRows,
    });
  } catch (e) {
    console.error('[outsourcing/payroll/import/preview]', e);
    return NextResponse.json({ error: 'Failed to preview payroll input sheet.' }, { status: 500 });
  }
}
