import type {
  ConstructionPlantAsset,
  ConstructionSite,
  ConstructionSubcontractor,
} from '@prisma/client';

export function serializeSite(
  site: ConstructionSite & {
    parentSite?: { code: string; name: string } | null;
    childSites?: { id: string; code: string; name: string }[];
    project?: { projectCode: string; name: string } | null;
  },
) {
  return {
    id: site.id,
    code: site.code,
    name: site.name,
    status: site.status,
    location: site.location,
    parentSiteId: site.parentSiteId,
    parentSiteCode: site.parentSite?.code ?? null,
    parentSiteName: site.parentSite?.name ?? null,
    projectId: site.projectId,
    projectCode: site.project?.projectCode ?? null,
    projectName: site.project?.name ?? null,
    childCount: site.childSites?.length ?? 0,
  };
}

export function serializePlant(row: ConstructionPlantAsset & { site?: ConstructionSite }) {
  return {
    id: row.id,
    siteId: row.siteId,
    siteCode: row.site?.code ?? null,
    siteName: row.site?.name ?? null,
    assetTag: row.assetTag,
    name: row.name,
    category: row.category,
    status: row.status,
    dailyHireRate: row.dailyHireRate ? Number(row.dailyHireRate) : null,
    onSiteSince: row.onSiteSince?.toISOString().slice(0, 10) ?? null,
    companyAssetId: row.companyAssetId,
  };
}

export function serializeSubcontractor(
  row: ConstructionSubcontractor & { site?: ConstructionSite | null },
) {
  const contractValue = row.contractValue ? Number(row.contractValue) : 0;
  const amountInvoiced = Number(row.amountInvoiced);
  const amountPaid = Number(row.amountPaid);
  const retentionPct = row.retentionPct ? Number(row.retentionPct) : null;
  const retentionHeld = retentionPct ? (amountInvoiced * retentionPct) / 100 : 0;

  return {
    id: row.id,
    siteId: row.siteId,
    siteCode: row.site?.code ?? null,
    siteName: row.site?.name ?? null,
    name: row.name,
    trade: row.trade,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    retentionPct,
    contractValue,
    amountInvoiced,
    amountPaid,
    retentionHeld,
    balanceDue: Math.max(0, amountInvoiced - amountPaid - retentionHeld),
    status: row.status,
  };
}
