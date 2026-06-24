/**
 * RAV-67: Per-module tenant migration tracking.
 * Schema + RLS are platform-wide (RAV-62); route migration is per licensed module.
 */

import type { ModuleKey } from '@/lib/modules';
import { MODULE_DEFINITIONS } from '@/lib/modules';
import { ROUTE_MODULE_BINDINGS } from '@/lib/module-routes';

/** Prisma models that are intentionally global (no organizationId / no RLS). */
export const GLOBAL_PRISMA_MODELS = new Set([
  'User',
  'PermissionDefinition',
  'RolePermission',
  'UserPermissionOverride',
  'CountryConfig',
  'Organization',
  'SchedulerLock',
]);

export type ModuleMigrationPhase =
  | 'not-started'
  | 'schema-ready'
  | 'routes-partial'
  | 'tenant-safe';

export type ModuleMigrationRecord = {
  module: ModuleKey;
  label: string;
  phase: ModuleMigrationPhase;
  /** Product phase (A–G) that owns the migration work. */
  productPhase: string;
  /** Representative Prisma models (not exhaustive). */
  prismaModels: string[];
  notes?: string;
};

/** API route prefixes for this module (from ROUTE_MODULE_BINDINGS). */
export function apiPrefixesForModule(module: ModuleKey): string[] {
  const prefixes = ROUTE_MODULE_BINDINGS.filter((b) => b.module === module && b.prefix.startsWith('/api/'))
    .map((b) => b.prefix);
  return [...new Set(prefixes)].sort((a, b) => b.length - a.length);
}

/**
 * Curated model lists for reporting — extend when a module gains new tables.
 * All listed models must carry organizationId + RLS once the module ships.
 */
export const MODULE_PRISMA_MODELS: Record<ModuleKey, string[]> = {
  core: [
    'Employee',
    'Department',
    'OutsourcingClient',
    'EmployeeDocument',
    'EmployeeCredential',
    'OnboardingTemplate',
    'OnboardingWorkflow',
    'OnboardingTask',
    'EssPortalUser',
    'OrganizationMembership',
    'SystemSetting',
    'Insight',
  ],
  leave: [
    'LeaveType',
    'LeaveBalance',
    'LeaveApplication',
    'LeavePolicy',
    'LeavePolicyRule',
    'LeavePolicyAssignment',
    'LeaveBalanceLedger',
    'StaffLeaveType',
    'StaffLeaveBalance',
    'StaffLeaveApplication',
    'LeaveApprovalStep',
    'LeaveApprovalAction',
    'PublicHoliday',
  ],
  time: [
    'ShiftTemplate',
    'RotaPeriod',
    'ShiftAssignment',
    'AttendancePolicy',
    'AttendancePolicyAssignment',
    'AttendanceEvent',
    'AttendanceDaySummary',
    'AttendanceException',
    'BiometricDevice',
    'BiometricPunch',
    'Attendance',
  ],
  payroll: ['Payroll', 'StatutoryReturn', 'StatutoryReturnItem', 'PayrollDisbursementBatch', 'PayrollDisbursementLine'],
  ats: [
    'Job',
    'Candidate',
    'Application',
    'ApplicationView',
    'Interview',
    'InterviewScheduleBreak',
    'InterviewScorecard',
    'JobRequisitionApproval',
    'JobOfferApproval',
    'ApplicationHireConversion',
    'RecruitmentSettings',
    'Client',
    'RecruitmentClientPortalUser',
  ],
  performance: [
    'PerformanceCycle',
    'PerformanceGoal',
    'PerformanceReview',
    'PerformanceReviewRating',
    'PerformanceFeedback',
  ],
  hse: [],
  accounts: [
    'AccountsClient',
    'AccountsInvoice',
    'AccountsVendor',
    'AccountsVendorBill',
    'ExpenseClaim',
    'Budget',
    'PettyCashFund',
    'ChartOfAccount',
    'GeneralLedgerEntry',
  ],
  disciplinary: ['DisciplinaryCase', 'DisciplinaryAction', 'DisciplinaryDocument', 'Grievance'],
  reports: ['AuditEvent'],
  assets: ['CompanyAsset'],
  fleet: [
    'FleetVehicle',
    'FleetDriver',
    'FleetTrip',
    'FleetSettlement',
    'FleetIncident',
    'FleetOrder',
  ],
  ess: ['EssPortalUser', 'StaffNotification'],
  communications: ['Announcement', 'NotificationPolicy', 'NotificationDelivery', 'WorkflowRun'],
  training: ['TrainingProgram', 'TrainingEnrollment', 'TrainingMaterial'],
  documents: ['CompanyDocument'],
  procurement: ['PurchaseRequest', 'PurchaseRequestLine'],
  legal: ['EmployeeCredential', 'CompanyDocument', 'AccountsContract'],
};

/** Human-maintained migration status — update when a module clears the gate. */
export const MODULE_MIGRATION_TRACKING: ModuleMigrationRecord[] = MODULE_DEFINITIONS.map(
  (def) => {
    const base: ModuleMigrationRecord = {
      module: def.key,
      label: def.label,
      phase: 'schema-ready',
      productPhase: def.phase === 1 ? 'A' : def.phase === 2 ? 'A–B' : 'C–E',
      prismaModels: MODULE_PRISMA_MODELS[def.key],
    };

    if (def.key === 'payroll') {
      return {
        ...base,
        phase: 'routes-partial',
        notes: 'M-Pesa sandbox disbursement + bank export; migrate remaining payroll API routes to withTenant().',
      };
    }

    if (def.key === 'core') {
      return {
        ...base,
        phase: 'routes-partial',
        notes: 'Exemplar: outsourcing/employees + dashboard/bootstrap use withTenant().',
      };
    }

    if (def.key === 'performance') {
      return {
        ...base,
        phase: 'routes-partial',
        notes: 'Real cycles/reviews APIs + dashboard/ESS UI; migrate remaining legacy routes.',
      };
    }

    if (def.key === 'hse') {
      return {
        ...base,
        phase: 'not-started',
        notes: 'Mock UI or thin API — migrate when real module lands (Phase E).',
      };
    }

    return base;
  },
);

export function migrationRecordFor(module: ModuleKey): ModuleMigrationRecord | undefined {
  return MODULE_MIGRATION_TRACKING.find((r) => r.module === module);
}
