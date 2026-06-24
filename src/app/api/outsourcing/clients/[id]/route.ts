import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

function mapClientToJson(c: {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  kraPin: string | null;
  nssfEmployerNumber: string | null;
  nhifEmployerNumber: string | null;
  companyRegistrationNumber: string | null;
  vatNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwiftCode: string | null;
  currency: string | null;
  billingCycle: string | null;
  serviceFeeType: string | null;
  serviceFeeAmount: unknown;
  paymentTerms: string | null;
  postalAddress: string | null;
  county: string | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  employeeNumberPrefix?: string | null;
  payrollFrequency?: string | null;
  leavePayMode?: string | null;
  _count: { employees: number; departments: number };
}) {
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
    payrollFrequency: c.payrollFrequency ?? 'monthly',
    leavePayMode: c.leavePayMode ?? 'none',
    employeeCount: c._count.employees,
    departmentCount: c._count.departments,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const client = await prisma.outsourcingClient.findUnique({
      where: { id },
      include: { _count: { select: { employees: true, departments: true } } },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(mapClientToJson(client));
  } catch (e) {
    console.error('[outsourcing/clients GET]', e);
    return NextResponse.json({ error: 'Failed to load client' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const name = str(b, 'name');
  const contactName = b.contactName !== undefined ? str(b, 'contactName') : undefined;
  const contactEmail = b.contactEmail !== undefined ? str(b, 'contactEmail') : undefined;
  const contactPhone = b.contactPhone !== undefined ? str(b, 'contactPhone') : undefined;
  const kraPin = b.kraPin !== undefined ? str(b, 'kraPin') : undefined;
  const nssfEmployerNumber = b.nssfEmployerNumber !== undefined ? str(b, 'nssfEmployerNumber') : undefined;
  const nhifEmployerNumber = b.nhifEmployerNumber !== undefined ? str(b, 'nhifEmployerNumber') : undefined;
  const companyRegistrationNumber = b.companyRegistrationNumber !== undefined ? str(b, 'companyRegistrationNumber') : undefined;
  const vatNumber = b.vatNumber !== undefined ? str(b, 'vatNumber') : undefined;
  const bankName = b.bankName !== undefined ? str(b, 'bankName') : undefined;
  const bankAccountNumber = b.bankAccountNumber !== undefined ? str(b, 'bankAccountNumber') : undefined;
  const bankBranch = b.bankBranch !== undefined ? str(b, 'bankBranch') : undefined;
  const bankSwiftCode = b.bankSwiftCode !== undefined ? str(b, 'bankSwiftCode') : undefined;
  const currency = b.currency !== undefined ? str(b, 'currency') : undefined;
  const billingCycle = b.billingCycle !== undefined ? str(b, 'billingCycle') : undefined;
  const serviceFeeType = b.serviceFeeType !== undefined ? str(b, 'serviceFeeType') : undefined;
  const serviceFeeAmount = b.serviceFeeAmount !== undefined ? num(b, 'serviceFeeAmount') : undefined;
  const paymentTerms = b.paymentTerms !== undefined ? str(b, 'paymentTerms') : undefined;
  const postalAddress = b.postalAddress !== undefined ? str(b, 'postalAddress') : undefined;
  const county = b.county !== undefined ? str(b, 'county') : undefined;
  const contractStartDate = b.contractStartDate !== undefined ? date(b, 'contractStartDate') : undefined;
  const contractEndDate = b.contractEndDate !== undefined ? date(b, 'contractEndDate') : undefined;
  const employeeNumberPrefix =
    b.employeeNumberPrefix !== undefined ? str(b, 'employeeNumberPrefix') : undefined;
  const payrollFrequency =
    b.payrollFrequency !== undefined ? str(b, 'payrollFrequency') : undefined;
  const leavePayMode =
    b.leavePayMode !== undefined ? str(b, 'leavePayMode') : undefined;

  const hasUpdate =
    name !== undefined ||
    contactName !== undefined ||
    contactEmail !== undefined ||
    contactPhone !== undefined ||
    kraPin !== undefined ||
    nssfEmployerNumber !== undefined ||
    nhifEmployerNumber !== undefined ||
    companyRegistrationNumber !== undefined ||
    vatNumber !== undefined ||
    bankName !== undefined ||
    bankAccountNumber !== undefined ||
    bankBranch !== undefined ||
    bankSwiftCode !== undefined ||
    currency !== undefined ||
    billingCycle !== undefined ||
    serviceFeeType !== undefined ||
    serviceFeeAmount !== undefined ||
    paymentTerms !== undefined ||
    postalAddress !== undefined ||
    county !== undefined ||
    contractStartDate !== undefined ||
    contractEndDate !== undefined ||
    employeeNumberPrefix !== undefined ||
    payrollFrequency !== undefined ||
    leavePayMode !== undefined;

  if (!hasUpdate) {
    return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name || undefined;
  if (contactName !== undefined) data.contactName = contactName;
  if (contactEmail !== undefined) data.contactEmail = contactEmail;
  if (contactPhone !== undefined) data.contactPhone = contactPhone;
  if (kraPin !== undefined) data.kraPin = kraPin;
  if (nssfEmployerNumber !== undefined) data.nssfEmployerNumber = nssfEmployerNumber;
  if (nhifEmployerNumber !== undefined) data.nhifEmployerNumber = nhifEmployerNumber;
  if (companyRegistrationNumber !== undefined) data.companyRegistrationNumber = companyRegistrationNumber;
  if (vatNumber !== undefined) data.vatNumber = vatNumber;
  if (bankName !== undefined) data.bankName = bankName;
  if (bankAccountNumber !== undefined) data.bankAccountNumber = bankAccountNumber;
  if (bankBranch !== undefined) data.bankBranch = bankBranch;
  if (bankSwiftCode !== undefined) data.bankSwiftCode = bankSwiftCode;
  if (currency !== undefined) data.currency = currency;
  if (billingCycle !== undefined) data.billingCycle = billingCycle;
  if (serviceFeeType !== undefined) data.serviceFeeType = serviceFeeType;
  if (serviceFeeAmount !== undefined) data.serviceFeeAmount = serviceFeeAmount;
  if (paymentTerms !== undefined) data.paymentTerms = paymentTerms;
  if (postalAddress !== undefined) data.postalAddress = postalAddress;
  if (county !== undefined) data.county = county;
  if (contractStartDate !== undefined) data.contractStartDate = contractStartDate;
  if (contractEndDate !== undefined) data.contractEndDate = contractEndDate;
  if (employeeNumberPrefix !== undefined) data.employeeNumberPrefix = employeeNumberPrefix || null;
  if (payrollFrequency !== undefined) data.payrollFrequency = payrollFrequency || 'monthly';
  if (leavePayMode !== undefined) data.leavePayMode = leavePayMode || 'none';

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const client = await prisma.outsourcingClient.update({
      where: { id },
      data,
      include: { _count: { select: { employees: true, departments: true } } },
    });
    return NextResponse.json(mapClientToJson(client));
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'P2025') return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    console.error('[outsourcing/clients PATCH]', e);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Client id required' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    await prisma.outsourcingClient.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'P2025') return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    console.error('[outsourcing/clients DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
