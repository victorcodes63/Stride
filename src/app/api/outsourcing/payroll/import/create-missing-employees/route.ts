import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allocateNextEmployeeNumber, deriveEmployeePrefixFromName } from '@/lib/outsourcing-employee-number';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';

type MissingSeed = {
  nationalId: string;
  employeeName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

function splitName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const clean = (fullName ?? '').trim();
  if (!clean) return { firstName: '', lastName: '' };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const b = body as { clientId?: string; missingRows?: MissingSeed[] };
    const requestedClientId = typeof b.clientId === 'string' ? b.clientId.trim() : '';
    const missingRows = Array.isArray(b.missingRows) ? b.missingRows : [];
    if (missingRows.length === 0) {
      return NextResponse.json({ error: 'missingRows[] is required.' }, { status: 400 });
    }
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

    const client = await prisma.outsourcingClient.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, employeeNumberPrefix: true },
    });
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

    const normalizedBatchIds = [
      ...new Set(
        missingRows
          .map((r) => normalizeEmployeeNationalId(r.nationalId))
          .filter((x): x is string => Boolean(x))
      ),
    ];
    const existingById =
      normalizedBatchIds.length > 0
        ? await prisma.employee.findMany({
            where: { idNumber: { in: normalizedBatchIds } },
            select: { idNumber: true },
          })
        : [];
    const existingIds = new Set(
      existingById.map((e) => e.idNumber).filter((x): x is string => Boolean(x))
    );

    const prefix = client.employeeNumberPrefix?.trim() || deriveEmployeePrefixFromName(client.name);
    const created: Array<{ id: string; nationalId: string; name: string }> = [];
    const skipped: Array<{ nationalId: string; reason: string }> = [];
    const seenInRequest = new Set<string>();
    for (const seed of missingRows) {
      const nationalIdNorm = normalizeEmployeeNationalId(seed.nationalId);
      if (!nationalIdNorm) continue;
      if (seenInRequest.has(nationalIdNorm)) {
        skipped.push({
          nationalId: nationalIdNorm,
          reason: 'Duplicate National ID in this request.',
        });
        continue;
      }
      if (existingIds.has(nationalIdNorm)) {
        skipped.push({ nationalId: nationalIdNorm, reason: 'Already exists.' });
        continue;
      }
      const fallbackSplit = splitName(seed.employeeName);
      const firstName = (seed.firstName ?? '').trim() || fallbackSplit.firstName;
      const lastName = (seed.lastName ?? '').trim() || fallbackSplit.lastName;
      if (!firstName || !lastName) {
        skipped.push({
          nationalId: nationalIdNorm,
          reason: 'Skipped: missing employee first/last name in upload row.',
        });
        continue;
      }
      const providedEmail =
        typeof seed.email === 'string' && /\S+@\S+\.\S+/.test(seed.email.trim())
          ? seed.email.trim().toLowerCase()
          : null;
      const employeeNumber = await allocateNextEmployeeNumber(prisma, clientId, prefix);
      const createdEmployee = await prisma.employee.create({
        data: {
          outsourcingClientId: clientId,
          employeeNumber,
          firstName,
          lastName,
          email: providedEmail,
          idNumber: nationalIdNorm,
        },
        select: { id: true, firstName: true, lastName: true, idNumber: true },
      });
      seenInRequest.add(nationalIdNorm);
      existingIds.add(nationalIdNorm);
      created.push({
        id: createdEmployee.id,
        nationalId: nationalIdNorm,
        name: `${createdEmployee.firstName} ${createdEmployee.lastName}`,
      });
    }

    return NextResponse.json({ createdCount: created.length, skippedCount: skipped.length, created, skipped });
  } catch (e) {
    const err = e as { code?: string; meta?: { target?: string[] } };
    if (err.code === 'P2002' && err.meta?.target?.includes('idNumber')) {
      return NextResponse.json(
        { error: 'A National ID in this batch already exists for another employee.' },
        { status: 409 }
      );
    }
    console.error('[outsourcing/payroll/import/create-missing-employees]', e);
    return NextResponse.json({ error: 'Failed to create missing employees.' }, { status: 500 });
  }
}
