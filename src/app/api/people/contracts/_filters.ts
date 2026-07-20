import type { Prisma } from '@prisma/client';

export type ContractType = 'employee' | 'consultant';
export type ContractStatus = 'active' | 'expiring' | 'expired';

/** Days-out threshold used for the "expiring soon" status + stat. */
export const EXPIRING_SOON_DAYS = 60;

export function parseContractType(reference: string | null): ContractType {
  const r = (reference || '').toUpperCase();
  if (r.startsWith('CONS-')) return 'consultant';
  return 'employee';
}

export function normalizeReference(reference: string, type: ContractType): string {
  const trimmed = reference.trim();
  if (!trimmed) return '';
  const prefixed = type === 'consultant' ? 'CONS-' : 'EMP-';
  if (trimmed.toUpperCase().startsWith(prefixed)) return trimmed;
  return `${prefixed}${trimmed}`;
}

/** UTC start-of-day for today, plus the "expiring soon" horizon. */
export function statusBoundaries(now: Date = new Date()): { today: Date; soon: Date } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const soon = new Date(today);
  soon.setUTCDate(soon.getUTCDate() + EXPIRING_SOON_DAYS);
  return { today, soon };
}

export function computeStatus(endDate: Date, now: Date = new Date()): ContractStatus {
  const { today, soon } = statusBoundaries(now);
  if (endDate < today) return 'expired';
  if (endDate <= soon) return 'expiring';
  return 'active';
}

export type ContractQuery = {
  q: string;
  type: ContractType | null;
  status: ContractStatus | null;
  sort: 'endDate' | 'title' | 'type';
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  /** True when the caller opted into the paginated response shape. */
  paginated: boolean;
};

export function parseContractQuery(searchParams: URLSearchParams): ContractQuery {
  const q = (searchParams.get('q') || '').trim();

  const typeRaw = searchParams.get('type');
  const type: ContractType | null =
    typeRaw === 'employee' || typeRaw === 'consultant' ? typeRaw : null;

  const statusRaw = searchParams.get('status');
  const status: ContractStatus | null =
    statusRaw === 'active' || statusRaw === 'expiring' || statusRaw === 'expired'
      ? statusRaw
      : null;

  const sortRaw = searchParams.get('sort');
  const sort: ContractQuery['sort'] =
    sortRaw === 'title' || sortRaw === 'type' ? sortRaw : 'endDate';

  const dir: ContractQuery['dir'] = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  const pageParam = searchParams.get('page');
  const pageSizeParam = searchParams.get('pageSize');
  const paginated = pageParam != null || pageSizeParam != null;

  const page = Math.max(1, Number.parseInt(pageParam || '1', 10) || 1);
  const pageSizeRaw = Number.parseInt(pageSizeParam || '20', 10) || 20;
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

  return { q, type, status, sort, dir, page, pageSize, paginated };
}

/** AND clauses derived from q/type/status — spread these into the prisma where. */
export function contractFilterClauses(query: ContractQuery): Prisma.AccountsContractWhereInput[] {
  const clauses: Prisma.AccountsContractWhereInput[] = [];

  if (query.q) {
    clauses.push({
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { reference: { contains: query.q, mode: 'insensitive' } },
        {
          managers: {
            some: { user: { name: { contains: query.q, mode: 'insensitive' } } },
          },
        },
      ],
    });
  }

  if (query.type === 'consultant') {
    clauses.push({ reference: { startsWith: 'CONS-', mode: 'insensitive' } });
  } else if (query.type === 'employee') {
    // Everything that is not a consultant contract, including null references.
    clauses.push({
      OR: [
        { reference: null },
        { NOT: { reference: { startsWith: 'CONS-', mode: 'insensitive' } } },
      ],
    });
  }

  if (query.status) {
    const { today, soon } = statusBoundaries();
    if (query.status === 'expired') {
      clauses.push({ endDate: { lt: today } });
    } else if (query.status === 'expiring') {
      clauses.push({ endDate: { gte: today, lte: soon } });
    } else {
      clauses.push({ endDate: { gt: soon } });
    }
  }

  return clauses;
}

export function contractOrderBy(
  query: ContractQuery,
): Prisma.AccountsContractOrderByWithRelationInput[] {
  if (query.sort === 'title') {
    return [{ title: query.dir }, { createdAt: 'desc' }];
  }
  if (query.sort === 'type') {
    // "Type" is derived from the reference prefix, so ordering by reference groups
    // CONS-* and EMP-* together — a good proxy for grouping by contract type.
    return [{ reference: query.dir }, { endDate: 'asc' }];
  }
  return [{ endDate: query.dir }, { createdAt: 'desc' }];
}
