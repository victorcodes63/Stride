export type ObligationRow = {
  id: string;
  source: 'contract' | 'credential';
  title: string;
  party: string;
  dueDate: string;
  status: 'overdue' | 'due_soon' | 'ok';
  owner: string | null;
  href: string;
};

function daysUntil(date: Date, asOf: Date): number {
  const a = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((b - a) / 86_400_000);
}

function bucketStatus(days: number): ObligationRow['status'] {
  if (days < 0) return 'overdue';
  if (days <= 60) return 'due_soon';
  return 'ok';
}

export function buildObligationRegister(input: {
  contracts: Array<{
    id: string;
    title: string | null;
    reference: string | null;
    endDate: Date;
    managers: Array<{ name: string }>;
  }>;
  credentials: Array<{
    id: string;
    credentialName: string;
    expiryDate: Date | null;
    employee: { firstName: string; lastName: string };
  }>;
  asOf?: Date;
}): ObligationRow[] {
  const asOf = input.asOf ?? new Date();
  const rows: ObligationRow[] = [];

  for (const c of input.contracts) {
    const days = daysUntil(c.endDate, asOf);
    rows.push({
      id: `contract-${c.id}`,
      source: 'contract',
      title: c.title || c.reference || 'Contract renewal',
      party: c.reference || 'Contract',
      dueDate: c.endDate.toISOString().slice(0, 10),
      status: bucketStatus(days),
      owner: c.managers[0]?.name ?? null,
      href: `/dashboard/people/contracts`,
    });
  }

  for (const cred of input.credentials) {
    if (!cred.expiryDate) continue;
    const days = daysUntil(cred.expiryDate, asOf);
    rows.push({
      id: `credential-${cred.id}`,
      source: 'credential',
      title: cred.credentialName,
      party: `${cred.employee.firstName} ${cred.employee.lastName}`.trim(),
      dueDate: cred.expiryDate.toISOString().slice(0, 10),
      status: bucketStatus(days),
      owner: null,
      href: `/dashboard/credentials`,
    });
  }

  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
