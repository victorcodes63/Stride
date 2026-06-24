import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateJobInput, toJobStringArray } from '@/lib/jobs-store';
import { JobListing } from '@/types/ats';
import { ensureUniqueSlug, jobSlugBase } from '@/lib/slug';
import { parseDateTimeAsNairobi } from '@/lib/timezone';
import { getOrCreateRecruitmentSettings, resolveJobCompanyAndClientId } from '@/lib/recruitment-workspace';
import { isDemoMode } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { getActiveEntities, loadOperatingEntitiesSettings } from '@/lib/operating-entities';

type PrismaJobForListing = {
  id: string;
  referenceId: string | null;
  slug: string | null;
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  postedDate: Date;
  description: string;
  requirements: unknown;
  responsibilities: unknown;
  benefits: unknown;
  salary: unknown;
  experience: string | null;
  education: string | null;
  skills: unknown;
  isActive: boolean;
  applicationCount: number;
  views: number;
  applicationStartAt: Date | null;
  applicationDeadline: Date | null;
  _count?: { applications: number };
};

function prismaJobToListing(job: PrismaJobForListing): JobListing {
  const requirements = typeof job.requirements === 'string' ? job.requirements : '';
  const responsibilities = typeof job.responsibilities === 'string' ? job.responsibilities : '';
  const benefits = typeof job.benefits === 'string' ? job.benefits : '';
  const skills = Array.isArray(job.skills) ? job.skills : [];
  const salary =
    job.salary && typeof job.salary === 'object' && 'min' in job.salary && 'max' in job.salary
      ? (job.salary as { min: number; max: number; currency: string })
      : undefined;
  const applicationCount = job._count?.applications ?? job.applicationCount;
  return {
    id: job.id,
    referenceId: job.referenceId ?? undefined,
    slug: job.slug ?? undefined,
    title: job.title,
    company: job.company,
    location: job.location,
    type: job.type as JobListing['type'],
    category: job.category,
    postedDate: job.postedDate.toISOString(),
    description: job.description,
    requirements,
    responsibilities,
    benefits,
    salary,
    experience: job.experience ?? '',
    education: job.education ?? '',
    skills: skills as string[],
    isActive: job.isActive,
    applicationStartAt: job.applicationStartAt ? job.applicationStartAt.toISOString() : undefined,
    applicationDeadline: job.applicationDeadline ? job.applicationDeadline.toISOString() : undefined,
    applicationCount: typeof applicationCount === 'number' ? applicationCount : job.applicationCount,
    views: job.views,
  };
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('activeOnly') === 'true';
  const keyword = searchParams.get('keyword')?.toLowerCase();
  const location = searchParams.get('location')?.toLowerCase();
  const category = searchParams.get('category');

  try {
    const now = new Date();
    const recruitmentSettings = activeOnly ? await getOrCreateRecruitmentSettings(prisma) : null;
    let employerCompany: string | undefined;
    if (isDemoMode()) {
      const entityId = await resolveEntityIdOrDefault(request);
      const oe = await loadOperatingEntitiesSettings();
      employerCompany = getActiveEntities(oe).find((e) => e.id === entityId)?.legalName;
    }
    const jobs = await prisma.job.findMany({
        where: {
          ...(employerCompany ? { company: employerCompany } : {}),
          ...(activeOnly
            ? {
                isActive: true,
                OR: [
                  { applicationDeadline: null },
                  { applicationDeadline: { gt: now } },
                ],
                AND: [
                  {
                    OR: [
                      { applicationStartAt: null },
                      { applicationStartAt: { lte: now } },
                    ],
                  },
                ],
              }
            : {}),
          ...(keyword
            ? {
                OR: [
                  { title: { contains: keyword, mode: 'insensitive' } },
                  { company: { contains: keyword, mode: 'insensitive' } },
                  { description: { contains: keyword, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
          ...(category ? { category } : {}),
        },
        include: { client: true, _count: { select: { applications: true } } },
        orderBy: { postedDate: 'desc' },
      });
    const list = jobs.map((job) => {
      const listing = prismaJobToListing(job as unknown as PrismaJobForListing);
      if (activeOnly) {
        if (job.concealCompany) listing.company = 'Confidential';
        else if (recruitmentSettings?.employerName?.trim()) listing.company = recruitmentSettings.employerName.trim();
        if (!(job as { salaryPublic?: boolean }).salaryPublic) listing.salary = undefined;
      }
      return listing;
    });
    return NextResponse.json(list);
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to load jobs.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  let company = typeof b.company === 'string' ? b.company.trim() : '';
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const location = typeof b.location === 'string' ? b.location.trim() : '';
  const type = typeof b.type === 'string' ? b.type.trim() : 'Full Time';
  const category = typeof b.category === 'string' ? b.category.trim() : '';
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  const requirementsRaw = b.requirements;
  const requirements = typeof requirementsRaw === 'string' && requirementsRaw.trim()
    ? requirementsRaw.trim()
    : Array.isArray(requirementsRaw)
      ? (requirementsRaw as unknown[]).map((x) => (typeof x === 'string' ? x.trim() : String(x))).filter(Boolean)
      : [];
  const responsibilitiesRaw = b.responsibilities;
  const responsibilities = typeof responsibilitiesRaw === 'string' && responsibilitiesRaw.trim()
    ? responsibilitiesRaw.trim()
    : Array.isArray(responsibilitiesRaw)
      ? (responsibilitiesRaw as unknown[]).map((x) => (typeof x === 'string' ? x.trim() : String(x))).filter(Boolean)
      : [];
  const benefitsRaw = b.benefits;
  const benefits = typeof benefitsRaw === 'string'
    ? (benefitsRaw.trim() || undefined)
    : Array.isArray(benefitsRaw)
      ? (benefitsRaw as unknown[]).map((x) => (typeof x === 'string' ? x.trim() : String(x))).filter(Boolean)
      : [];

  const hasReqs = typeof requirements === 'string' ? requirements.replace(/<[^>]+>/g, '').trim().length > 0 : requirements.length > 0;
  const hasResp = typeof responsibilities === 'string' ? responsibilities.replace(/<[^>]+>/g, '').trim().length > 0 : responsibilities.length > 0;
  if (!title || !description || !hasReqs || !hasResp) {
    return NextResponse.json(
      { error: 'Missing required fields: title, description, requirements, and responsibilities are required.' },
      { status: 400 }
    );
  }
  let resolvedClientId: string | null | undefined;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  try {
    const { company: resolvedName, clientId: linked } = await resolveJobCompanyAndClientId(
      prisma,
      company || undefined
    );
    company = resolvedName;
    resolvedClientId = linked;
  } catch {
    return NextResponse.json({ error: 'Failed to resolve employer settings.' }, { status: 500 });
  }

  if (!company) {
    return NextResponse.json(
      { error: 'Company / employer name is required (set it on the job or under Recruitment → Organization).' },
      { status: 400 }
    );
  }
  if (!location) {
    return NextResponse.json({ error: 'Location is required.' }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: 'Category is required.' }, { status: 400 });
  }

  const salary =
    b.salary && typeof b.salary === 'object' && b.salary !== null && 'min' in b.salary && 'max' in b.salary
      ? {
          min: Number((b.salary as { min: unknown }).min) || 0,
          max: Number((b.salary as { max: unknown }).max) || 0,
          currency: String((b.salary as { currency?: unknown }).currency || 'KES'),
        }
      : undefined;
  const experience = typeof b.experience === 'string' ? b.experience.trim() : undefined;
  const education = typeof b.education === 'string' ? b.education.trim() : undefined;
  const minYearsExperience =
    typeof b.minYearsExperience === 'number'
      ? b.minYearsExperience
      : typeof b.minYearsExperience === 'string' && b.minYearsExperience.trim() !== ''
        ? parseInt(b.minYearsExperience.trim(), 10)
        : undefined;
  const educationLevel = typeof b.educationLevel === 'string' ? b.educationLevel.trim() || undefined : undefined;
  const educationQualification = typeof b.educationQualification === 'string' ? b.educationQualification.trim() || undefined : undefined;
  const requiredCertifications = typeof b.requiredCertifications === 'string' ? b.requiredCertifications.trim() || undefined : undefined;
  const skills = Array.isArray(b.skills)
    ? (b.skills as unknown[]).map((x) => (typeof x === 'string' ? x.trim() : String(x))).filter(Boolean)
    : [];
  const concealCompany = b.concealCompany === true;
  const salaryPublic = b.salaryPublic === true;
  const applicationStartAt =
    typeof b.applicationStartAt === 'string' && b.applicationStartAt.trim()
      ? parseDateTimeAsNairobi(b.applicationStartAt.trim())
      : undefined;
  if (applicationStartAt !== undefined && Number.isNaN(applicationStartAt.getTime())) {
    return NextResponse.json({ error: 'Invalid application start date/time.' }, { status: 400 });
  }
  const applicationDeadline =
    typeof b.applicationDeadline === 'string' && b.applicationDeadline.trim()
      ? parseDateTimeAsNairobi(b.applicationDeadline.trim())
      : undefined;
  if (applicationDeadline !== undefined && Number.isNaN(applicationDeadline.getTime())) {
    return NextResponse.json({ error: 'Invalid application deadline date.' }, { status: 400 });
  }

  const input: CreateJobInput = {
    title,
    company,
    location,
    type,
    category,
    description,
    requirements: toJobStringArray(requirements),
    responsibilities: toJobStringArray(responsibilities),
    benefits: toJobStringArray(benefits).length ? toJobStringArray(benefits) : undefined,
    salary,
    experience,
    education,
    minYearsExperience: minYearsExperience != null && !Number.isNaN(minYearsExperience) ? minYearsExperience : undefined,
    educationLevel,
    educationQualification,
    requiredCertifications,
    skills: skills.length ? skills : undefined,
    clientId: resolvedClientId ?? undefined,
    concealCompany,
    salaryPublic,
    applicationStartAt: applicationStartAt ? applicationStartAt.toISOString() : undefined,
    applicationDeadline: applicationDeadline ? applicationDeadline.toISOString() : undefined,
  };

  try {
    const year = new Date().getFullYear();
    const prefix = `JOB-${year}-`;
    const existing = await prisma.job.findMany({
        where: { referenceId: { startsWith: prefix } },
        select: { referenceId: true },
        orderBy: { referenceId: 'desc' },
        take: 1,
      });
      const nextNum = existing.length === 0
        ? 1
        : (parseInt(existing[0].referenceId?.replace(prefix, '') || '0', 10) + 1);
      const referenceId = `${prefix}${String(nextNum).padStart(4, '0')}`;

      const baseSlug = jobSlugBase(input.title, input.location);
      const slug = await ensureUniqueSlug(baseSlug, async (s) => {
        const existing = await prisma.job.findUnique({ where: { slug: s } });
        return !!existing;
      });

    const job = await prisma.job.create({
        data: {
          referenceId,
          slug,
          title: input.title,
          company: input.company,
          location: input.location,
          type: input.type,
          category: input.category,
          description: input.description,
          requirements: input.requirements,
          responsibilities: input.responsibilities,
          benefits: input.benefits?.length ? input.benefits : [],
          salary: input.salary ?? undefined,
          experience: input.experience ?? null,
          education: input.education ?? null,
          minYearsExperience: input.minYearsExperience ?? null,
          educationLevel: input.educationLevel ?? null,
          educationQualification: input.educationQualification ?? null,
          requiredCertifications: input.requiredCertifications ?? null,
          skills: input.skills ?? [],
          clientId: resolvedClientId ?? null,
          concealCompany: input.concealCompany ?? false,
          salaryPublic: input.salaryPublic ?? false,
          applicationStartAt: applicationStartAt ?? null,
          applicationDeadline: applicationDeadline ?? null,
        },
      });
    return NextResponse.json(prismaJobToListing(job as unknown as PrismaJobForListing));
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to create job.' }, { status: 500 });
  }
}
