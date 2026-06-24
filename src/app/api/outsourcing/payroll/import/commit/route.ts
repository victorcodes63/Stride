import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { parsePayrollImportWorkbook } from '@/lib/payroll-import-template';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { calculateStatutoryForPayroll } from '@/lib/payroll-calc';
import { mapOutsourcingClientsToAccountsClients } from '@/lib/payroll-accounts-link';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';

function toDecimal(n: number): Decimal {
  return new Decimal(Math.round((n + Number.EPSILON) * 100) / 100);
}

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

    const client = await prisma.outsourcingClient.findUnique({
      where: { id: clientId },
      select: { id: true, leavePayMode: true },
    });
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, invalidRows } = await parsePayrollImportWorkbook(buffer);
    if (invalidRows.length > 0) {
      return NextResponse.json({
        error: 'Resolve invalid rows before committing.',
        invalidRows,
      }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid data rows found.' }, { status: 400 });
    }

    const duplicateGroups = new Map<string, { nationalId: string; rowNumbers: number[] }>();
    for (const row of rows) {
      const key = normalizeEmployeeNationalId(row.nationalId) ?? '';
      const existing = duplicateGroups.get(key);
      if (existing) {
        existing.rowNumbers.push(row.excelRow);
      } else {
        duplicateGroups.set(key, { nationalId: row.nationalId, rowNumbers: [row.excelRow] });
      }
    }
    const duplicateNationalIds = Array.from(duplicateGroups.values())
      .filter((g) => g.rowNumbers.length > 1)
      .map((g) => g.nationalId);

    let duplicateResolution: Record<string, number> = {};
    const duplicateResolutionRaw = String(formData.get('duplicateResolution') ?? '').trim();
    if (duplicateResolutionRaw) {
      try {
        const parsed = JSON.parse(duplicateResolutionRaw) as Record<string, unknown>;
        duplicateResolution = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [normalizeEmployeeNationalId(k) ?? '', Number(v)]),
        );
      } catch {
        return NextResponse.json({
          error: 'Invalid duplicate resolution payload. Re-upload the file and try again.',
        }, { status: 400 });
      }
    }
    const duplicateAction = String(formData.get('duplicateAction') ?? '').trim().toLowerCase();
    const acceptSheetValueUpdates = String(formData.get('acceptSheetValueUpdates') ?? '').trim().toLowerCase() === 'true';

    let rowsToCommit = rows;
    if (duplicateNationalIds.length > 0) {
      if (duplicateAction !== 'purge') {
        return NextResponse.json({
          error:
            'Duplicate National IDs found in the uploaded sheet. Choose the correct row per duplicate and purge extras, or re-upload a corrected sheet.',
          duplicateNationalIds,
          duplicateRowOptions: Array.from(duplicateGroups.values()).filter((g) => g.rowNumbers.length > 1),
        }, { status: 400 });
      }

      const unresolved = Array.from(duplicateGroups.entries())
        .filter(([, g]) => g.rowNumbers.length > 1)
        .filter(([key, g]) => !g.rowNumbers.includes(duplicateResolution[key]));
      if (unresolved.length > 0) {
        return NextResponse.json({
          error:
            'Duplicate National IDs found in the uploaded sheet. Choose one valid row for each duplicate ID, then try commit again.',
          duplicateNationalIds,
          unresolvedDuplicateIds: unresolved.map(([, g]) => g.nationalId),
        }, { status: 400 });
      }

      rowsToCommit = rows.filter((row) => {
        const key = normalizeEmployeeNationalId(row.nationalId) ?? '';
        const group = duplicateGroups.get(key);
        if (!group || group.rowNumbers.length <= 1) return true;
        return row.excelRow === duplicateResolution[key];
      });
    }

    const idValues = [
      ...new Set(
        rowsToCommit
          .map((r) => normalizeEmployeeNationalId(r.nationalId))
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const employees = await prisma.employee.findMany({
      where: { outsourcingClientId: clientId, idNumber: { in: idValues } },
      select: { id: true, idNumber: true, baseSalary: true, outsourcingClientId: true },
    });
    const employeeByIdNumber = new Map(
      employees.map((e) => [normalizeEmployeeNationalId(e.idNumber) ?? '', e]),
    );
    const accountsByOutsourcing = await mapOutsourcingClientsToAccountsClients([clientId]);

    const unmatchedRows = rowsToCommit
      .filter((r) => !employeeByIdNumber.has(normalizeEmployeeNationalId(r.nationalId) ?? ''))
      .map((r) => ({ row: r.excelRow, nationalId: r.nationalId }));
    if (unmatchedRows.length > 0) {
      return NextResponse.json({
        error: 'Some rows are unmatched. Create missing employees or remove those rows first.',
        unmatchedRows,
      }, { status: 400 });
    }

    const grossBelowBaseRows = rowsToCommit
      .map((row) => {
        const employee = employeeByIdNumber.get(normalizeEmployeeNationalId(row.nationalId) ?? '');
        const baseSalary = employee?.baseSalary != null ? Number(employee.baseSalary) : null;
        return { row: row.excelRow, nationalId: row.nationalId, grossPay: row.grossPay, baseSalary };
      })
      .filter((x) => x.baseSalary != null && x.grossPay < (x.baseSalary as number))
      .map((x) => ({
        row: x.row,
        nationalId: x.nationalId,
        reason: `Gross Pay (${x.grossPay}) cannot be lower than Base Salary (${x.baseSalary}).`,
      }));
    if (grossBelowBaseRows.length > 0) {
      if (!acceptSheetValueUpdates) {
        return NextResponse.json({
          error: 'Some rows have Gross Pay lower than Base Salary. Fix the sheet and try again.',
          invalidRows: grossBelowBaseRows,
        }, { status: 400 });
      }
      // User explicitly opted to accept sheet values as updates:
      // align employee base salary down to the uploaded gross pay for these rows.
      for (const row of rowsToCommit) {
        const employee = employeeByIdNumber.get(normalizeEmployeeNationalId(row.nationalId) ?? '');
        if (!employee || employee.baseSalary == null) continue;
        const currentBase = Number(employee.baseSalary);
        if (row.grossPay < currentBase) {
          await prisma.employee.update({
            where: { id: employee.id },
            data: { baseSalary: toDecimal(row.grossPay) },
          });
          employee.baseSalary = toDecimal(row.grossPay);
        }
      }
    }
    const existing = await prisma.payroll.findMany({
      where: {
        month,
        year,
        employeeId: { in: employees.map((e) => e.id) },
      },
      select: { id: true, employeeId: true, status: true },
    });
    const existingByEmployee = new Map(existing.map((e) => [e.employeeId, e]));

    let updated = 0;
    let created = 0;
    const skipped: Array<{ row: number; nationalId: string; reason: string }> = [];

    for (const row of rowsToCommit) {
      const employee = employeeByIdNumber.get(normalizeEmployeeNationalId(row.nationalId) ?? '');
      if (!employee) continue;
      const leavePayMode = client.leavePayMode ?? 'none';
      const leavePay = Math.max(0, row.leavePay);
      const grossPay = Math.max(0, row.grossPay);
      const employmentGross = leavePayMode === 'none' ? grossPay : Math.max(0, grossPay - leavePay);
      const statutory = calculateStatutoryForPayroll(leavePayMode, employmentGross, leavePay, 0);

      const allowances = [
        { name: 'Incentives', amount: row.incentives },
        { name: 'Allowances', amount: row.allowances },
        { name: 'Overtime', amount: row.overtime },
        { name: 'Holiday Pay', amount: row.holidayPay },
      ].filter((x) => x.amount > 0);

      const daysWorkedLine =
        row.daysWorked != null ? [{ name: 'Days Worked', amount: row.daysWorked }] : [];

      const payload = {
        accountsClientId: accountsByOutsourcing.get(employee.outsourcingClientId) ?? null,
        basicPay: toDecimal(employee.baseSalary != null ? Number(employee.baseSalary) : grossPay),
        grossPay: toDecimal(grossPay),
        leavePay: toDecimal(leavePay),
        paye: toDecimal(statutory.paye),
        nssf: toDecimal(statutory.nssf),
        nhif: toDecimal(statutory.nhif),
        ahl: toDecimal(statutory.ahl),
        nita: toDecimal(statutory.nita),
        netPay: toDecimal(statutory.netPay),
        allowances: [...allowances, ...daysWorkedLine],
        deductions: [],
      };

      const existingPayroll = existingByEmployee.get(employee.id);
      if (existingPayroll) {
        if (existingPayroll.status !== 'draft') {
          skipped.push({
            row: row.excelRow,
            nationalId: row.nationalId,
            reason: `Payroll is ${existingPayroll.status} for this period and cannot be overwritten.`,
          });
          continue;
        }
        await prisma.payroll.update({
          where: { id: existingPayroll.id },
          data: payload,
        });
        updated += 1;
        continue;
      }

      await prisma.payroll.create({
        data: {
          employeeId: employee.id,
          month,
          year,
          ...payload,
        },
      });
      created += 1;
    }

    return NextResponse.json({
      created,
      updated,
      skipped: skipped.length,
      skippedDetails: skipped.slice(0, 50),
      message: `Payroll import complete for ${month}/${year}. Created ${created}, updated ${updated}, skipped ${skipped.length}.`,
    });
  } catch (e) {
    console.error('[outsourcing/payroll/import/commit]', e);
    return NextResponse.json({ error: 'Failed to commit payroll import.' }, { status: 500 });
  }
}
