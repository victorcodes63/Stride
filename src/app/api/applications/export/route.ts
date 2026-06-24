import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import type { ApplicationWithDetails } from '@/types/dashboard';
import ExcelJS from 'exceljs';
import { sortEmploymentByRecency } from '@/lib/employment-sort';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId') || undefined;
  const clientId = searchParams.get('clientId') || undefined;
  const status = searchParams.get('status') || undefined;
  const nationality = searchParams.get('nationality') || undefined;
  const homeCounty = searchParams.get('homeCounty') || undefined;
  const educationLevel = searchParams.get('educationLevel') || undefined;
  const discipline = searchParams.get('discipline') || undefined;
  const employmentType = searchParams.get('employmentType') || undefined;
  const certificate = searchParams.get('certificate') || undefined;
  const membership = searchParams.get('membership') || undefined;
  const minExperience = searchParams.get('minExperience');
  const maxExperience = searchParams.get('maxExperience');
  const employerCompany = searchParams.get('employerCompany') || undefined;
  const minExp =
    minExperience !== null && minExperience !== undefined && minExperience !== ''
      ? parseInt(minExperience, 10)
      : undefined;
  const maxExp =
    maxExperience !== null && maxExperience !== undefined && maxExperience !== ''
      ? parseInt(maxExperience, 10)
      : undefined;

  let applications: ApplicationWithDetails[] = [];

  try {
    {
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

      const rows = await prisma.application.findMany({
        where: {
          ...(jobId ? { jobId } : {}),
          ...(clientId ? { job: { clientId } } : {}),
          ...(status ? { status: status as 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired' } : {}),
          ...(Object.keys(candidateWhere).length ? { candidate: candidateWhere } : {}),
        },
        include: { candidate: true, job: { include: { client: true } } },
        orderBy: { appliedDate: 'desc' },
      });
      let filtered = rows;
      if (educationLevel?.trim()) {
        const level = educationLevel.trim();
        filtered = filtered.filter((a) => {
          const fd = a.formData as { education?: { level: string }[] } | null;
          return fd?.education?.some((e) => e.level === level) ?? false;
        });
      }
      if (discipline?.trim()) {
        const q = discipline.trim().toLowerCase();
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
      applications = filtered.map((a) => ({
        id: a.id,
        jobId: a.jobId,
        candidateId: a.candidateId,
        status: a.status,
        appliedDate: a.appliedDate.toISOString(),
        coverLetter: a.coverLetter,
        resumePath: a.resumePath,
        salaryExpectations: a.salaryExpectations ?? null,
        notes: a.notes,
        formData: (a.formData as ApplicationWithDetails['formData']) ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        candidate: {
          id: a.candidate.id,
          firstName: a.candidate.firstName,
          lastName: a.candidate.lastName,
          email: a.candidate.email,
          phone: a.candidate.phone,
          location: a.candidate.location,
          nationality: a.candidate.nationality ?? null,
          homeCounty: a.candidate.homeCounty ?? null,
          experience: a.candidate.experience,
          education: a.candidate.education,
          resumePath: a.candidate.resumePath,
          createdAt: a.candidate.createdAt.toISOString(),
        },
        job: {
          id: a.job.id,
          title: a.job.title,
          company: a.job.company,
          location: a.job.location,
          type: a.job.type,
          category: a.job.category,
          postedDate: a.job.postedDate.toISOString(),
          isActive: a.job.isActive,
          clientId: a.job.clientId ?? null,
          clientName: a.job.client?.name ?? null,
          minYearsExperience: a.job.minYearsExperience ?? null,
          educationLevel: a.job.educationLevel ?? null,
          educationQualification: a.job.educationQualification ?? null,
          requiredCertifications: a.job.requiredCertifications ?? null,
        },
      }));
    }
  } catch (e) {
    await reportApiError({
      route: 'GET /api/applications/export',
      message: e instanceof Error ? e.message : String(e),
      context: {
        jobId,
        clientId,
        status,
      },
    });
    return NextResponse.json({ error: 'Failed to load applications.' }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Stride';
  workbook.created = new Date();

  const dateStr = new Date().toISOString().slice(0, 10);
  const jobTitle = applications.length > 0 ? applications[0].job.title : '';
  const singleJob = applications.every((a) => a.job.title === jobTitle);
  const sheetName = singleJob && jobTitle
    ? `${jobTitle.replace(/[\/*?:\[\]\\]/g, ' ').trim()} ${dateStr}`
    : `Applications ${dateStr}`;
  const safeSheetName = sheetName.slice(0, 31);

  const sheet = workbook.addWorksheet(safeSheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FF1D2460' } },
  });

  const MAX_EDUCATION_COLUMNS = 5;
  const educationHeaders = Array.from({ length: MAX_EDUCATION_COLUMNS }, (_, i) => `Education ${i + 1}`);

  const headerRow = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Nationality',
    'Home County',
    'Gender',
    'Location',
    'Experience (years)',
    'Minimum expected salary',
    ...educationHeaders,
    'Employment history',
    'Work experience (years)',
    'Professional certifications',
    'Professional memberships',
    'Declarations (accurate)',
    'Declarations (data)',
    'Declarations (background)',
    'Declarations (talent pool)',
    'Applied Date',
    'Client',
  ];
  sheet.addRow(headerRow);
  const header = sheet.getRow(1);
  header.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF043d4a' },
  };
  header.alignment = { wrapText: true, vertical: 'middle' };
  header.height = 22;

  function yearsBetween(startDate: string, endDate: string): number {
    if (!startDate?.trim()) return 0;
    const start = new Date(startDate.trim());
    if (isNaN(start.getTime())) return 0;
    const endStr = (endDate ?? '').trim().toLowerCase();
    const end =
      !endStr || endStr === 'present' || endStr === 'current'
        ? new Date()
        : new Date(endDate.trim());
    if (isNaN(end.getTime())) return 0;
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    return Math.max(0, Math.round((months / 12) * 10) / 10);
  }

  function formatEducationEntry(e: { level: string; institution: string; grade: string; discipline?: string }): string {
    const level = (e.level ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const base = `${level}: ${(e.institution ?? '').trim() || '—'}, ${(e.grade ?? '').trim() || '—'}`;
    const disc = (e.discipline ?? '').trim();
    return disc ? `${base} · ${disc}` : base;
  }

  function totalWorkExperienceYears(
    employmentHistory?: { startDate: string; endDate: string; isCurrentJob?: boolean }[]
  ): number {
    if (!employmentHistory?.length) return 0;
    return employmentHistory.reduce((sum, e) => {
      const end = e.isCurrentJob ? new Date().toISOString().slice(0, 7) : (e.endDate ?? '');
      return sum + yearsBetween(e.startDate ?? '', end);
    }, 0);
  }

  for (const app of applications) {
    const c = app.candidate;
    const appliedDate = new Date(app.appliedDate);
    const fd = app.formData;
    const educationEntries = fd?.education ?? [];
    const educationCells = Array.from({ length: MAX_EDUCATION_COLUMNS }, (_, i) =>
      educationEntries[i] ? formatEducationEntry(educationEntries[i]) : ''
    );
    const formatEmploymentDate = (d: string) => {
      if (!d?.trim()) return '—';
      const date = new Date(d.trim());
      if (isNaN(date.getTime())) return d.trim();
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
    };
    const employmentSorted = sortEmploymentByRecency(
      fd?.employmentHistory?.filter((e) => e.jobTitle || e.companyName) ?? []
    );
    const employmentStr = employmentSorted.length
      ? employmentSorted.map(
        (e) => {
          const company = (e.companyName ?? '').trim() || '—';
          const position = (e.jobTitle ?? '').trim() || '—';
          const start = formatEmploymentDate(e.startDate ?? '');
          const end = e.isCurrentJob ? 'Present' : formatEmploymentDate(e.endDate ?? '');
          return `Company: ${company}; Position: ${position}; Dates: ${start} – ${end}`;
        }
      ).join('\n||\n')
      : '';
    const workExpYears = totalWorkExperienceYears(fd?.employmentHistory);
    const profCertsStr = fd?.professionalCertificationsList?.map((x) => x.name).join(', ') ?? '';
    const membershipsStr =
      fd?.professionalMemberships?.map((m) => `${m.name} (${m.membershipNo})`).join('; ') ?? '';

    sheet.addRow([
      c.firstName ?? '',
      c.lastName ?? '',
      c.email ?? '',
      c.phone ?? '',
      c.nationality ?? '',
      c.homeCounty ?? '',
      fd?.gender ?? '',
      c.location ?? '',
      c.experience ?? 0,
      app.salaryExpectations ?? '',
      ...educationCells,
      employmentStr,
      workExpYears,
      profCertsStr,
      membershipsStr,
      fd?.declarations?.accurate ? 'Yes' : 'No',
      fd?.declarations?.dataProcessing ? 'Yes' : 'No',
      fd?.declarations?.backgroundChecks ? 'Yes' : 'No',
      fd?.declarations?.talentPool ? 'Yes' : 'No',
      appliedDate.toLocaleDateString(undefined, { dateStyle: 'medium' }),
      app.job.clientName ?? '',
    ]);
  }

  const numCols = headerRow.length;
  sheet.columns = Array.from({ length: numCols }, (_, i) => {
    const widths: number[] = [
      14, 14, 28, 16, 14, 14, 12, 18, 10, 22,
      ...Array(MAX_EDUCATION_COLUMNS).fill(32),
      56, 12, 24, 28, 12, 12, 12, 14, 14, 18,
    ];
    return { width: widths[i] ?? 18 };
  });

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };
  for (let i = 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    row.eachCell((cell) => {
      cell.border = borderStyle;
      cell.alignment = { wrapText: true, vertical: 'top' };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `applications-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.byteLength),
    },
  });
}
