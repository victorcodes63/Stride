// Dashboard & API contract – shared shapes so UI and backend stay in sync

export type ApplicationStatus =
  | 'pending'
  | 'reviewed'
  | 'shortlisted'
  | 'rejected'
  | 'hired';

export interface CandidateSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  location: string | null;
  nationality: string | null;
  homeCounty: string | null;
  experience: number;
  education: string | null;
  resumePath: string | null;
  createdAt: string;
}

/** Minimal candidate for list view – fetch full details on demand */
export interface CandidateListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  location: string | null;
  experience: number;
  education: string | null;
  resumePath: string | null;
}

export interface CandidatesListApiResponse {
  candidates: CandidateListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface JobSummary {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  postedDate: string;
  isActive: boolean;
  clientId: string | null;
  clientName: string | null;
  minYearsExperience: number | null;
  educationLevel: string | null;
  educationQualification: string | null;
  requiredCertifications: string | null;
}

// Application form data (Stages 2–5) stored as JSON on Application
export type EducationLevel = 'high_school' | 'certificate' | 'diploma' | 'undergraduate' | 'masters' | 'phd';

export interface EducationEntry {
  level: EducationLevel;
  institution: string;
  grade: string;
  discipline?: string;
  certificatePath?: string;
}

export type EmploymentType = 'Full-time' | 'Contract' | 'Freelance';

export interface EmploymentEntry {
  jobTitle: string;
  companyName: string;
  industry: string;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string;
  isCurrentJob?: boolean;
}

export interface ProfessionalCertificationEntry {
  name: string;
  certificatePath?: string;
}

export interface ProfessionalMembershipEntry {
  name: string;
  membershipNo: string;
  certificatePath?: string;
}

export interface ApplicationFormData {
  gender?: string;
  education: EducationEntry[];
  employmentHistory: EmploymentEntry[];
  professionalCertificationsList?: ProfessionalCertificationEntry[];
  professionalMemberships?: ProfessionalMembershipEntry[];
  declarations: {
    accurate: boolean;
    dataProcessing: boolean;
    backgroundChecks: boolean;
    talentPool: boolean;
  };
}

export interface ApplicationWithDetails {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  appliedDate: string;
  coverLetter: string | null;
  resumePath: string | null;
  salaryExpectations: string | null;
  notes: string | null;
  formData: ApplicationFormData | null;
  createdAt: string;
  updatedAt: string;
  /** True if the currently authenticated staff user has opened this application's sidebar. Defaults to true for unauthenticated/in-memory contexts. */
  viewedByMe?: boolean;
  candidate: CandidateSummary;
  job: JobSummary;
}

/** Minimal application for list view – fetch full details on demand */
export interface ApplicationListItem {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  appliedDate: string;
  resumePath: string | null;
  viewedByMe?: boolean;
  candidate: Pick<CandidateSummary, 'id' | 'firstName' | 'lastName' | 'email' | 'resumePath'>;
  job: Pick<JobSummary, 'id' | 'title' | 'company' | 'location' | 'clientName'>;
}

export interface ApplicationsListApiResponse {
  applications: ApplicationListItem[];
  total: number;
  pending: number;
  shortlisted: number;
  hired: number;
}

export interface ApplicationsListResponse {
  applications: ApplicationWithDetails[];
  total: number;
}

export interface ApplicationsQueryParams {
  jobId?: string;
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
  sortBy?: 'appliedDate' | 'status' | 'candidateName';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateApplicationStatusBody {
  status: ApplicationStatus;
  emailMessage?: string; // optional custom note to include in status-update email
}

// Interview management
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled';
export type InterviewType = 'phone' | 'video' | 'onsite';

export type InterviewDurationMinutes = 30 | 45 | 60;

export type ConfirmationStatus = 'pending' | 'confirmed' | 'declined' | 'reschedule_requested' | 'withdrawn';

export interface InterviewWithDetails {
  id: string;
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  type: InterviewType;
  locationOrLink: string | null;
  notes: string | null;
  status: InterviewStatus;
  inviteSentAt: string | null;
  officialLetterPath: string | null;
  confirmationStatus: ConfirmationStatus;
  confirmationNotes: string | null;
  confirmationAt: string | null;
  createdAt: string;
  updatedAt: string;
  application: {
    id: string;
    status: ApplicationStatus;
    candidate: CandidateSummary;
    job: JobSummary;
  };
}

export interface CreateInterviewBody {
  applicationId: string;
  scheduledAt: string; // ISO datetime
  durationMinutes?: InterviewDurationMinutes; // default 45
  type: InterviewType;
  locationOrLink?: string;
  notes?: string;
}

export interface UpdateInterviewBody {
  scheduledAt?: string;
  durationMinutes?: InterviewDurationMinutes;
  type?: InterviewType;
  locationOrLink?: string | null;
  notes?: string | null;
  status?: InterviewStatus;
  officialLetterPath?: string | null;
}

export interface BulkCreateInterviewsBody {
  jobId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: InterviewDurationMinutes;
  type: InterviewType;
  applicationIds: string[]; // max 10
  locationOrLink?: string;
  /** Same calendar day as date; Nairobi time */
  breaks?: { time: string; durationMinutes: number; label?: string; notes?: string }[];
}

/** Lunch / buffer blocks on the interview schedule (same job, merged in UI + export). */
export interface InterviewScheduleBreak {
  id: string;
  jobId: string;
  scheduledAt: string;
  durationMinutes: number;
  label: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Staff / User management (no password in API responses)
export type UserRole = 'admin' | 'staff' | 'viewer';

/** Internal staff persona (Prisma enum `StaffUserType`). Employer portal logins: `RecruitmentClientPortalUser`. */
export const STAFF_USER_TYPES = ['operations', 'business_manager', 'finance', 'director'] as const;
export type StaffUserType = (typeof STAFF_USER_TYPES)[number];

/** Aggregated Accounts module permissions (admin = all true). */
export interface AccountsPermissionsSummary {
  canManageContracts: boolean;
  canManageInvoices: boolean;
  canManagePayments: boolean;
  canManageVendors: boolean;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  staffUserType: StaffUserType;
  /** Derived: admin or business_manager (staff leave approvals / team queue). */
  canApproveStaffLeave: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** True if user should see Accounts in the dashboard (admin or any AccountsStaffAccess row). */
  hasAccountsAccess: boolean;
  accountsPermissions: AccountsPermissionsSummary;
  /** Executive system summary at /dashboard/analytics (admin or Director staff type). */
  canViewSystemAnalytics: boolean;
}

export interface CreateUserBody {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  staffUserType?: StaffUserType;
  accountsPermissions?: AccountsPermissionsSummary;
}

export interface UpdateUserBody {
  name?: string;
  role?: UserRole;
  staffUserType?: StaffUserType;
  isActive?: boolean;
  password?: string; // optional new password
  accountsPermissions?: AccountsPermissionsSummary;
}

export type EssPortalRole = 'employee' | 'manager' | 'hr';

export interface EssPortalUserSummary {
  id: string;
  employeeId: string | null;
  employeeName: string | null;
  email: string;
  name: string;
  role: EssPortalRole;
  isActive: boolean;
  lastLoginAt: string | null;
  mustResetPassword: boolean;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionMatrixRow {
  permissionKey: string;
  label: string;
  module: string;
  description: string | null;
  adminAllowed: boolean;
  staffAllowed: boolean;
  viewerAllowed: boolean;
}

export interface AuditEventSummary {
  id: string;
  actorUserId?: string | null;
  actorNameOrEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  route: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface SystemSettingsPayload {
  companyName: string;
  companyEmail: string;
  defaultCurrency: string;
  payrollCutoffDay: number;
  leaveApprovalMode: 'single' | 'multi';
  requireMfaForAdmins: boolean;
}
