/**
 * Shared contract for the Training & Development module.
 *
 * This is the single source of truth for the API <-> UI boundary. Both the
 * `/api/training/**` route handlers and the `dashboard/(app)/training/**`
 * client components import from here so the shapes never drift.
 *
 * Enum string unions mirror the Prisma `TrainingStatus` / `EnrollmentStatus`
 * enums (see prisma/schema.prisma). Keep them in sync if the schema changes.
 */

export const TRAINING_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export const ENROLLMENT_STATUSES = [
  'enrolled',
  'in_progress',
  'completed',
  'withdrawn',
  'failed',
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** Row shape returned by `GET /api/training` (list view). */
export type TrainingProgramSummary = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  provider: string | null;
  location: string | null;
  isOnline: boolean;
  startDate: string | null; // yyyy-mm-dd
  endDate: string | null; // yyyy-mm-dd
  durationHours: number | null;
  maxParticipants: number | null;
  cost: number | null;
  currency: string;
  status: TrainingStatus;
  enrollmentCount: number;
  completedCount: number;
  materialCount: number;
  createdAt: string; // ISO
};

export type TrainingEnrollmentRow = {
  id: string;
  programId: string;
  employeeId: string | null;
  userId: string | null;
  enrolleeName: string;
  status: EnrollmentStatus;
  enrolledAt: string; // ISO
  completedAt: string | null; // ISO
  score: number | null;
  certificatePath: string | null;
  feedback: string | null;
  notes: string | null;
};

export type TrainingMaterialRow = {
  id: string;
  programId: string;
  title: string;
  filePath: string | null;
  externalUrl: string | null;
  sortOrder: number;
  createdAt: string; // ISO
};

/** Shape returned by `GET /api/training/[id]` (detail view). */
export type TrainingProgramDetail = TrainingProgramSummary & {
  notes: string | null;
  enrollments: TrainingEnrollmentRow[];
  materials: TrainingMaterialRow[];
};

/** Body for `POST /api/training` and `PATCH /api/training/[id]`. */
export type TrainingProgramInput = {
  title?: string;
  description?: string | null;
  category?: string | null;
  provider?: string | null;
  location?: string | null;
  isOnline?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  durationHours?: number | null;
  maxParticipants?: number | null;
  cost?: number | null;
  currency?: string;
  status?: TrainingStatus;
  notes?: string | null;
};

/** Body for `POST /api/training/[id]/enrollments`. */
export type TrainingEnrollmentInput = {
  enrolleeName: string;
  employeeId?: string | null;
  userId?: string | null;
  status?: EnrollmentStatus;
  notes?: string | null;
};

/** Body for `PATCH /api/training/[id]/enrollments/[enrollmentId]`. */
export type TrainingEnrollmentUpdate = {
  status?: EnrollmentStatus;
  score?: number | null;
  feedback?: string | null;
  notes?: string | null;
  completedAt?: string | null;
};

/** Body for `POST /api/training/[id]/materials`. */
export type TrainingMaterialInput = {
  title: string;
  externalUrl?: string | null;
  filePath?: string | null;
  sortOrder?: number;
};

// ---------------------------------------------------------------------------
// Presentation helpers (shared by list + detail so labels/tones never drift).
// ---------------------------------------------------------------------------

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  enrolled: 'Enrolled',
  in_progress: 'In progress',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
  failed: 'Failed',
};

/** Maps to `dashStatusChip` tones in @/lib/dashboard-status-chips. */
export type DashStatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral' | 'primary';

export function trainingStatusTone(status: TrainingStatus): DashStatusTone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'scheduled':
      return 'primary';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function enrollmentStatusTone(status: EnrollmentStatus): DashStatusTone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'enrolled':
      return 'primary';
    case 'withdrawn':
      return 'neutral';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}
