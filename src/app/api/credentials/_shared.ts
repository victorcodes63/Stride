import type { NextRequest } from 'next/server';
import { CredentialCategory, CredentialStatus } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import type { TenantContext } from '@/lib/tenant-api';

export const CATEGORIES = new Set<string>(Object.values(CredentialCategory));
export const STATUSES = new Set<string>(Object.values(CredentialStatus));

export type CredentialSort = 'expiry' | 'staff' | 'status';
const SORTS = new Set<string>(['expiry', 'staff', 'status']);

export function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

export function asDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function deriveStatus(
  status: CredentialStatus,
  expiryDate: Date | null,
  reminderDays: number,
): CredentialStatus {
  if (status === 'suspended' || status === 'revoked') return status;
  if (!expiryDate) return status;
  const now = new Date();
  const days = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= reminderDays) return 'expiring_soon';
  return 'active';
}

export const credentialInclude = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
  },
} as const;

type CredentialWithEmployee = {
  id: string;
  employeeId: string;
  category: CredentialCategory;
  credentialName: string;
  credentialNumber: string | null;
  issuingAuthority: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  reminderDays: number;
  status: CredentialStatus;
  scopeOfPractice: string | null;
  notes: string | null;
  documentPath: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    jobTitle: string | null;
    department: { name: string } | null;
  };
};

export function toResponse(record: CredentialWithEmployee) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
    employeeNumber: record.employee.employeeNumber,
    jobTitle: record.employee.jobTitle,
    departmentName: record.employee.department?.name ?? null,
    category: record.category,
    credentialName: record.credentialName,
    credentialNumber: record.credentialNumber,
    issuingAuthority: record.issuingAuthority,
    issueDate: record.issueDate?.toISOString().slice(0, 10) ?? null,
    expiryDate: record.expiryDate?.toISOString().slice(0, 10) ?? null,
    reminderDays: record.reminderDays,
    status: record.status,
    effectiveStatus: deriveStatus(record.status, record.expiryDate, record.reminderDays),
    scopeOfPractice: record.scopeOfPractice,
    notes: record.notes,
    documentPath: record.documentPath,
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type CredentialResponse = ReturnType<typeof toResponse>;

export type CredentialQuery = {
  q: string | null;
  employeeId: string | undefined;
  category: CredentialCategory | undefined;
  status: string | undefined;
  expiringOnly: boolean;
  sort: CredentialSort;
  dir: 'asc' | 'desc';
};

export function parseCredentialQuery(request: NextRequest): CredentialQuery {
  const sp = request.nextUrl.searchParams;
  const categoryRaw = sp.get('category');
  const statusRaw = sp.get('status');
  const sortRaw = sp.get('sort');
  const dirRaw = sp.get('dir');
  return {
    q: sp.get('q')?.trim() || null,
    employeeId: sp.get('employeeId') || undefined,
    category: categoryRaw && CATEGORIES.has(categoryRaw) ? (categoryRaw as CredentialCategory) : undefined,
    status: statusRaw && STATUSES.has(statusRaw) ? statusRaw : undefined,
    expiringOnly: sp.get('expiring') === '1',
    sort: sortRaw && SORTS.has(sortRaw) ? (sortRaw as CredentialSort) : 'expiry',
    dir: dirRaw === 'desc' ? 'desc' : 'asc',
  };
}

/**
 * Loads credentials scoped to the tenant + primary workspace client, applying
 * DB-level filters (category / employeeId) and then in-memory filters that
 * depend on the derived `effectiveStatus` (status, expiring) plus free-text
 * search and sorting. Returns the fully mapped + sorted list.
 */
export async function loadCredentials(
  ctx: TenantContext,
  request: NextRequest,
  query: CredentialQuery,
): Promise<CredentialResponse[]> {
  const workspaceClientId = await ctx.run((tx) =>
    resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
  );

  const records = await ctx.run((tx) =>
    tx.employeeCredential.findMany({
      where: {
        ...ctx.where(),
        employee: {
          outsourcingClientId: workspaceClientId,
          client: { organizationId: ctx.organizationId },
        },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      include: credentialInclude,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
      take: 5000,
    }),
  );

  let mapped = records.map(toResponse);

  if (query.status) {
    mapped = mapped.filter((item) => item.effectiveStatus === query.status);
  }
  if (query.expiringOnly) {
    mapped = mapped.filter(
      (item) => item.effectiveStatus === 'expiring_soon' || item.effectiveStatus === 'expired',
    );
  }
  if (query.q) {
    const needle = query.q.toLowerCase();
    mapped = mapped.filter((item) =>
      [
        item.employeeName,
        item.employeeNumber ?? '',
        item.jobTitle ?? '',
        item.credentialName,
        item.credentialNumber ?? '',
        item.issuingAuthority ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }

  return sortCredentials(mapped, query.sort, query.dir);
}

function sortCredentials(
  items: CredentialResponse[],
  sort: CredentialSort,
  dir: 'asc' | 'desc',
): CredentialResponse[] {
  const factor = dir === 'desc' ? -1 : 1;
  const sorted = [...items];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (sort === 'staff') {
      cmp = a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' });
    } else if (sort === 'status') {
      cmp = a.effectiveStatus.localeCompare(b.effectiveStatus);
    } else {
      // expiry — nulls always sort last regardless of direction
      if (a.expiryDate === b.expiryDate) cmp = 0;
      else if (!a.expiryDate) return 1;
      else if (!b.expiryDate) return -1;
      else cmp = a.expiryDate.localeCompare(b.expiryDate);
    }
    if (cmp === 0) cmp = a.createdAt.localeCompare(b.createdAt) * -1;
    return cmp * factor;
  });
  return sorted;
}
