import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { Decimal } from '@prisma/client/runtime/library';
import {
  allocateNextEmployeeNumber,
  deriveEmployeePrefixFromName,
} from '@/lib/outsourcing-employee-number';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

const HEADER_MAP: Record<string, string> = {
  'EMP No.': 'employeeNumber',
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'Email': 'email',
  'Phone': 'phone',
  'Job Title': 'jobTitle',
  'National ID': 'idNumber',
  'KRA PIN': 'kraPin',
  'NSSF Number': 'nssfNumber',
  'NHIF Number': 'nhifNumber',
  'Date of Joining (YYYY-MM-DD)': 'dateOfJoining',
  'Bank Name': 'bankName',
  'Bank Branch': 'bankBranch',
  'Bank Account Number': 'bankAccountNumber',
  'Department Name': 'departmentName',
  'Base Salary (monthly)': 'baseSalary',
  'Monthly Basic (KES)': 'baseSalary',
};

function parseDate(val: unknown): Date | null {
  if (val == null) return null;
  if (typeof val === 'object' && val instanceof Date && !isNaN(val.getTime())) return val;
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseString(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string') {
    const s = val.trim();
    return s || null;
  }

  // ExcelJS can represent some cells (hyperlinks / rich text / formulas) as objects.
  // Normalize the common shapes we expect so downstream validation doesn't see "[object Object]".
  if (typeof val === 'object') {
    const v = val as Record<string, unknown>;
    if (typeof v.text === 'string') {
      const s = v.text.trim();
      return s || null;
    }
    if (v.result !== undefined) return parseString(v.result);
    if (Array.isArray(v.richText)) {
      const s = v.richText
        .map((rt: unknown) => {
          const r = rt as Record<string, unknown>;
          return typeof r?.text === 'string' ? r.text : '';
        })
        .join('')
        .trim();
      return s || null;
    }
  }

  const s = String(val).trim();
  return s || null;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requestedClientId = formData.get('clientId') as string | null;
    const autoCreateDepartmentsRaw = formData.get('autoCreateDepartments');
    const autoCreateDepartments =
      autoCreateDepartmentsRaw === 'true' || autoCreateDepartmentsRaw === '1';

    if (!file) {
      return NextResponse.json(
        { error: 'file is required.' },
        { status: 400 }
      );
    }

    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId?.trim() ?? null, request);

    const client = await prisma.outsourcingClient.findUnique({
      where: { id: clientId },
      include: { departments: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const deptByName = new Map(client.departments.map((d) => [d.name.toLowerCase().trim(), d.id]));

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0]);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: 'The Excel file has no worksheets.' }, { status: 400 });
    }

    const allRows: unknown[][] = [];
    const maxCols = 16;
    sheet.eachRow((row, rowNumber) => {
      const vals: unknown[] = [];
      for (let c = 1; c <= maxCols; c++) {
        vals[c - 1] = row.getCell(c).value;
      }
      allRows[rowNumber - 1] = vals;
    });

    if (allRows.length < 2) {
      return NextResponse.json({ error: 'The file has no data rows (header + at least 1 row).' }, { status: 400 });
    }

    // The downloaded template includes an instruction row above the header row.
    // We must *not* treat that instruction row as the header, because it contains
    // the words "First Name", "Last Name", and "Email" inside a sentence.
    // So we detect the header row by requiring exact cell matches.
    let headerRowIndex = -1;
    const maxHeaderSearchRows = Math.min(allRows.length, 6);
    for (let r = 0; r < maxHeaderSearchRows; r++) {
      const row = (allRows[r] ?? []) as unknown[];
      const cellStrings = row.map((c) => String(c ?? '').trim().replace(/\s+/g, ' '));
      const hasFirst = cellStrings.some((c) => c.toLowerCase() === 'first name');
      const hasLast = cellStrings.some((c) => c.toLowerCase() === 'last name');
      if (hasFirst && hasLast) {
        headerRowIndex = r;
        break;
      }
    }

    // Fallback: if we couldn't detect, assume the first row is the header.
    if (headerRowIndex === -1) headerRowIndex = 0;

    const headerCells = (allRows[headerRowIndex] ?? []) as unknown[];
    const dataStartRow = headerRowIndex + 1;
    const colIndex: Record<string, number> = {};
    for (const [header, key] of Object.entries(HEADER_MAP)) {
      const idx = headerCells.findIndex((c) => String(c ?? '').trim() === header);
      if (idx >= 0) colIndex[key] = idx;
    }
    const firstNameIdx = colIndex.firstName ?? headerCells.findIndex((c) => /first\s*name/i.test(String(c ?? '')));
    const lastNameIdx = colIndex.lastName ?? headerCells.findIndex((c) => /last\s*name/i.test(String(c ?? '')));
    const emailIdx = colIndex.email ?? headerCells.findIndex((c) => /^email$/i.test(String(c ?? '').trim()));

    if (firstNameIdx < 0 || lastNameIdx < 0) {
      return NextResponse.json({
        error: 'Could not find required columns: First Name, Last Name. Use the download template.',
      }, { status: 400 });
    }

    const getVal = (row: unknown[], key: string) => {
      const idx = colIndex[key];
      return idx != null ? row[idx] : undefined;
    };

    // Pass 1: detect departments referenced in the Excel file but missing for this client.
    // If caller did not ask to auto-create, return early so the UI can prompt the user.
    const missingDepartmentsByNormalized = new Map<string, string>(); // normalized -> displayName
    for (let r = dataStartRow; r < allRows.length; r++) {
      const row = allRows[r] ?? [];
      const departmentName = parseString(getVal(row, 'departmentName'));
      if (!departmentName) continue;

      const normalized = departmentName.toLowerCase().trim();
      if (!normalized) continue;
      if (deptByName.has(normalized)) continue;

      if (!missingDepartmentsByNormalized.has(normalized)) {
        missingDepartmentsByNormalized.set(normalized, departmentName.trim());
      }
    }

    if (missingDepartmentsByNormalized.size > 0 && !autoCreateDepartments) {
      return NextResponse.json({
        needsDepartmentCreation: true,
        missingDepartments: Array.from(missingDepartmentsByNormalized.values()),
      });
    }

    // Auto-create missing departments when requested.
    if (missingDepartmentsByNormalized.size > 0 && autoCreateDepartments) {
      for (const deptDisplayName of missingDepartmentsByNormalized.values()) {
        const createdDept = await prisma.department.create({
          data: {
            outsourcingClientId: clientId,
            name: deptDisplayName,
          },
        });
        deptByName.set(deptDisplayName.toLowerCase().trim(), createdDept.id);
      }
    }

    const created: string[] = [];
    const skipped: { row: number; reason: string }[] = [];
    const errors: { row: number; reason: string }[] = [];
    const nationalIdsSeenThisFile = new Set<string>();

    for (let r = dataStartRow; r < allRows.length; r++) {
      const row = allRows[r] ?? [];
      const rowNum = r + 1; // Excel row number (1-indexed)
      const firstName = parseString(getVal(row, 'firstName') ?? row[firstNameIdx]);
      const lastName = parseString(getVal(row, 'lastName') ?? row[lastNameIdx]);
      const emailRaw = parseString(
        emailIdx >= 0 ? getVal(row, 'email') ?? row[emailIdx] : getVal(row, 'email')
      );

      if (!firstName || !lastName) {
        if (!firstName && !lastName && !emailRaw) {
          skipped.push({ row: rowNum, reason: 'Empty row' });
        } else {
          errors.push({ row: rowNum, reason: 'Missing required field: First Name or Last Name' });
        }
        continue;
      }

      let emailNorm: string | null = null;
      if (emailRaw) {
        emailNorm = emailRaw.toLowerCase().trim();
        if (!/\S+@\S+\.\S+/.test(emailNorm)) {
          errors.push({ row: rowNum, reason: 'Invalid email' });
          continue;
        }
      }

      const departmentName = parseString(getVal(row, 'departmentName'));
      let departmentId: string | null = null;
      if (departmentName) {
        departmentId = deptByName.get(departmentName.toLowerCase()) ?? null;
        if (!departmentId) {
          errors.push({ row: rowNum, reason: `Department "${departmentName}" not found for this client` });
          continue;
        }
      }

      const idNumberForRow = normalizeEmployeeNationalId(parseString(getVal(row, 'idNumber')));

      if (idNumberForRow) {
        if (nationalIdsSeenThisFile.has(idNumberForRow)) {
          errors.push({ row: rowNum, reason: `Duplicate National ID in this file (${idNumberForRow})` });
          continue;
        }
        const existingByNationalId = await prisma.employee.findFirst({
          where: { idNumber: idNumberForRow },
        });
        if (existingByNationalId) {
          skipped.push({
            row: rowNum,
            reason: `National ID ${idNumberForRow} already exists for another employee`,
          });
          continue;
        }
      }

      if (emailNorm) {
        const existing = await prisma.employee.findFirst({
          where: {
            outsourcingClientId: clientId,
            email: emailNorm,
          },
        });
        if (existing) {
          skipped.push({ row: rowNum, reason: `Employee with email ${emailNorm} already exists` });
          continue;
        }
      }

      const dateOfJoining = parseDate(getVal(row, 'dateOfJoining'));

      let employeeNumber = parseString(getVal(row, 'employeeNumber'));
      if (!employeeNumber?.trim()) {
        const prefix =
          client.employeeNumberPrefix?.trim() || deriveEmployeePrefixFromName(client.name);
        employeeNumber = await allocateNextEmployeeNumber(prisma, clientId, prefix);
      }

      let baseSalary: Decimal | undefined;
      const baseRaw = getVal(row, 'baseSalary');
      if (baseRaw != null && String(baseRaw).trim() !== '') {
        const n = parseFloat(String(baseRaw).replace(/,/g, ''));
        if (!Number.isNaN(n) && n >= 0) baseSalary = new Decimal(n);
      }

      if (idNumberForRow) nationalIdsSeenThisFile.add(idNumberForRow);

      await prisma.employee.create({
        data: {
            outsourcingClientId: clientId,
          departmentId,
          employeeNumber,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: emailNorm,
          phone: parseString(getVal(row, 'phone')),
          jobTitle: parseString(getVal(row, 'jobTitle')),
          ...(baseSalary ? { baseSalary } : {}),
          idNumber: idNumberForRow ?? undefined,
          kraPin: parseString(getVal(row, 'kraPin')),
          nssfNumber: parseString(getVal(row, 'nssfNumber')),
          nhifNumber: parseString(getVal(row, 'nhifNumber')),
          dateOfJoining: dateOfJoining ?? undefined,
          bankName: parseString(getVal(row, 'bankName')),
          bankBranch: parseString(getVal(row, 'bankBranch')),
          bankAccountNumber: parseString(getVal(row, 'bankAccountNumber')),
        },
      });
      created.push(`${firstName} ${lastName}`);
    }

    return NextResponse.json({
      created: created.length,
      createdNames: created,
      skipped: skipped.length,
      skippedDetails: skipped.slice(0, 20),
      errors: errors.length,
      errorDetails: errors.slice(0, 20),
    });
  } catch (e) {
    console.error('[employees/import]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to import employees' },
      { status: 500 }
    );
  }
}
