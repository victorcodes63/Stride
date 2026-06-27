import { NextRequest, NextResponse } from 'next/server';
import { requireAdminActor } from '@/lib/admin-security';
import { companySetupAccessDeniedResponse } from '@/lib/company-setup-access';
import {
  addOrganizationEmailDomain,
  listOrganizationEmailDomains,
  removeOrganizationEmailDomain,
  verifyOrganizationEmailDomain,
  formatDnsTxtRecord,
} from '@/lib/auth/domain-verification';
import { getCompanySetupCapabilities } from '@/lib/company-setup-tier-features';
import { getDeploymentTier } from '@/lib/deployment-tier';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;
  const tierDenied = companySetupAccessDeniedResponse();
  if (tierDenied) return tierDenied;

  const organizationId = actor?.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization context required.' }, { status: 400 });
  }

  const domains = await listOrganizationEmailDomains(organizationId);
  return NextResponse.json({
    domains: domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      verified: Boolean(d.verifiedAt),
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      txtRecord: formatDnsTxtRecord(d.verificationToken),
    })),
  });
}

export async function POST(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;
  const tierDenied = companySetupAccessDeniedResponse();
  if (tierDenied) return tierDenied;

  const caps = getCompanySetupCapabilities(getDeploymentTier());
  if (!caps.canConfigureAuthPolicy) {
    return NextResponse.json({ error: 'Domain verification requires Growth or Enterprise.' }, { status: 403 });
  }

  const organizationId = actor?.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization context required.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : 'add';
  const domain = typeof body.domain === 'string' ? body.domain : '';

  try {
    if (action === 'add') {
      const created = await addOrganizationEmailDomain(organizationId, domain);
      await logAuditEvent({
        actor,
        action: 'auth.domain.added',
        entityType: 'OrganizationEmailDomain',
        entityId: created.id,
        route: '/api/admin/auth/domains',
        metadata: { domain: created.domain },
      });
      return NextResponse.json({
        domain: created.domain,
        txtRecord: created.txtRecord,
        verified: false,
      });
    }

    if (action === 'verify') {
      const result = await verifyOrganizationEmailDomain(organizationId, domain);
      await logAuditEvent({
        actor,
        action: result.verified ? 'auth.domain.verified' : 'auth.domain.verify_failed',
        entityType: 'OrganizationEmailDomain',
        route: '/api/admin/auth/domains',
        metadata: { domain, message: result.message },
      });
      return NextResponse.json(result, { status: result.verified ? 200 : 422 });
    }

    if (action === 'remove') {
      await removeOrganizationEmailDomain(organizationId, domain);
      await logAuditEvent({
        actor,
        action: 'auth.domain.removed',
        entityType: 'OrganizationEmailDomain',
        route: '/api/admin/auth/domains',
        metadata: { domain },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Domain operation failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
