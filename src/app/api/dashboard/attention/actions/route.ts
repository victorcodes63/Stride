import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import type { AttentionActionKind, AttentionQueueId } from '@/lib/dashboard-attention/work-items';

export const dynamic = 'force-dynamic';

type ActionBody = {
  queueId?: string;
  entityId?: string;
  action?: string;
  note?: string;
  payment?: {
    amount?: number;
    method?: string;
    receivedAt?: string;
    reference?: string;
  };
};

function cookieHeader(request: NextRequest): string {
  return request.headers.get('cookie') ?? '';
}

function forwardHeaders(request: NextRequest): HeadersInit {
  return {
    'content-type': 'application/json',
    cookie: cookieHeader(request),
    // Preserve org / workspace headers used by tenant helpers.
    ...(request.headers.get('x-organization-id')
      ? { 'x-organization-id': request.headers.get('x-organization-id')! }
      : {}),
    ...(request.headers.get('x-workspace-client-id')
      ? { 'x-workspace-client-id': request.headers.get('x-workspace-client-id')! }
      : {}),
  };
}

function originOf(request: NextRequest): string {
  return request.nextUrl.origin;
}

async function proxyJson(
  request: NextRequest,
  path: string,
  init: { method: string; body?: unknown },
): Promise<NextResponse> {
  const url = `${originOf(request)}${path}`;
  const res = await fetch(url, {
    method: init.method,
    headers: forwardHeaders(request),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text || 'Upstream error' };
  }
  return NextResponse.json(json, { status: res.status });
}

/**
 * POST — unified Action Center actions; delegates to existing domain APIs.
 * Body: { queueId, entityId, action, note?, payment? }
 */
export async function POST(request: NextRequest) {
  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const queueId = body.queueId as AttentionQueueId | undefined;
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
  const action = body.action as AttentionActionKind | undefined;
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!queueId || !entityId || !action) {
    return NextResponse.json(
      { error: 'queueId, entityId, and action are required.' },
      { status: 400 },
    );
  }

  try {
    switch (queueId) {
      case 'leave': {
        if (action !== 'approve' && action !== 'reject') {
          return NextResponse.json({ error: 'Unsupported leave action.' }, { status: 400 });
        }
        return proxyJson(request, `/api/staff/leave/applications/${entityId}`, {
          method: 'PATCH',
          body: {
            action,
            ...(note ? { reviewNote: note } : {}),
          },
        });
      }

      case 'attendance': {
        if (action !== 'resolve' && action !== 'ignore') {
          return NextResponse.json({ error: 'Unsupported attendance action.' }, { status: 400 });
        }
        return proxyJson(request, '/api/staff/attendance/exceptions', {
          method: 'PATCH',
          body: {
            ids: [entityId],
            action,
            ...(note ? { resolutionNotes: note } : {}),
          },
        });
      }

      case 'purchase-requests': {
        if (action !== 'approve' && action !== 'reject') {
          return NextResponse.json({ error: 'Unsupported purchase-request action.' }, { status: 400 });
        }
        return proxyJson(request, `/api/procurement/purchase-requests/${entityId}`, {
          method: 'PATCH',
          body: {
            action,
            ...(action === 'reject' && note ? { reason: note } : {}),
          },
        });
      }

      case 'invoices': {
        if (action !== 'record_payment') {
          return NextResponse.json({ error: 'Unsupported invoice action.' }, { status: 400 });
        }
        const amount = Number(body.payment?.amount);
        const clientId =
          typeof (body as { clientId?: unknown }).clientId === 'string'
            ? ((body as { clientId: string }).clientId)
            : undefined;
        // clientId also accepted via payment meta from UI
        const metaClientId =
          typeof (body as { meta?: { clientId?: string } }).meta?.clientId === 'string'
            ? (body as { meta: { clientId: string } }).meta.clientId
            : clientId;
        if (!metaClientId || !Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json(
            { error: 'payment.amount and clientId are required.' },
            { status: 400 },
          );
        }
        const receivedAt =
          body.payment?.receivedAt?.trim() || new Date().toISOString().slice(0, 10);
        return proxyJson(request, '/api/accounts/client-payments', {
          method: 'POST',
          body: {
            clientId: metaClientId,
            receivedAt,
            amount,
            method: body.payment?.method?.trim() || 'bank_transfer',
            reference: body.payment?.reference?.trim() || null,
            notes: note || null,
            allocations: [{ invoiceId: entityId, amount }],
          },
        });
      }

      case 'vendor-bills': {
        if (action !== 'record_payment') {
          return NextResponse.json({ error: 'Unsupported vendor-bill action.' }, { status: 400 });
        }
        const amount = Number(body.payment?.amount);
        const vendorId =
          typeof (body as { meta?: { vendorId?: string } }).meta?.vendorId === 'string'
            ? (body as { meta: { vendorId: string } }).meta.vendorId
            : typeof (body as { vendorId?: string }).vendorId === 'string'
              ? (body as { vendorId: string }).vendorId
              : undefined;
        if (!vendorId || !Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json(
            { error: 'payment.amount and vendorId are required.' },
            { status: 400 },
          );
        }
        const paidAt = body.payment?.receivedAt?.trim() || new Date().toISOString().slice(0, 10);
        return proxyJson(request, '/api/accounts/vendor-payments', {
          method: 'POST',
          body: {
            vendorId,
            paidAt,
            amount,
            method: body.payment?.method?.trim() || 'bank_transfer',
            reference: body.payment?.reference?.trim() || null,
            notes: note || null,
            allocations: [{ billId: entityId, amount }],
          },
        });
      }

      case 'fleet-incidents': {
        if (action !== 'resolve') {
          return NextResponse.json({ error: 'Unsupported fleet action.' }, { status: 400 });
        }
        return proxyJson(request, `/api/fleet/incidents/${entityId}`, {
          method: 'PATCH',
          body: {
            status: 'resolved',
            resolution: note || 'Resolved from Action Center',
          },
        });
      }

      case 'sales-past-due':
      case 'sales-stalled': {
        if (action === 'nudge_close') {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() + 7);
          const expectedCloseDate = d.toISOString().slice(0, 10);
          return proxyJson(request, `/api/sales/deals/${entityId}`, {
            method: 'PATCH',
            body: {
              expectedCloseDate,
              nextStep: note || 'Follow up — close date nudged from Action Center',
              nextStepDue: expectedCloseDate,
            },
          });
        }
        if (action === 'log_activity') {
          const today = new Date().toISOString().slice(0, 10);
          return proxyJson(request, `/api/sales/deals/${entityId}`, {
            method: 'PATCH',
            body: {
              nextStep: note || 'Touch logged from Action Center',
              nextStepDue: today,
            },
          });
        }
        return NextResponse.json({ error: 'Unsupported sales action.' }, { status: 400 });
      }

      case 'credentials': {
        if (action === 'mark_renewed') {
          const issue = new Date();
          const expiry = new Date();
          expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
          return proxyJson(request, `/api/credentials/${entityId}`, {
            method: 'PATCH',
            body: {
              status: 'active',
              issueDate: issue.toISOString().slice(0, 10),
              expiryDate: expiry.toISOString().slice(0, 10),
            },
          });
        }
        if (action === 'acknowledge') {
          // Soft ack: leave status but stamp notes via PATCH notes append is not supported —
          // mark verifiedAt equivalent by setting status to active when not expired, else keep.
          return proxyJson(request, `/api/credentials/${entityId}`, {
            method: 'PATCH',
            body: {
              notes: note || `Acknowledged in Action Center on ${new Date().toISOString().slice(0, 10)}`,
            },
          });
        }
        return NextResponse.json({ error: 'Unsupported credentials action.' }, { status: 400 });
      }

      case 'onboarding': {
        if (action !== 'complete') {
          return NextResponse.json({ error: 'Unsupported onboarding action.' }, { status: 400 });
        }
        return proxyJson(request, `/api/onboarding/tasks/${entityId}`, {
          method: 'PUT',
          body: { status: 'COMPLETED' },
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown queueId.' }, { status: 400 });
    }
  } catch (error) {
    await reportApiError({
      route: 'POST /api/dashboard/attention/actions',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Action failed.' }, { status: 500 });
  }
}
