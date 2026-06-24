/**
 * Demo seeds tag in-app rows with these title prefixes. They should not appear in
 * production-like notification UIs.
 */
export const STAFF_NOTIFICATION_SEED_TITLE_PREFIXES = ['[SEED_ACCOUNTS]', '[SEED_INVOICE]'] as const;

/** Prisma `where` fragment: exclude seed demo notifications by title. */
export function whereExcludeSeedStaffNotifications() {
  return {
    NOT: {
      OR: STAFF_NOTIFICATION_SEED_TITLE_PREFIXES.map((prefix) => ({
        title: { startsWith: prefix },
      })),
    },
  };
}
