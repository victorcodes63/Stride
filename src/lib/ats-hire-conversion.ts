type CandidateInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
};

type JobInput = {
  title: string;
  outsourcingClientId?: string | null;
};

type OfferInput = {
  startDate?: Date | null;
  proposedGrossSalary?: number | null;
};

export type HireProfileInput = {
  idNumber: string;
  kraPin: string;
  nssfNumber: string;
  nhifNumber: string;
  departmentId: string;
  costCenterCode: string;
  costCenterName?: string | null;
  managerEmployeeId?: string | null;
  /** Legacy alias — prefer outsourcingClientId for OUT-06 RPO hires. */
  clientId?: string;
  outsourcingClientId?: string;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
};

export function resolveHireOutsourcingClientId(input: {
  job: JobInput;
  profile: Partial<HireProfileInput>;
}): string | null {
  const fromJob = input.job.outsourcingClientId?.trim() || null;
  const fromProfile =
    input.profile.outsourcingClientId?.trim() || input.profile.clientId?.trim() || null;
  if (fromJob && fromProfile && fromJob !== fromProfile) {
    throw Object.assign(new Error('RPO_CLIENT_MISMATCH'), { code: 'RPO_CLIENT_MISMATCH' });
  }
  return fromJob ?? fromProfile;
}

export function buildEmployeeFromHireConversion(params: {
  candidate: CandidateInput;
  job: JobInput;
  offer?: OfferInput | null;
  profile: HireProfileInput;
}) {
  const outsourcingClientId = resolveHireOutsourcingClientId({
    job: params.job,
    profile: params.profile,
  });

  return {
    firstName: params.candidate.firstName,
    lastName: params.candidate.lastName,
    email: params.candidate.email.toLowerCase(),
    phone: params.candidate.phone ?? null,
    jobTitle: params.job.title,
    dateOfJoining: params.offer?.startDate ?? new Date(),
    baseSalary: params.offer?.proposedGrossSalary ?? null,
    idNumber: params.profile.idNumber,
    kraPin: params.profile.kraPin,
    nssfNumber: params.profile.nssfNumber,
    nhifNumber: params.profile.nhifNumber,
    departmentId: params.profile.departmentId,
    costCenterCode: params.profile.costCenterCode,
    costCenterName: params.profile.costCenterName ?? null,
    managerEmployeeId: params.profile.managerEmployeeId ?? null,
    outsourcingClientId,
    bankName: params.profile.bankName ?? null,
    bankBranch: params.profile.bankBranch ?? null,
    bankAccountNumber: params.profile.bankAccountNumber ?? null,
  };
}

export function validateHireProfileInput(
  profile: Partial<HireProfileInput>,
  options?: { requireOutsourcingClient?: boolean },
): string[] {
  const required: Array<keyof HireProfileInput> = [
    'idNumber',
    'kraPin',
    'nssfNumber',
    'nhifNumber',
    'departmentId',
    'costCenterCode',
  ];
  const missing = required.filter((key) => !String(profile[key] ?? '').trim());
  const hasClient = Boolean(
    profile.outsourcingClientId?.trim() || profile.clientId?.trim(),
  );
  if (options?.requireOutsourcingClient && !hasClient) {
    missing.push('outsourcingClientId');
  }
  return missing;
}
