import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreatePrimaryWorkspaceClient } from '@/lib/primary-workspace-client';
import { entityScopedClientWhere, resolveEntityIdOrDefault } from '@/lib/entity-request';

type ClientWithCounts = Awaited<
  ReturnType<typeof prisma.outsourcingClient.findMany>
>[number] & { _count: { employees: number; departments: number } };

function str(b: Record<string, unknown>, key: string): string | null {
  const v = b[key];
  return typeof v === 'string' ? v.trim() || null : null;
}
function num(b: Record<string, unknown>, key: string): number | null {
  const v = b[key];
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}
function date(b: Record<string, unknown>, key: string): Date | undefined {
  const v = str(b, key);
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseClientBody(b: Record<string, unknown>) {
  const name = str(b, 'name') ?? '';
  const serviceFeeAmount = num(b, 'serviceFeeAmount');
  return {
    name,
    contactName: str(b, 'contactName') ?? undefined,
    contactEmail: str(b, 'contactEmail') ?? undefined,
    contactPhone: str(b, 'contactPhone') ?? undefined,
    kraPin: str(b, 'kraPin') ?? undefined,
    nssfEmployerNumber: str(b, 'nssfEmployerNumber') ?? undefined,
    nhifEmployerNumber: str(b, 'nhifEmployerNumber') ?? undefined,
    companyRegistrationNumber: str(b, 'companyRegistrationNumber') ?? undefined,
    vatNumber: str(b, 'vatNumber') ?? undefined,
    bankName: str(b, 'bankName') ?? undefined,
    bankAccountNumber: str(b, 'bankAccountNumber') ?? undefined,
    bankBranch: str(b, 'bankBranch') ?? undefined,
    bankSwiftCode: str(b, 'bankSwiftCode') ?? undefined,
    currency: str(b, 'currency') ?? undefined,
    billingCycle: str(b, 'billingCycle') ?? undefined,
    serviceFeeType: str(b, 'serviceFeeType') ?? undefined,
    serviceFeeAmount: serviceFeeAmount != null ? serviceFeeAmount : undefined,
    paymentTerms: str(b, 'paymentTerms') ?? undefined,
    postalAddress: str(b, 'postalAddress') ?? undefined,
    county: str(b, 'county') ?? undefined,
    contractStartDate: date(b, 'contractStartDate'),
    contractEndDate: date(b, 'contractEndDate'),
    employeeNumberPrefix: str(b, 'employeeNumberPrefix') ?? undefined,
  };
}

function mapClientToJson(c: ClientWithCounts) {
  return {
    id: c.id,
    name: c.name,
    contactName: c.contactName ?? null,
    contactEmail: c.contactEmail ?? null,
    contactPhone: c.contactPhone ?? null,
    kraPin: c.kraPin ?? null,
    nssfEmployerNumber: c.nssfEmployerNumber ?? null,
    nhifEmployerNumber: c.nhifEmployerNumber ?? null,
    companyRegistrationNumber: c.companyRegistrationNumber ?? null,
    vatNumber: c.vatNumber ?? null,
    bankName: c.bankName ?? null,
    bankAccountNumber: c.bankAccountNumber ?? null,
    bankBranch: c.bankBranch ?? null,
    bankSwiftCode: c.bankSwiftCode ?? null,
    currency: c.currency ?? 'KES',
    billingCycle: c.billingCycle ?? null,
    serviceFeeType: c.serviceFeeType ?? null,
    serviceFeeAmount: c.serviceFeeAmount != null ? String(c.serviceFeeAmount) : null,
    paymentTerms: c.paymentTerms ?? null,
    postalAddress: c.postalAddress ?? null,
    county: c.county ?? null,
    contractStartDate: c.contractStartDate?.toISOString().slice(0, 10) ?? null,
    contractEndDate: c.contractEndDate?.toISOString().slice(0, 10) ?? null,
    employeeNumberPrefix: c.employeeNumberPrefix ?? null,
    entityCode: c.entityCode ?? null,
    employeeCount: c._count.employees,
    departmentCount: c._count.departments,
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json([], { status: 200 });
    }
    const entityId = await resolveEntityIdOrDefault(request);
    if (entityId) {
      const scoped = await prisma.outsourcingClient.findFirst({
        where: entityScopedClientWhere(entityId),
        include: { _count: { select: { employees: true, departments: true } } },
      });
      if (!scoped) {
        return NextResponse.json([]);
      }
      const row = mapClientToJson(scoped as ClientWithCounts);
      const label = row.county ? `${row.name} — ${row.county}` : row.name;
      return NextResponse.json([{ ...row, label }]);
    }
    /** Same client as employees/payroll default (`getOrCreatePrimaryWorkspaceClient` = oldest workspace). */
    const primary = await getOrCreatePrimaryWorkspaceClient(prisma);
    const primaryFull = await prisma.outsourcingClient.findUnique({
      where: { id: primary.id },
      include: { _count: { select: { employees: true, departments: true } } },
    });
    if (!primaryFull) {
      return NextResponse.json([]);
    }
    const rest = await prisma.outsourcingClient.findMany({
      where: { id: { not: primary.id } },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true, departments: true } } },
    });
    const ordered: ClientWithCounts[] = [primaryFull as ClientWithCounts, ...(rest as ClientWithCounts[])];
    const mapped = ordered.map((c) => mapClientToJson(c as ClientWithCounts));
    const nameLowerCounts = mapped.reduce((m, row) => {
      const k = row.name.trim().toLowerCase();
      m.set(k, (m.get(k) ?? 0) + 1);
      return m;
    }, new Map<string, number>());
    const withLabels = mapped.map((row) => {
      const dup = (nameLowerCounts.get(row.name.trim().toLowerCase()) ?? 0) > 1;
      const label = dup
        ? `${row.name} (${row.id.slice(0, 8)}…)`
        : row.county
          ? `${row.name} — ${row.county}`
          : row.name;
      return { ...row, label };
    });
    return NextResponse.json(withLabels);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[outsourcing/clients]', e);
    return NextResponse.json(
      {
        error: 'Failed to load outsourcing clients',
        ...(process.env.NODE_ENV === 'development' && { detail: msg }),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const data = parseClientBody(b);
  if (!data.name) {
    return NextResponse.json({ error: 'Client name is required.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const client = await prisma.outsourcingClient.create({
      data,
      include: { _count: { select: { employees: true, departments: true } } },
    });
    return NextResponse.json(mapClientToJson(client));
  } catch (e) {
    console.error('[outsourcing/clients POST]', e);
    return NextResponse.json({ error: 'Failed to create outsourcing client' }, { status: 500 });
  }
}
