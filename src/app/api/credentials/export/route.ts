import { NextRequest, NextResponse } from 'next/server';
import { canAccessCredentials, forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';
import { parseFormat, respondWithReport } from '@/app/api/reports/_shared';
import { credentialCategoryLabel } from '@/lib/credential-categories';
import { loadCredentials, parseCredentialQuery } from '../_shared';

export const dynamic = 'force-dynamic';

const HEADERS = ['Staff', 'Credential', 'Number', 'Authority', 'Category', 'Issue', 'Expiry', 'Status'];

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessCredentials(ctx.staff)) {
      return forbiddenResponse('Credentials access is restricted to HR and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const format = parseFormat(request);
    const query = parseCredentialQuery(request);
    const credentials = await loadCredentials(ctx, request, query);

    const rows = credentials.map((c) => [
      c.employeeName,
      c.credentialName,
      c.credentialNumber ?? '',
      c.issuingAuthority ?? '',
      credentialCategoryLabel(c.category),
      c.issueDate ?? '',
      c.expiryDate ?? '',
      statusLabel(c.effectiveStatus),
    ]);

    await ctx.audit({
      action: 'credential.records.export',
      entityType: 'EmployeeCredential',
      route: 'GET /api/credentials/export',
      metadata: { format, count: credentials.length },
    });

    return respondWithReport({
      format,
      json: { credentials },
      title: 'Credentials & licences',
      sheetName: 'Credentials',
      baseFilename: `credentials-${new Date().toISOString().slice(0, 10)}`,
      headers: HEADERS,
      rows,
    });
  });
}
