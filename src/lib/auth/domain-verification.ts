/**
 * DNS TXT domain verification (AUTH-05).
 */

import crypto from 'crypto';
import { promises as dns } from 'dns';
import { withOrgContext } from '@/lib/org-context';

export const STRIDE_DOMAIN_TXT_PREFIX = 'stride-domain-verification=';

export function generateDomainVerificationToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function formatDnsTxtRecord(token: string): string {
  return `${STRIDE_DOMAIN_TXT_PREFIX}${token}`;
}

export function normalizeDomainInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '');
}

export async function addOrganizationEmailDomain(
  organizationId: string,
  domainInput: string,
): Promise<{ id: string; domain: string; verificationToken: string; txtRecord: string }> {
  const domain = normalizeDomainInput(domainInput);
  if (!domain || !domain.includes('.')) {
    throw new Error('Enter a valid domain (e.g. acme.co.ke).');
  }

  return withOrgContext(organizationId, async (tx) => {
    const verificationToken = generateDomainVerificationToken();
    const row = await tx.organizationEmailDomain.upsert({
      where: { organizationId_domain: { organizationId, domain } },
      create: {
        organizationId,
        domain,
        verificationToken,
        updatedAt: new Date(),
      },
      update: {
        verificationToken,
        verifiedAt: null,
        updatedAt: new Date(),
      },
    });
    return {
      id: row.id,
      domain: row.domain,
      verificationToken: row.verificationToken,
      txtRecord: formatDnsTxtRecord(row.verificationToken),
    };
  });
}

export async function verifyOrganizationEmailDomain(
  organizationId: string,
  domainInput: string,
): Promise<{ verified: boolean; domain: string; message: string }> {
  const domain = normalizeDomainInput(domainInput);

  const row = await withOrgContext(organizationId, (tx) =>
    tx.organizationEmailDomain.findUnique({
      where: { organizationId_domain: { organizationId, domain } },
    }),
  );

  if (!row) {
    return { verified: false, domain, message: 'Domain not found. Add it first.' };
  }
  if (row.verifiedAt) {
    return { verified: true, domain, message: 'Domain already verified.' };
  }

  const expected = formatDnsTxtRecord(row.verificationToken);
  let txtRecords: string[][] = [];
  try {
    txtRecords = await dns.resolveTxt(domain);
  } catch {
    return {
      verified: false,
      domain,
      message: `No TXT records found for ${domain}. Add: ${expected}`,
    };
  }

  const flat = txtRecords.map((chunks) => chunks.join(''));
  const matched = flat.some((record) => record.includes(expected) || record.includes(row.verificationToken));

  if (!matched) {
    return {
      verified: false,
      domain,
      message: `TXT record not found. Add a TXT record: ${expected}`,
    };
  }

  await withOrgContext(organizationId, (tx) =>
    tx.organizationEmailDomain.update({
      where: { id: row.id },
      data: { verifiedAt: new Date(), updatedAt: new Date() },
    }),
  );

  return { verified: true, domain, message: 'Domain verified successfully.' };
}

export async function listOrganizationEmailDomains(organizationId: string) {
  return withOrgContext(organizationId, (tx) =>
    tx.organizationEmailDomain.findMany({
      where: { organizationId },
      orderBy: { domain: 'asc' },
      select: {
        id: true,
        domain: true,
        verificationToken: true,
        verifiedAt: true,
        createdAt: true,
      },
    }),
  );
}

export async function removeOrganizationEmailDomain(
  organizationId: string,
  domainInput: string,
): Promise<void> {
  const domain = normalizeDomainInput(domainInput);
  await withOrgContext(organizationId, (tx) =>
    tx.organizationEmailDomain.deleteMany({ where: { organizationId, domain } }),
  );
}
