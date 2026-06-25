import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { logAuditEvent } from '@/lib/audit-events';

function lineTotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

async function resolveRequesterUserId(essEmail: string, employeeEmail: string | null | undefined) {
  const email = employeeEmail?.trim() || essEmail;
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function GET(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  if (!user.employeeId) return NextResponse.json({ requests: [] });

  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: { email: true },
  });
  const requesterUserId = await resolveRequesterUserId(user.email, employee?.email);
  if (!requesterUserId) return NextResponse.json({ requests: [] });

  const requests = await prisma.purchaseRequest.findMany({
    where: { requestedByUserId: requesterUserId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      requestNumber: true,
      title: true,
      status: true,
      totalAmount: true,
      currency: true,
      submittedAt: true,
      createdAt: true,
    },
  });

  await logAuditEvent({
    actor: { userId: null, email: user.email, name: user.name },
    action: 'ess.procurement.list',
    entityType: 'PurchaseRequest',
    route: 'GET /api/ess/procurement/purchase-requests',
    metadata: { employeeId: user.employeeId },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      submittedAt: r.submittedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  if (!user.employeeId) {
    return NextResponse.json({ error: 'No linked employee profile' }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    include: { department: { select: { name: true } } },
  });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const requesterUserId = await resolveRequesterUserId(user.email, employee.email);
  if (!requesterUserId) {
    return NextResponse.json(
      { error: 'Your account is not linked to a staff user for procurement. Contact HR.' },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const justification = typeof body.justification === 'string' ? body.justification.trim() : '';
  const item = typeof body.item === 'string' ? body.item.trim() : '';
  const quantity = Number(body.quantity) || 0;
  const unitPrice = Number(body.unitPrice) || 0;
  const submit = body.submit === true;

  if (!title || !justification || !item || quantity <= 0 || unitPrice <= 0) {
    return NextResponse.json(
      { error: 'Title, justification, item, quantity, and unit price are required.' },
      { status: 400 },
    );
  }

  const totalAmount = lineTotal(quantity, unitPrice);
  const count = await prisma.purchaseRequest.count({
    where: { outsourcingClientId: employee.outsourcingClientId },
  });
  const requestNumber = `PR-${String(count + 1).padStart(4, '0')}`;

  const created = await prisma.purchaseRequest.create({
    data: {
      organizationId: employee.organizationId,
      outsourcingClientId: employee.outsourcingClientId,
      requestNumber,
      title,
      department: employee.department?.name ?? null,
      justification,
      totalAmount,
      status: submit ? 'submitted' : 'draft',
      submittedAt: submit ? new Date() : null,
      requestedByUserId: requesterUserId,
      lines: {
        create: {
          organizationId: employee.organizationId,
          item,
          quantity,
          unitPrice,
          sortOrder: 0,
        },
      },
    },
    select: { id: true, requestNumber: true, status: true },
  });

  await logAuditEvent({
    actor: { userId: null, email: user.email, name: user.name },
    action: submit ? 'ess.procurement.submitted' : 'ess.procurement.created',
    entityType: 'PurchaseRequest',
    entityId: created.id,
    route: 'POST /api/ess/procurement/purchase-requests',
    metadata: { employeeId: user.employeeId, requestNumber: created.requestNumber },
  });

  return NextResponse.json(created, { status: 201 });
}
