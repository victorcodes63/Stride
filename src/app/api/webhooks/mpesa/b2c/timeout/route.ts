import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { parseB2CCallbackPayload } from '@/lib/payroll-disbursement/daraja-client';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const parsed = parseB2CCallbackPayload(body);
  if (!parsed) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  try {
    await prisma.payrollDisbursementLine.updateMany({
      where: {
        OR: [
          { providerRef: parsed.originatorConversationId },
          { providerRef: parsed.conversationId },
        ],
        status: { in: ['submitted', 'processing', 'pending'] },
      },
      data: {
        status: 'failed',
        failureReason: parsed.resultDesc || 'M-Pesa queue timeout',
      },
    });
  } catch (error) {
    console.error('[mpesa b2c timeout]', error);
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}
