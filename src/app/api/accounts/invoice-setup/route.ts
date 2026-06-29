import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { getAccountsAccess } from '@/lib/accounts-access';
import {
  loadInvoiceSetupSnapshot,
  persistInvoiceSetupSettings,
  sanitizeInvoiceSetup,
  type InvoiceLetterheadMode,
} from '@/lib/invoice-setup';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

export async function GET(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    try {
      const snapshot = await loadInvoiceSetupSnapshot(ctx.organizationId);
      return NextResponse.json(snapshot);
    } catch (error) {
      await reportApiError({
        route: 'GET /api/accounts/invoice-setup',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load invoicing setup.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    const access = await getAccountsAccess(ctx.staff.id, ctx.staff.role);
    if (!access.canManageInvoices) {
      return NextResponse.json({ error: 'No permission to manage invoicing setup.' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    try {
      const snapshot = await loadInvoiceSetupSnapshot(ctx.organizationId);
      const next = sanitizeInvoiceSetup({
        ...snapshot.settings,
        ...(body.letterheadMode != null
          ? { letterheadMode: body.letterheadMode as InvoiceLetterheadMode }
          : {}),
        ...(body.vatPin != null ? { vatPin: str(body.vatPin) ?? '' } : {}),
        ...(body.invoiceLegalName != null
          ? { invoiceLegalName: str(body.invoiceLegalName) ?? '' }
          : {}),
      });

      await persistInvoiceSetupSettings(ctx.organizationId, next, ctx.staff.id);
      const updated = await loadInvoiceSetupSnapshot(ctx.organizationId);
      return NextResponse.json(updated);
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/accounts/invoice-setup',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to save invoicing setup.' }, { status: 500 });
    }
  });
}
