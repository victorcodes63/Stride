import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { parseB2CCallbackPayload } from '@/lib/payroll-disbursement/daraja-client';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid JSON' });
  }

  const parsed = parseB2CCallbackPayload(body);
  if (!parsed) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const success = parsed.resultCode === 0;
  const status = success ? 'completed' : 'failed';
  const failureReason = success ? null : parsed.resultDesc || `M-Pesa result code ${parsed.resultCode}`;

  try {
    const lines = await prisma.payrollDisbursementLine.findMany({
      where: {
        OR: [
          { providerRef: parsed.originatorConversationId },
          { providerRef: parsed.conversationId },
        ],
        status: { in: ['submitted', 'processing', 'pending'] },
      },
      select: { id: true, batchId: true },
    });

    if (lines.length > 0) {
      const now = new Date();
      await prisma.payrollDisbursementLine.updateMany({
        where: { id: { in: lines.map((l) => l.id) } },
        data: {
          status,
          failureReason,
          providerRef: parsed.transactionId ?? parsed.originatorConversationId,
          completedAt: success ? now : null,
        },
      });
    }
  } catch (error) {
    console.error('[mpesa b2c result]', error);
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}
