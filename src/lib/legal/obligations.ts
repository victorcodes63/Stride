export type ObligationSource = 'contract' | 'credential' | 'policy' | 'compliance';

export type ObligationRow = {
  id: string;
  source: ObligationSource;
  title: string;
  party: string;
  dueDate: string;
  status: 'overdue' | 'due_soon' | 'ok' | 'completed' | 'waived';
  owner: string | null;
  href: string;
  category?: string | null;
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
  policies?: Array<{
    id: string;
    title: string;
    category: string;
    expiryDate: Date;
  }>;
  compliance?: Array<{
    id: string;
    title: string;
    category: string;
    dueDate: Date;
    status: 'pending' | 'completed' | 'waived';
    regulator: string | null;
    owner: { name: string } | null;
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
      href: `/dashboard/people/contracts/${c.id}`,
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

  for (const policy of input.policies ?? []) {
    const days = daysUntil(policy.expiryDate, asOf);
    rows.push({
      id: `policy-${policy.id}`,
      source: 'policy',
      title: policy.title,
      party: policy.category,
      dueDate: policy.expiryDate.toISOString().slice(0, 10),
      status: bucketStatus(days),
      owner: null,
      href: `/dashboard/company-documents`,
      category: policy.category,
    });
  }

  for (const item of input.compliance ?? []) {
    if (item.status === 'completed') {
      rows.push({
        id: `compliance-${item.id}`,
        source: 'compliance',
        title: item.title,
        party: item.regulator || item.category,
        dueDate: item.dueDate.toISOString().slice(0, 10),
        status: 'completed',
        owner: item.owner?.name ?? null,
        href: `/dashboard/legal/obligations`,
        category: item.category,
      });
      continue;
    }
    if (item.status === 'waived') {
      rows.push({
        id: `compliance-${item.id}`,
        source: 'compliance',
        title: item.title,
        party: item.regulator || item.category,
        dueDate: item.dueDate.toISOString().slice(0, 10),
        status: 'waived',
        owner: item.owner?.name ?? null,
        href: `/dashboard/legal/obligations`,
        category: item.category,
      });
      continue;
    }
    const days = daysUntil(item.dueDate, asOf);
    rows.push({
      id: `compliance-${item.id}`,
      source: 'compliance',
      title: item.title,
      party: item.regulator || item.category,
      dueDate: item.dueDate.toISOString().slice(0, 10),
      status: bucketStatus(days),
      owner: item.owner?.name ?? null,
      href: `/dashboard/legal/obligations`,
      category: item.category,
    });
  }

  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
