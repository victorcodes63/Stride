/**
 * Shared mapping helpers for the Training & Development API routes.
 *
 * These turn Prisma query results (with the expected includes) into the
 * contract shapes defined in `@/lib/training/types`, so the mapping logic is
 * defined once and never drifts between route handlers. All helpers are pure
 * and synchronous.
 */
import type { TrainingEnrollment, TrainingMaterial, TrainingProgram } from '@prisma/client';
import type {
  TrainingEnrollmentRow,
  TrainingMaterialRow,
  TrainingProgramDetail,
  TrainingProgramSummary,
} from '@/lib/training/types';

type ProgramCore = Omit<
  TrainingProgramSummary,
  'enrollmentCount' | 'completedCount' | 'materialCount'
>;

/** Program source rows needed to build a summary (list view). */
export type ProgramSummarySource = TrainingProgram & {
  _count: { enrollments: number; materials: number };
  enrollments: Pick<TrainingEnrollment, 'status'>[];
};

/** Program source rows needed to build a detail (full enrollments + materials). */
export type ProgramDetailSource = TrainingProgram & {
  enrollments: TrainingEnrollment[];
  materials: TrainingMaterial[];
};

function mapProgramCore(p: TrainingProgram): ProgramCore {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    provider: p.provider,
    location: p.location,
    isOnline: p.isOnline,
    startDate: p.startDate?.toISOString().split('T')[0] ?? null,
    endDate: p.endDate?.toISOString().split('T')[0] ?? null,
    durationHours: p.durationHours,
    maxParticipants: p.maxParticipants,
    cost: p.cost ? Number(p.cost) : null,
    currency: p.currency,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}

export function mapProgramSummary(p: ProgramSummarySource): TrainingProgramSummary {
  return {
    ...mapProgramCore(p),
    enrollmentCount: p._count.enrollments,
    completedCount: p.enrollments.filter((e) => e.status === 'completed').length,
    materialCount: p._count.materials,
  };
}

export function mapProgramDetail(p: ProgramDetailSource): TrainingProgramDetail {
  return {
    ...mapProgramCore(p),
    enrollmentCount: p.enrollments.length,
    completedCount: p.enrollments.filter((e) => e.status === 'completed').length,
    materialCount: p.materials.length,
    notes: p.notes,
    enrollments: p.enrollments.map(mapEnrollment),
    materials: p.materials.map(mapMaterial),
  };
}

export function mapEnrollment(e: TrainingEnrollment): TrainingEnrollmentRow {
  return {
    id: e.id,
    programId: e.programId,
    employeeId: e.employeeId,
    userId: e.userId,
    enrolleeName: e.enrolleeName,
    status: e.status,
    enrolledAt: e.enrolledAt.toISOString(),
    completedAt: e.completedAt ? e.completedAt.toISOString() : null,
    score: e.score != null ? Number(e.score) : null,
    certificatePath: e.certificatePath,
    feedback: e.feedback,
    notes: e.notes,
  };
}

export function mapMaterial(m: TrainingMaterial): TrainingMaterialRow {
  return {
    id: m.id,
    programId: m.programId,
    title: m.title,
    filePath: m.filePath,
    externalUrl: m.externalUrl,
    sortOrder: m.sortOrder,
    createdAt: m.createdAt.toISOString(),
  };
}
