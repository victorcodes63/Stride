import type { EnergyPermit, EnergySite } from '@prisma/client';

export function serializeSite(site: EnergySite) {
  return {
    id: site.id,
    code: site.code,
    name: site.name,
    region: site.region,
    operatingEntityLabel: site.operatingEntityLabel,
    isActive: site.isActive,
  };
}

export function serializePermit(permit: EnergyPermit & { site?: EnergySite }) {
  return {
    id: permit.id,
    siteId: permit.siteId,
    siteCode: permit.site?.code ?? null,
    siteName: permit.site?.name ?? null,
    permitNumber: permit.permitNumber,
    permitType: permit.permitType,
    issuingAuthority: permit.issuingAuthority,
    issuedAt: permit.issuedAt.toISOString().slice(0, 10),
    expiresAt: permit.expiresAt.toISOString().slice(0, 10),
    status: permit.status,
    notes: permit.notes,
  };
}
