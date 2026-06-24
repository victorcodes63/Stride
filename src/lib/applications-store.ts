// In-memory applications & candidates when DATABASE_URL is not set.
// Use PostgreSQL in production.

import type { ApplicationWithDetails, ApplicationStatus } from '@/types/dashboard';

const applications: ApplicationWithDetails[] = [];
let nextAppId = 1;
let nextCandId = 1;
const candidatesMap = new Map<string, ApplicationWithDetails['candidate']>();

function ensureCandidate(candidate: ApplicationWithDetails['candidate']): ApplicationWithDetails['candidate'] {
  const existing = candidatesMap.get(candidate.email);
  if (existing) {
    const updated = {
      ...existing,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      phone: candidate.phone ?? existing.phone,
      location: candidate.location ?? existing.location,
      nationality: candidate.nationality ?? existing.nationality,
      homeCounty: candidate.homeCounty ?? existing.homeCounty,
      experience: candidate.experience,
      education: candidate.education ?? existing.education,
      resumePath: candidate.resumePath ?? existing.resumePath,
    };
    candidatesMap.set(candidate.email, updated);
    return updated;
  }
  const withId = {
    ...candidate,
    id: candidate.id || `mem-cand-${nextCandId++}`,
    nationality: candidate.nationality ?? null,
    homeCounty: candidate.homeCounty ?? null,
  };
  candidatesMap.set(candidate.email, withId);
  return withId;
}

export function createInMemoryApplication(params: {
  jobId: string;
  job: ApplicationWithDetails['job'];
  candidate: ApplicationWithDetails['candidate'];
  coverLetter?: string | null;
  resumePath?: string | null;
  salaryExpectations?: string | null;
  formData?: ApplicationWithDetails['formData'];
}): ApplicationWithDetails {
  const candidate = ensureCandidate({
    ...params.candidate,
    resumePath: params.resumePath ?? params.candidate.resumePath,
  });
  const id = `mem-app-${nextAppId++}`;
  const now = new Date().toISOString();
  const app: ApplicationWithDetails = {
    id,
    jobId: params.jobId,
    candidateId: candidate.id,
    status: 'pending',
    appliedDate: now,
    coverLetter: params.coverLetter ?? null,
    resumePath: params.resumePath ?? candidate.resumePath ?? null,
    salaryExpectations: params.salaryExpectations ?? null,
    notes: null,
    formData: params.formData ?? null,
    createdAt: now,
    updatedAt: now,
    candidate,
    job: params.job,
  };
  applications.push(app);
  return app;
}

export function getInMemoryApplications(filters?: {
  jobId?: string;
  clientId?: string;
  status?: ApplicationStatus;
  nationality?: string;
  homeCounty?: string;
  minExperience?: number;
  maxExperience?: number;
  educationLevel?: string;
  discipline?: string;
  employmentType?: string;
  certificate?: string;
  membership?: string;
  employerCompany?: string;
}): ApplicationWithDetails[] {
  let list = [...applications];
  if (filters?.jobId) list = list.filter((a) => a.jobId === filters.jobId);
  if (filters?.clientId) list = list.filter((a) => a.job.clientId === filters.clientId);
  if (filters?.status) list = list.filter((a) => a.status === filters.status);
  if (filters?.nationality?.trim()) {
    const q = filters.nationality.trim().toLowerCase();
    list = list.filter((a) => a.candidate.nationality?.toLowerCase().includes(q));
  }
  if (filters?.homeCounty?.trim()) {
    const q = filters.homeCounty.trim().toLowerCase();
    list = list.filter((a) => a.candidate.homeCounty?.toLowerCase().includes(q));
  }
  if (filters?.minExperience != null)
    list = list.filter((a) => a.candidate.experience >= filters.minExperience!);
  if (filters?.maxExperience != null)
    list = list.filter((a) => a.candidate.experience <= filters.maxExperience!);
  if (filters?.educationLevel?.trim()) {
    const level = filters.educationLevel.trim();
    list = list.filter(
      (a) =>
        a.formData?.education?.some((e) => e.level === level) ?? false
    );
  }
  if (filters?.discipline?.trim()) {
    const q = filters.discipline.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.formData?.education?.some((e) => (e.discipline ?? '').toLowerCase().includes(q)) ?? false
    );
  }
  if (filters?.employmentType?.trim()) {
    const type = filters.employmentType.trim();
    list = list.filter(
      (a) =>
        a.formData?.employmentHistory?.some((e) => e.employmentType === type) ?? false
    );
  }
  if (filters?.certificate?.trim()) {
    const q = filters.certificate.trim().toLowerCase();
    list = list.filter((a) => {
      const fd = a.formData;
      if (!fd) return false;
      const fromList = fd.professionalCertificationsList?.some((c) =>
        (c.name ?? '').toLowerCase().includes(q)
      );
      return Boolean(fromList);
    });
  }
  if (filters?.membership?.trim()) {
    const q = filters.membership.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.formData?.professionalMemberships?.some((m) =>
          (m.name ?? '').toLowerCase().includes(q)
        ) ?? false
    );
  }
  if (filters?.employerCompany?.trim()) {
    const q = filters.employerCompany.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.formData?.employmentHistory?.some((e) =>
          (e.companyName ?? '').toLowerCase().includes(q)
        ) ?? false
    );
  }
  return list.sort(
    (a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
  );
}

export function getInMemoryApplicationById(id: string): ApplicationWithDetails | null {
  return applications.find((a) => a.id === id) ?? null;
}

export function updateInMemoryApplicationStatus(
  id: string,
  status: ApplicationStatus
): ApplicationWithDetails | null {
  const app = applications.find((a) => a.id === id);
  if (!app) return null;
  app.status = status;
  app.updatedAt = new Date().toISOString();
  return app;
}

export function updateInMemoryApplicationNotes(
  id: string,
  notes: string | null
): ApplicationWithDetails | null {
  const app = applications.find((a) => a.id === id);
  if (!app) return null;
  app.notes = notes;
  app.updatedAt = new Date().toISOString();
  return app;
}

export function getInMemoryCandidates(filters?: {
  jobId?: string;
  minExperience?: number;
  maxExperience?: number;
  education?: string;
  search?: string;
  employerCompany?: string;
}): ApplicationWithDetails['candidate'][] {
  const seen = new Map<string, ApplicationWithDetails['candidate']>();
  let list = applications;
  if (filters?.jobId) list = list.filter((a) => a.jobId === filters.jobId);
  list.forEach((a) => {
    if (!seen.has(a.candidate.id)) seen.set(a.candidate.id, a.candidate);
  });
  let candidates = Array.from(seen.values());
  if (filters?.minExperience != null)
    candidates = candidates.filter((c) => c.experience >= filters.minExperience!);
  if (filters?.maxExperience != null)
    candidates = candidates.filter((c) => c.experience <= filters.maxExperience!);
  if (filters?.education?.trim()) {
    const q = filters.education.toLowerCase();
    candidates = candidates.filter(
      (c) => c.education?.toLowerCase().includes(q)
    );
  }
  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase();
    candidates = candidates.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }
  if (filters?.employerCompany?.trim()) {
    const q = filters.employerCompany.trim().toLowerCase();
    const matchedCandidateIds = new Set(
      list
        .filter(
          (a) =>
            a.formData?.employmentHistory?.some((e) =>
              (e.companyName ?? '').toLowerCase().includes(q)
            ) ?? false
        )
        .map((a) => a.candidate.id)
    );
    candidates = candidates.filter((c) => matchedCandidateIds.has(c.id));
  }
  return candidates.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
