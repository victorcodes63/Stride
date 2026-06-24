type CandidateInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
};

type JobInput = {
  title: string;
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
  clientId: string;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
};

export function buildEmployeeFromHireConversion(params: {
  candidate: CandidateInput;
  job: JobInput;
  offer?: OfferInput | null;
  profile: HireProfileInput;
}) {
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
    clientId: params.profile.clientId,
    bankName: params.profile.bankName ?? null,
    bankBranch: params.profile.bankBranch ?? null,
    bankAccountNumber: params.profile.bankAccountNumber ?? null,
  };
}

export function validateHireProfileInput(profile: Partial<HireProfileInput>): string[] {
  const required: Array<keyof HireProfileInput> = [
    'idNumber',
    'kraPin',
    'nssfNumber',
    'nhifNumber',
    'departmentId',
    'costCenterCode',
    'clientId',
  ];
  return required.filter((key) => !String(profile[key] ?? '').trim());
}
