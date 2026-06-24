// In-memory job store for development when DATABASE_URL is not set.
// Jobs are lost on server restart. Use PostgreSQL in production.

import { JobListing } from '@/types/ats';
import type { JobSummary } from '@/types/dashboard';
import { getInMemoryClientById } from './clients-store';
import { jobSlugBase } from './slug';

type StoredJob = {
  id: string;
  referenceId?: string;
  slug?: string;
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  postedDate: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  salary?: { min: number; max: number; currency: string };
  experience: string;
  education: string;
  minYearsExperience?: number | null;
  educationLevel?: string | null;
  educationQualification?: string | null;
  requiredCertifications?: string | null;
  skills: string[];
  isActive: boolean;
  applicationCount: number;
  views: number;
  applicationStartAt?: string | null;
  applicationDeadline?: string | null;
  clientId?: string;
  concealCompany?: boolean;
  salaryPublic?: boolean;
};

const jobs: StoredJob[] = [];
let nextId = 1;

function toListing(j: StoredJob, maskAnonymous = false): JobListing {
  let company = j.company;
  if (maskAnonymous) {
    if (j.concealCompany) company = 'Confidential';
    else if (j.clientId) {
      const client = getInMemoryClientById(j.clientId);
      if (client?.isAnonymous) company = 'Confidential';
    }
  }
  const showSalary = !maskAnonymous || !!j.salaryPublic;
  return {
    id: j.id,
    referenceId: j.referenceId ?? undefined,
    slug: j.slug ?? undefined,
    title: j.title,
    company,
    location: j.location,
    type: j.type as JobListing['type'],
    category: j.category,
    postedDate: j.postedDate,
    description: j.description,
    requirements: j.requirements.join('\n'),
    responsibilities: j.responsibilities.join('\n'),
    benefits: j.benefits.join('\n'),
    salary: showSalary ? j.salary : undefined,
    experience: j.experience,
    education: j.education,
    skills: j.skills,
    isActive: j.isActive,
    applicationStartAt: j.applicationStartAt ?? undefined,
    applicationDeadline: j.applicationDeadline ?? undefined,
    applicationCount: j.applicationCount,
    views: j.views,
  };
}

/** Returns a map of clientId -> number of jobs (for dashboard client list). */
export function getInMemoryJobCountByClient(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const j of jobs) {
    if (j.clientId) map[j.clientId] = (map[j.clientId] || 0) + 1;
  }
  return map;
}

export function getInMemoryJobs(activeOnly?: boolean, maskAnonymous = false): JobListing[] {
  let list = jobs.map((j) => toListing(j, maskAnonymous));
  if (activeOnly) {
    const now = new Date().toISOString();
    list = list.filter(
      (j) =>
        j.isActive &&
        (j.applicationStartAt == null || j.applicationStartAt === '' || j.applicationStartAt <= now) &&
        (j.applicationDeadline == null || j.applicationDeadline === '' || j.applicationDeadline > now)
    );
  }
  return list.sort(
    (a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime()
  );
}

export function getInMemoryJobById(id: string, maskAnonymous = false): JobListing | null {
  const j = jobs.find((x) => x.id === id);
  return j ? toListing(j, maskAnonymous) : null;
}

/** Find job by id or slug (for public apply URL resolution). */
export function getInMemoryJobBySlugOrId(slugOrId: string, maskAnonymous = false): JobListing | null {
  const j = jobs.find((x) => x.id === slugOrId || x.slug === slugOrId);
  return j ? toListing(j, maskAnonymous) : null;
}

/** JobSummary for applications (includes clientId, clientName). */
export function getInMemoryJobSummary(id: string): JobSummary | null {
  const j = jobs.find((x) => x.id === id);
  if (!j) return null;
  const client = j.clientId ? getInMemoryClientById(j.clientId) : null;
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    type: j.type,
    category: j.category,
    postedDate: j.postedDate,
    isActive: j.isActive,
    clientId: j.clientId ?? null,
    clientName: client?.name ?? null,
    minYearsExperience: j.minYearsExperience ?? null,
    educationLevel: j.educationLevel ?? null,
    educationQualification: j.educationQualification ?? null,
    requiredCertifications: j.requiredCertifications ?? null,
  };
}

/** Raw job for dashboard/edit (includes concealCompany, real company name). */
export function getInMemoryJobRaw(id: string): StoredJob | null {
  return jobs.find((x) => x.id === id) ?? null;
}

export type UpdateJobInput = Partial<CreateJobInput>;

export function updateInMemoryJob(id: string, input: UpdateJobInput): JobListing | null {
  const index = jobs.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const existing = jobs[index];
  const updated: StoredJob = {
    ...existing,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.company !== undefined && { company: input.company }),
    ...(input.location !== undefined && { location: input.location }),
    ...(input.type !== undefined && { type: input.type }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.requirements !== undefined && { requirements: input.requirements }),
    ...(input.responsibilities !== undefined && { responsibilities: input.responsibilities }),
    ...(input.benefits !== undefined && { benefits: input.benefits }),
    ...(input.salary !== undefined && { salary: input.salary }),
    ...(input.experience !== undefined && { experience: input.experience }),
    ...(input.education !== undefined && { education: input.education }),
    ...(input.minYearsExperience !== undefined && { minYearsExperience: input.minYearsExperience }),
    ...(input.educationLevel !== undefined && { educationLevel: input.educationLevel }),
    ...(input.educationQualification !== undefined && { educationQualification: input.educationQualification }),
    ...(input.requiredCertifications !== undefined && { requiredCertifications: input.requiredCertifications }),
    ...(input.skills !== undefined && { skills: input.skills }),
    ...(input.clientId !== undefined && { clientId: input.clientId }),
    ...(input.concealCompany !== undefined && { concealCompany: input.concealCompany }),
    ...(input.salaryPublic !== undefined && { salaryPublic: input.salaryPublic }),
    ...(input.applicationStartAt !== undefined && { applicationStartAt: input.applicationStartAt }),
    ...(input.applicationDeadline !== undefined && { applicationDeadline: input.applicationDeadline }),
    ...(input.slug !== undefined && { slug: input.slug }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  };
  jobs[index] = updated;
  return toListing(updated, false);
}

/** Normalize API body field (string or string[]) to CreateJobInput string[]. */
export function toJobStringArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? [t] : [];
  }
  return value.map((x) => (typeof x === 'string' ? x.trim() : String(x))).filter(Boolean);
}

export interface CreateJobInput {
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits?: string[];
  salary?: { min: number; max: number; currency: string };
  experience?: string;
  education?: string;
  minYearsExperience?: number | null;
  educationLevel?: string | null;
  educationQualification?: string | null;
  requiredCertifications?: string | null;
  skills?: string[];
  clientId?: string;
  concealCompany?: boolean;
  salaryPublic?: boolean;
  applicationStartAt?: string | null;
  applicationDeadline?: string | null;
  slug?: string;
  isActive?: boolean;
}

export function createInMemoryJob(input: CreateJobInput): JobListing {
  const id = `mem-${nextId++}`;
  const year = new Date().getFullYear();
  const sameYear = jobs.filter((j) => j.referenceId?.startsWith(`JOB-${year}-`));
  const nextNum = sameYear.length + 1;
  const referenceId = `JOB-${year}-${String(nextNum).padStart(4, '0')}`;
  const now = new Date().toISOString();
  const slug =
    input.slug ?? jobSlugBase(input.title, input.location, id.replace(/^mem-/, ''));
  const job: StoredJob = {
    id,
    referenceId,
    slug,
    title: input.title,
    company: input.company,
    location: input.location,
    type: input.type,
    category: input.category,
    postedDate: now,
    description: input.description,
    requirements: input.requirements,
    responsibilities: input.responsibilities,
    benefits: input.benefits ?? [],
    salary: input.salary,
    experience: input.experience ?? '',
    education: input.education ?? '',
    minYearsExperience: input.minYearsExperience ?? null,
    educationLevel: input.educationLevel ?? null,
    educationQualification: input.educationQualification ?? null,
    requiredCertifications: input.requiredCertifications ?? null,
    skills: input.skills ?? [],
    isActive: true,
    applicationCount: 0,
    views: 0,
    applicationStartAt: input.applicationStartAt ?? null,
    applicationDeadline: input.applicationDeadline ?? null,
    clientId: input.clientId,
    concealCompany: input.concealCompany ?? false,
    salaryPublic: input.salaryPublic ?? false,
  };
  jobs.push(job);
  return toListing(job, false);
}
