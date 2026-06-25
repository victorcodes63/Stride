import type {
  FacilityLease,
  FacilityMaintenanceTicket,
  FacilitySite,
  User,
} from '@prisma/client';
import { daysUntil, resolveLeaseStatus } from '@/lib/facilities/lease-status';

type UserPick = Pick<User, 'id' | 'name' | 'email'>;

export function serializeSite(
  row: FacilitySite & {
    manager?: UserPick | null;
    createdBy?: UserPick | null;
    _count?: { leases: number; maintenanceTickets: number };
  },
) {
  return {
    id: row.id,
    siteCode: row.siteCode,
    name: row.name,
    siteType: row.siteType,
    status: row.status,
    address: row.address,
    county: row.county,
    phone: row.phone,
    notes: row.notes,
    manager: row.manager ? { id: row.manager.id, name: row.manager.name } : null,
    createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name } : null,
    leaseCount: row._count?.leases ?? undefined,
    ticketCount: row._count?.maintenanceTickets ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeLease(
  row: FacilityLease & {
    site?: Pick<FacilitySite, 'id' | 'siteCode' | 'name'>;
  },
) {
  const effectiveStatus = resolveLeaseStatus(row.status, row.endDate);
  return {
    id: row.id,
    siteId: row.siteId,
    reference: row.reference,
    landlordName: row.landlordName,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    monthlyRent: row.monthlyRent != null ? Number(row.monthlyRent) : null,
    currency: row.currency,
    status: effectiveStatus,
    storedStatus: row.status,
    daysUntilEnd: daysUntil(row.endDate),
    renewalNotes: row.renewalNotes,
    site: row.site
      ? { id: row.site.id, siteCode: row.site.siteCode, name: row.site.name }
      : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeTicket(
  row: FacilityMaintenanceTicket & {
    site?: Pick<FacilitySite, 'id' | 'siteCode' | 'name'>;
    assignee?: UserPick | null;
    reportedBy?: UserPick | null;
  },
) {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    siteId: row.siteId,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    site: row.site
      ? { id: row.site.id, siteCode: row.site.siteCode, name: row.site.name }
      : undefined,
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
    reportedBy: row.reportedBy ? { id: row.reportedBy.id, name: row.reportedBy.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
