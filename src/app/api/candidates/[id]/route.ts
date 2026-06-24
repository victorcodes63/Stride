/**
 * GET /api/candidates/[id]
 * Returns candidate details with formData from most recent application
 * and list of previous applications (for talent-pool / urgent-reach-out use case).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInMemoryApplications } from '@/lib/applications-store';
import type { CandidateSummary } from '@/types/dashboard';
import type { ApplicationFormData } from '@/types/dashboard';

export interface CandidateWithDetails extends CandidateSummary {
  formData: ApplicationFormData | null;
  previousApplications: {
    id: string;
    jobTitle: string;
    company: string;
    appliedDate: string;
    status: string;
  }[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Candidate id required' }, { status: 400 });
  }

  try {
    if (process.env.DATABASE_URL) {
      const candidate = await prisma.candidate.findUnique({
        where: { id },
        include: {
          applications: {
            orderBy: { appliedDate: 'desc' },
            include: { job: { include: { client: true } } },
          },
        },
      });
      if (!candidate) {
        return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
      }

      const mostRecentApp = candidate.applications[0];
      const formData = (mostRecentApp?.formData as ApplicationFormData | null) ?? null;

      const previousApplications = candidate.applications.map((a) => ({
        id: a.id,
        jobTitle: a.job.title,
        company: a.job.company,
        appliedDate: a.appliedDate.toISOString(),
        status: a.status,
      }));

      const result: CandidateWithDetails = {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone,
        location: candidate.location,
        nationality: candidate.nationality ?? null,
        homeCounty: candidate.homeCounty ?? null,
        experience: candidate.experience,
        education: candidate.education,
        resumePath: candidate.resumePath,
        createdAt: candidate.createdAt.toISOString(),
        formData,
        previousApplications,
      };

      return NextResponse.json(result);
    }
  } catch {
    // fall through to in-memory
  }

  // In-memory: get applications for this candidate
  const all = getInMemoryApplications();
  const apps = all.filter((a) => a.candidateId === id);
  if (apps.length === 0) {
    const cand = all.find((a) => a.candidateId === id)?.candidate;
    if (!cand) {
      return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
    }
    const summary: CandidateSummary = {
      id: cand.id,
      firstName: cand.firstName,
      lastName: cand.lastName,
      email: cand.email,
      phone: cand.phone,
      location: cand.location,
      nationality: cand.nationality ?? null,
      homeCounty: cand.homeCounty ?? null,
      experience: cand.experience,
      education: cand.education,
      resumePath: cand.resumePath,
      createdAt: cand.createdAt,
    };
    return NextResponse.json({
      ...summary,
      formData: null,
      previousApplications: [],
    } as CandidateWithDetails);
  }

  const mostRecent = apps[0];
  const formData = mostRecent.formData as ApplicationFormData | null;
  const previousApplications = apps.map((a) => ({
    id: a.id,
    jobTitle: a.job.title,
    company: a.job.company,
    appliedDate: a.appliedDate,
    status: a.status,
  }));

  const cand = mostRecent.candidate;
  const result: CandidateWithDetails = {
    id: cand.id,
    firstName: cand.firstName,
    lastName: cand.lastName,
    email: cand.email,
    phone: cand.phone,
    location: cand.location,
    nationality: cand.nationality ?? null,
    homeCounty: cand.homeCounty ?? null,
    experience: cand.experience,
    education: cand.education,
    resumePath: mostRecent.resumePath ?? cand.resumePath,
    createdAt: cand.createdAt,
    formData,
    previousApplications,
  };

  return NextResponse.json(result);
}
