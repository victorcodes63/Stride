/**
 * Parse a date string to a comparable timestamp (start of that month when only YYYY-MM).
 * Used to sort work experience by recency.
 */
export function parseEmploymentDateTs(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO YYYY-MM or YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const day = m[3] ? parseInt(m[3], 10) : 1;
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
      const t = new Date(y, mo - 1, day).getTime();
      return Number.isNaN(t) ? null : t;
    }
  }

  // MM/YYYY or M/YYYY
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mo = parseInt(m[1], 10);
    const y = parseInt(m[2], 10);
    if (mo >= 1 && mo <= 12) return new Date(y, mo - 1, 1).getTime();
  }

  // DD/MM/YYYY or D/M/YYYY (common on applications)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (a > 12) {
      const day = a;
      const mo = b;
      if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31)
        return new Date(y, mo - 1, day).getTime();
    } else if (b > 12) {
      const mo = a;
      const day = b;
      if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31)
        return new Date(y, mo - 1, day).getTime();
    } else {
      const tUs = new Date(y, a - 1, b).getTime();
      if (!Number.isNaN(tUs)) return tUs;
    }
  }

  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

export type EmploymentLike = {
  startDate?: string;
  endDate?: string;
  isCurrentJob?: boolean;
};

/**
 * Compute years between two employment date strings (supports DD/MM/YYYY, YYYY-MM, etc.).
 * Use for per-entry duration and total relevant experience.
 */
export function yearsBetweenEmploymentDates(startDate: string, endDate: string): number {
  if (!startDate?.trim()) return 0;
  const startTs = parseEmploymentDateTs(startDate.trim());
  if (startTs == null) return 0;
  const endStr = (endDate ?? '').trim().toLowerCase();
  const endTs =
    !endStr || endStr === 'present' || endStr === 'current'
      ? Date.now()
      : (parseEmploymentDateTs(endDate.trim()) ?? 0);
  if (endTs === 0) return 0;
  const start = new Date(startTs);
  const end = new Date(endTs);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  return Math.max(0, Math.round((months / 12) * 10) / 10);
}

/**
 * Sort employment entries: most recent activity first.
 * - Current jobs use "now" as end → appear above older ended roles.
 * - Same end date → more recent start first.
 */
export function sortEmploymentByRecency<T extends EmploymentLike>(entries: T[]): T[] {
  const now = Date.now();
  return [...entries].sort((a, b) => {
    const endA = a.isCurrentJob ? now : (parseEmploymentDateTs(a.endDate) ?? parseEmploymentDateTs(a.startDate) ?? 0);
    const endB = b.isCurrentJob ? now : (parseEmploymentDateTs(b.endDate) ?? parseEmploymentDateTs(b.startDate) ?? 0);
    if (endB !== endA) return endB - endA;
    const startA = parseEmploymentDateTs(a.startDate) ?? 0;
    const startB = parseEmploymentDateTs(b.startDate) ?? 0;
    return startB - startA;
  });
}
