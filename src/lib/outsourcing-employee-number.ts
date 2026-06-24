import type { PrismaClient } from '@prisma/client';

const SUFFIX_WORDS = /^(ltd|limited|inc|plc|llc|llp|group|holdings|co|company|kenya|ea)$/i;

/**
 * Default prefix from company name when client has no employeeNumberPrefix.
 * Multi-word: initials (Apex Healthcare Group → AHG). Single word: first 2 letters (Bluewave → BL).
 */
export function deriveEmployeePrefixFromName(companyName: string): string {
  const cleaned = companyName
    .replace(/[&.,'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'EMP';
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((w) => w.length > 0 && !SUFFIX_WORDS.test(w));
  if (words.length >= 2) {
    const initials = words
      .slice(0, 4)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    return initials.slice(0, 4) || 'EMP';
  }
  const w = words[0] || cleaned.replace(/[^a-zA-Z]/g, '') || 'EM';
  return w.slice(0, 2).toUpperCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Next employee number for client: PREFIX-001, zero-padded to 3 (001–999, then 1000+).
 */
export async function allocateNextEmployeeNumber(
  prisma: PrismaClient,
  outsourcingClientId: string,
  prefixRaw: string
): Promise<string> {
  const prefix = prefixRaw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'EMP';
  const pattern = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`, 'i');
  const employees = await prisma.employee.findMany({
    where: { outsourcingClientId },
    select: { employeeNumber: true },
  });
  let max = 0;
  for (const e of employees) {
    const n = e.employeeNumber?.trim();
    if (!n) continue;
    const m = n.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  const seq = next < 1000 ? String(next).padStart(3, '0') : String(next);
  return `${prefix}-${seq}`;
}
