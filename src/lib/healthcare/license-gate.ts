import type { CredentialCategory, CredentialStatus, EmployeeCredential } from '@prisma/client';

export type LicenseGateResult = {
  ok: boolean;
  warnings: string[];
  matchedCredentials: Pick<EmployeeCredential, 'id' | 'credentialName' | 'category' | 'status' | 'expiryDate'>[];
};

const ACTIVE_STATUSES: CredentialStatus[] = ['active', 'expiring_soon'];

export function parseRequiredCredentials(value: unknown): CredentialCategory[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is CredentialCategory => typeof v === 'string');
}

export function evaluateLicenseGate(
  credentials: EmployeeCredential[],
  required: CredentialCategory[],
  asOf: Date = new Date(),
): LicenseGateResult {
  const warnings: string[] = [];
  const matched: LicenseGateResult['matchedCredentials'] = [];

  if (required.length === 0) {
    return { ok: true, warnings, matchedCredentials: matched };
  }

  for (const category of required) {
    const creds = credentials.filter((c) => c.category === category);
    const valid = creds.find((c) => {
      if (!ACTIVE_STATUSES.includes(c.status)) return false;
      if (c.expiryDate && c.expiryDate < asOf) return false;
      return true;
    });

    if (!valid) {
      if (creds.length === 0) {
        warnings.push(`Missing credential: ${category.replace(/_/g, ' ')}`);
      } else {
        const expired = creds.every((c) => c.expiryDate && c.expiryDate < asOf);
        warnings.push(
          expired
            ? `Expired credential: ${category.replace(/_/g, ' ')}`
            : `Inactive credential: ${category.replace(/_/g, ' ')}`,
        );
      }
      continue;
    }

    matched.push({
      id: valid.id,
      credentialName: valid.credentialName,
      category: valid.category,
      status: valid.status,
      expiryDate: valid.expiryDate,
    });
  }

  return {
    ok: warnings.length === 0,
    warnings,
    matchedCredentials: matched,
  };
}
