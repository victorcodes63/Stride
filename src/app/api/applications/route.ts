import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendApplicationReceivedEmail } from '@/lib/email';
import { reportApiError } from '@/lib/monitoring';
import { parseStaffSession } from '@/lib/auth-session';
import type {
  ApplicationWithDetails,
  ApplicationListItem,
  ApplicationsListApiResponse,
} from '@/types/dashboard';
import { yearsBetweenEmploymentDates } from '@/lib/employment-sort';

const STAFF_SESSION_COOKIE = 'staff_session';

function jobToSummary(job: {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  postedDate: string;
  isActive: boolean;
  clientId?: string | null;
  clientName?: string | null;
  minYearsExperience?: number | null;
  educationLevel?: string | null;
  educationQualification?: string | null;
  requiredCertifications?: string | null;
}) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    type: job.type,
    category: job.category,
    postedDate: job.postedDate,
    isActive: job.isActive,
    clientId: job.clientId ?? null,
    clientName: job.clientName ?? null,
    minYearsExperience: job.minYearsExperience ?? null,
    educationLevel: job.educationLevel ?? null,
    educationQualification: job.educationQualification ?? null,
    requiredCertifications: job.requiredCertifications ?? null,
  };
}

async function sendConfirmationEmailNonBlocking(params: {
  to: string;
  applicantFirstName: string;
  jobTitle: string;
  companyName: string;
  applicationId: string;
}) {
  try {
    const result = await sendApplicationReceivedEmail(params);
    if (!result.sent) {
      console.error('Application confirmation email not sent.', {
        to: params.to,
        applicationId: params.applicationId,
        reason: result.reason,
        error: result.error,
        diagnostics: result.diagnostics ?? null,
      });
      return;
    }
    console.info('Application confirmation email sent.', {
      to: params.to,
      applicationId: params.applicationId,
      messageId: result.messageId ?? null,
    });
  } catch (error) {
    console.error('Application confirmation email failed:', {
      to: params.to,
      applicationId: params.applicationId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Compute total work experience years from employment history (used when client sends 0). */
function totalWorkExperienceYears(
  employmentHistory?: { startDate?: string; endDate?: string; isCurrentJob?: boolean }[]
): number {
  if (!employmentHistory?.length) return 0;
  return employmentHistory.reduce((sum, e) => {
    const end = e.isCurrentJob ? 'Present' : (e.endDate ?? '');
    return sum + yearsBetweenEmploymentDates(e.startDate ?? '', end);
  }, 0);
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const rawSession = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const currentUserId = rawSession ? parseStaffSession(rawSession).userId : undefined;

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId') || undefined;
  const clientId = searchParams.get('clientId') || undefined;
  const status = searchParams.get('status') || undefined;
  const nationality = searchParams.get('nationality') || undefined;
  const homeCounty = searchParams.get('homeCounty') || undefined;
  const educationLevel = searchParams.get('educationLevel') || undefined;
  const educationDiscipline = searchParams.get('discipline') || undefined;
  const employmentType = searchParams.get('employmentType') || undefined;
  const certificate = searchParams.get('certificate') || undefined;
  const membership = searchParams.get('membership') || undefined;
  const minExperience = searchParams.get('minExperience');
  const maxExperience = searchParams.get('maxExperience');
  const employerCompany = searchParams.get('employerCompany') || undefined;
  const search = searchParams.get('search') || undefined;
  const minExp =
    minExperience !== null && minExperience !== undefined && minExperience !== ''
      ? parseInt(minExperience, 10)
      : undefined;
  const maxExp =
    maxExperience !== null && maxExperience !== undefined && maxExperience !== ''
      ? parseInt(maxExperience, 10)
      : undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
  const skip = (page - 1) * limit;

  try {
      const candidateWhere: Record<string, unknown> = {
        ...(nationality?.trim()
          ? { nationality: { contains: nationality.trim(), mode: 'insensitive' as const } }
          : {}),
        ...(homeCounty?.trim()
          ? { homeCounty: { contains: homeCounty.trim(), mode: 'insensitive' as const } }
          : {}),
      };
      if (minExp != null && !Number.isNaN(minExp) && (maxExp == null || Number.isNaN(maxExp))) {
        candidateWhere.experience = { gte: minExp };
      } else if (maxExp != null && !Number.isNaN(maxExp) && (minExp == null || Number.isNaN(minExp))) {
        candidateWhere.experience = { lte: maxExp };
      } else if (minExp != null && !Number.isNaN(minExp) && maxExp != null && !Number.isNaN(maxExp)) {
        candidateWhere.experience = { gte: minExp, lte: maxExp };
      }

      const applications = await prisma.application.findMany({
        where: {
          ...(jobId ? { jobId } : {}),
          ...(clientId ? { job: { clientId } } : {}),
          ...(status ? { status: status as 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired' } : {}),
          ...(Object.keys(candidateWhere).length ? { candidate: candidateWhere } : {}),
        },
        include: {
          candidate: true,
          job: { include: { client: true } },
          views: currentUserId
            ? { where: { userId: currentUserId }, select: { userId: true } }
            : false,
        },
        orderBy: { appliedDate: 'desc' },
      });
      let filtered = applications;
      if (educationLevel?.trim()) {
        const level = educationLevel.trim();
        filtered = filtered.filter((a) => {
          const fd = a.formData as { education?: { level: string }[] } | null;
          return fd?.education?.some((e) => e.level === level) ?? false;
        });
      }
      if (educationDiscipline?.trim()) {
        const q = educationDiscipline.trim().toLowerCase();
        filtered = filtered.filter((a) => {
          const fd = a.formData as { education?: { discipline?: string }[] } | null;
          return fd?.education?.some((e) => (e.discipline ?? '').toLowerCase().includes(q)) ?? false;
        });
      }
      if (employmentType?.trim()) {
        const type = employmentType.trim();
        filtered = filtered.filter((a) => {
          const fd = a.formData as { employmentHistory?: { employmentType: string }[] } | null;
          return fd?.employmentHistory?.some((e) => e.employmentType === type) ?? false;
        });
      }
      if (certificate?.trim()) {
        const q = certificate.trim().toLowerCase();
        filtered = filtered.filter((a) => {
          const fd = a.formData as {
            professionalCertificationsList?: { name: string }[];
          } | null;
          if (!fd) return false;
          const fromList = fd.professionalCertificationsList?.some((c) =>
            (c.name ?? '').toLowerCase().includes(q)
          );
          return Boolean(fromList);
        });
      }
      if (membership?.trim()) {
        const q = membership.trim().toLowerCase();
        filtered = filtered.filter((a) => {
          const fd = a.formData as { professionalMemberships?: { name: string }[] } | null;
          return fd?.professionalMemberships?.some((m) =>
            (m.name ?? '').toLowerCase().includes(q)
          ) ?? false;
        });
      }
      if (employerCompany?.trim()) {
        const q = employerCompany.trim().toLowerCase();
        filtered = filtered.filter((a) => {
          const fd = a.formData as { employmentHistory?: { companyName?: string }[] } | null;
          return (
            fd?.employmentHistory?.some((e) =>
              (e.companyName ?? '').toLowerCase().includes(q)
            ) ?? false
          );
        });
      }
      if (search?.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (a) =>
            `${a.candidate.firstName} ${a.candidate.lastName}`.toLowerCase().includes(q) ||
            a.candidate.email.toLowerCase().includes(q) ||
            a.job.title.toLowerCase().includes(q)
        );
      }
      const total = filtered.length;
      const pending = filtered.filter((a) => a.status === 'pending').length;
      const shortlisted = filtered.filter((a) => a.status === 'shortlisted').length;
      const hired = filtered.filter((a) => a.status === 'hired').length;
      const paginated = filtered.slice(skip, skip + limit);

      const listItems: ApplicationListItem[] = paginated.map((a) => ({
        id: a.id,
        jobId: a.jobId,
        candidateId: a.candidateId,
        status: a.status,
        appliedDate: a.appliedDate.toISOString(),
        resumePath: a.resumePath,
        viewedByMe: currentUserId
          ? ((a as typeof a & { views?: { userId: string }[] }).views?.length ?? 0) > 0
          : true,
        candidate: {
          id: a.candidate.id,
          firstName: a.candidate.firstName,
          lastName: a.candidate.lastName,
          email: a.candidate.email,
          resumePath: a.candidate.resumePath,
        },
        job: {
          id: a.job.id,
          title: a.job.title,
          company: a.job.company,
          location: a.job.location,
          clientName: a.job.client?.name ?? null,
        },
      }));

      const response: ApplicationsListApiResponse = {
        applications: listItems,
        total,
        pending,
        shortlisted,
        hired,
      };
      return NextResponse.json(response);
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to load applications.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const jobId = typeof b.jobId === 'string' ? b.jobId.trim() : '';
  const coverLetter = typeof b.coverLetter === 'string' ? b.coverLetter.trim() || undefined : undefined;
  const resumePath = typeof b.resumePath === 'string' ? b.resumePath.trim() || undefined : undefined;
  const salaryExpectations = typeof b.salaryExpectations === 'string' ? b.salaryExpectations.trim() || null : null;
  const formDataRaw = b.formData;

  const cand = b.candidate as Record<string, unknown> | undefined;
  if (!cand || typeof cand.email !== 'string' || !cand.email.trim()) {
    return NextResponse.json({ error: 'Candidate email is required.' }, { status: 400 });
  }

  const firstName = typeof cand.firstName === 'string' ? cand.firstName.trim() : '';
  const lastName = typeof cand.lastName === 'string' ? cand.lastName.trim() : '';
  const email = cand.email.trim();
  const phone = typeof cand.phone === 'string' ? cand.phone.trim() || undefined : undefined;
  const location = typeof cand.location === 'string' ? cand.location.trim() || undefined : undefined;
  const nationality = typeof cand.nationality === 'string' ? cand.nationality.trim() || undefined : undefined;
  const homeCounty = typeof cand.homeCounty === 'string' ? cand.homeCounty.trim() || undefined : undefined;
  let experience = typeof cand.experience === 'number' ? cand.experience : Number(cand.experience) || 0;
  const education = typeof cand.education === 'string' ? cand.education.trim() || undefined : undefined;
  const formDataForExp = formDataRaw && typeof formDataRaw === 'object' && formDataRaw !== null ? (formDataRaw as { employmentHistory?: { startDate?: string; endDate?: string; isCurrentJob?: boolean }[] }) : null;
  if (experience === 0 && formDataForExp?.employmentHistory?.length) {
    experience = totalWorkExperienceYears(formDataForExp.employmentHistory);
  }

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
  }
  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Candidate first name and last name are required.' }, { status: 400 });
  }
  if (firstName.length < 2) {
    return NextResponse.json({ error: 'First name must be at least 2 characters.' }, { status: 400 });
  }
  if (lastName.length < 2) {
    return NextResponse.json({ error: 'Last name must be at least 2 characters.' }, { status: 400 });
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (email.length > 254) {
    return NextResponse.json({ error: 'Email is too long.' }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
  }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 9) {
    return NextResponse.json({ error: 'Phone number must have at least 9 digits.' }, { status: 400 });
  }
  if (!nationality || !nationality.trim()) {
    return NextResponse.json({ error: 'Nationality is required.' }, { status: 400 });
  }
  if (!homeCounty || homeCounty.length < 2) {
    return NextResponse.json({ error: 'Home county is required and must be at least 2 characters.' }, { status: 400 });
  }
  const formDataObj = formDataRaw && typeof formDataRaw === 'object' && formDataRaw !== null ? (formDataRaw as { gender?: string }) : null;
  if (formDataObj?.gender !== undefined && !String(formDataObj.gender ?? '').trim()) {
    return NextResponse.json({ error: 'Gender is required.' }, { status: 400 });
  }
  if (!salaryExpectations) {
    return NextResponse.json({ error: 'Minimum expected salary is required.' }, { status: 400 });
  }
  const salaryDigits = salaryExpectations.replace(/\D/g, '');
  if (!salaryDigits || parseInt(salaryDigits, 10) < 1) {
    return NextResponse.json(
      { error: 'Minimum expected salary must be a valid amount (numbers only).' },
      { status: 400 }
    );
  }
  if (salaryDigits.length > 12) {
    return NextResponse.json(
      { error: 'Please enter a reasonable salary amount.' },
      { status: 400 }
    );
  }

  try {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
      }
      const deadline = job.applicationDeadline;
      if (deadline && new Date(deadline) < new Date()) {
        return NextResponse.json(
          { error: 'The application deadline for this job has passed.' },
          { status: 400 }
        );
      }

      const existingApplication = await prisma.application.findFirst({
        where: {
          jobId,
          candidate: {
            email,
          },
        },
        select: { id: true, status: true },
      });
      if (existingApplication) {
        return NextResponse.json(
          { error: 'You have already submitted an application for this job.' },
          { status: 409 }
        );
      }

      if (phone) {
        const duplicatePhoneCandidate = await prisma.candidate.findFirst({
          where: {
            phone,
            NOT: { email },
          },
          select: { email: true },
        });
        if (duplicatePhoneCandidate) {
          return NextResponse.json(
            {
              error:
                'An applicant with this phone number already exists under a different email. Please use the original email or contact support.',
            },
            { status: 409 }
          );
        }
      }

      const candidate = await prisma.candidate.upsert({
        where: { email },
        create: {
          firstName,
          lastName,
          email,
          phone: phone ?? null,
          location: location ?? null,
          nationality: nationality ?? null,
          homeCounty: homeCounty ?? null,
          experience,
          education: education ?? null,
          resumePath: resumePath ?? null,
        },
        update: {
          firstName,
          lastName,
          phone: phone ?? undefined,
          location: location ?? undefined,
          nationality: nationality ?? undefined,
          homeCounty: homeCounty ?? undefined,
          experience,
          education: education ?? undefined,
          ...(resumePath !== undefined && { resumePath: resumePath ?? null }),
        },
      });

      const formData =
        formDataRaw && typeof formDataRaw === 'object' && formDataRaw !== null
          ? (formDataRaw as Record<string, unknown>)
          : undefined;

      const application = await prisma.application.create({
        data: {
          jobId,
          candidateId: candidate.id,
          coverLetter: coverLetter ?? null,
          resumePath: resumePath ?? candidate.resumePath,
          salaryExpectations: salaryExpectations ?? null,
          formData: formData !== undefined ? (formData as Prisma.InputJsonValue) : undefined,
        },
        include: { candidate: true, job: { include: { client: true } } },
      });

      const result: ApplicationWithDetails = {
        id: application.id,
        jobId: application.jobId,
        candidateId: application.candidateId,
        status: application.status,
        appliedDate: application.appliedDate.toISOString(),
        coverLetter: application.coverLetter,
        resumePath: application.resumePath,
        salaryExpectations: application.salaryExpectations ?? null,
        notes: application.notes,
        formData: (application.formData as ApplicationWithDetails['formData']) ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        candidate: {
          id: application.candidate.id,
          firstName: application.candidate.firstName,
          lastName: application.candidate.lastName,
          email: application.candidate.email,
          phone: application.candidate.phone,
          location: application.candidate.location,
          nationality: application.candidate.nationality ?? null,
          homeCounty: application.candidate.homeCounty ?? null,
          experience: application.candidate.experience,
          education: application.candidate.education,
          resumePath: application.candidate.resumePath,
          createdAt: application.candidate.createdAt.toISOString(),
        },
        job: jobToSummary({
          id: application.job.id,
          title: application.job.title,
          company: application.job.company,
          location: application.job.location,
          type: application.job.type,
          category: application.job.category,
          postedDate: application.job.postedDate.toISOString(),
          isActive: application.job.isActive,
          clientId: application.job.clientId ?? null,
          clientName: application.job.client?.name ?? null,
          minYearsExperience: application.job.minYearsExperience ?? null,
          educationLevel: application.job.educationLevel ?? null,
          educationQualification: application.job.educationQualification ?? null,
          requiredCertifications: application.job.requiredCertifications ?? null,
        }),
      };

      await sendConfirmationEmailNonBlocking({
        to: application.candidate.email,
        applicantFirstName: application.candidate.firstName,
        jobTitle: application.job.title,
        companyName: application.job.company,
        applicationId: application.id,
      });

      return NextResponse.json(result);
  } catch (e) {
    await reportApiError({
      route: 'POST /api/applications',
      message: e instanceof Error ? e.message : String(e),
      context: { jobId, email },
    });
    return NextResponse.json({ error: 'Failed to create application.' }, { status: 500 });
  }
}
