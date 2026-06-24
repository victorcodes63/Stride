// Mock data matching API contract – swap for GET /api/applications when wiring

import type { ApplicationWithDetails, ApplicationStatus } from '@/types/dashboard';

const statuses: ApplicationStatus[] = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];

const mockCandidateFields = { nationality: null, homeCounty: null } as const;
const mockJobFields = {
  clientId: null,
  clientName: null,
  minYearsExperience: null,
  educationLevel: null,
  educationQualification: null,
  requiredCertifications: null,
} as const;
const mockApplicationFields = { salaryExpectations: null, formData: null } as const;

function randomStatus(): ApplicationStatus {
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const MOCK_APPLICATIONS: ApplicationWithDetails[] = [
  {
    id: 'app-1',
    jobId: '1',
    candidateId: 'cand-1',
    status: 'pending',
    appliedDate: daysAgo(1),
    coverLetter: 'I am very interested in this role and believe my experience aligns well.',
    resumePath: '/resumes/jane-doe.pdf',
    notes: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...mockApplicationFields,
    candidate: {
      id: 'cand-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phone: '+254 700 123 456',
      location: 'Nairobi',
      experience: 5,
      education: 'Bachelor of Commerce, University of Nairobi',
      resumePath: '/resumes/jane-doe.pdf',
      createdAt: daysAgo(1),
      ...mockCandidateFields,
    },
    job: {
      id: '1',
      title: 'CEO and Trust Secretary',
      company: 'Expert Hire',
      location: 'Nairobi',
      type: 'Full Time',
      category: 'Executive',
      postedDate: daysAgo(14),
      isActive: true,
      ...mockJobFields,
    },
  },
  {
    id: 'app-2',
    jobId: '2',
    candidateId: 'cand-2',
    status: 'shortlisted',
    appliedDate: daysAgo(3),
    coverLetter: 'I have 3+ years in sales in the Coast region.',
    resumePath: '/resumes/john-kamau.pdf',
    notes: 'Strong fit for Coast sales. Schedule interview.',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
    ...mockApplicationFields,
    candidate: {
      id: 'cand-2',
      firstName: 'John',
      lastName: 'Kamau',
      email: 'john.kamau@example.com',
      phone: '+254 722 987 654',
      location: 'Mombasa',
      experience: 3,
      education: 'Bachelor of Business, Moi University',
      resumePath: '/resumes/john-kamau.pdf',
      createdAt: daysAgo(3),
      ...mockCandidateFields,
    },
    job: {
      id: '2',
      title: 'Sales Representative – Coast Region',
      company: 'Expert Hire',
      location: 'Coast Region',
      type: 'Full Time',
      category: 'Sales & Marketing',
      postedDate: daysAgo(21),
      isActive: true,
      ...mockJobFields,
    },
  },
  {
    id: 'app-3',
    jobId: '3',
    candidateId: 'cand-3',
    status: 'reviewed',
    appliedDate: daysAgo(5),
    coverLetter: null,
    resumePath: '/resumes/grace-wanjiku.pdf',
    notes: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
    ...mockApplicationFields,
    candidate: {
      id: 'cand-3',
      firstName: 'Grace',
      lastName: 'Wanjiku',
      email: 'grace.w@example.com',
      phone: '+254 711 555 123',
      location: 'Nairobi',
      experience: 6,
      education: 'PhD Computer Science, JKUAT',
      resumePath: '/resumes/grace-wanjiku.pdf',
      createdAt: daysAgo(5),
      ...mockCandidateFields,
    },
    job: {
      id: '3',
      title: 'Senior Lecturer in Software Development',
      company: 'Expert Hire',
      location: 'Nairobi',
      type: 'Full Time',
      category: 'Education & Training',
      postedDate: daysAgo(30),
      isActive: true,
      ...mockJobFields,
    },
  },
  {
    id: 'app-4',
    jobId: '4',
    candidateId: 'cand-4',
    status: 'rejected',
    appliedDate: daysAgo(7),
    coverLetter: 'Interested in ICT security role.',
    resumePath: '/resumes/peter-otieno.pdf',
    notes: 'Lack of required certifications.',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(6),
    ...mockApplicationFields,
    candidate: {
      id: 'cand-4',
      firstName: 'Peter',
      lastName: 'Otieno',
      email: 'peter.o@example.com',
      phone: null,
      location: 'Kisumu',
      experience: 2,
      education: 'Bachelor of IT',
      resumePath: '/resumes/peter-otieno.pdf',
      createdAt: daysAgo(7),
      ...mockCandidateFields,
    },
    job: {
      id: '4',
      title: 'ICT Security Officer',
      company: 'Expert Hire',
      location: 'Nairobi',
      type: 'Full Time',
      category: 'Technology',
      postedDate: daysAgo(14),
      isActive: true,
      ...mockJobFields,
    },
  },
  {
    id: 'app-5',
    jobId: '1',
    candidateId: 'cand-5',
    status: 'hired',
    appliedDate: daysAgo(10),
    coverLetter: 'Executive leadership experience in governance.',
    resumePath: '/resumes/sarah-mwangi.pdf',
    notes: 'Offer accepted. Start date next month.',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(8),
    ...mockApplicationFields,
    candidate: {
      id: 'cand-5',
      firstName: 'Sarah',
      lastName: 'Mwangi',
      email: 'sarah.m@example.com',
      phone: '+254 700 444 555',
      location: 'Nairobi',
      experience: 12,
      education: 'MBA, Strathmore University',
      resumePath: '/resumes/sarah-mwangi.pdf',
      createdAt: daysAgo(10),
      ...mockCandidateFields,
    },
    job: {
      id: '1',
      title: 'CEO and Trust Secretary',
      company: 'Expert Hire',
      location: 'Nairobi',
      type: 'Full Time',
      category: 'Executive',
      postedDate: daysAgo(14),
      isActive: true,
      ...mockJobFields,
    },
  },
];

export function getMockApplications(filters: {
  jobId?: string;
  status?: ApplicationStatus;
}): ApplicationWithDetails[] {
  let list = [...MOCK_APPLICATIONS];
  if (filters.jobId) list = list.filter((a) => a.jobId === filters.jobId);
  if (filters.status) list = list.filter((a) => a.status === filters.status);
  return list.sort(
    (a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
  );
}

export function getMockJobOptions(): { id: string; title: string }[] {
  const seen = new Map<string, string>();
  MOCK_APPLICATIONS.forEach((a) => {
    if (!seen.has(a.job.id)) seen.set(a.job.id, a.job.title);
  });
  return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
}
