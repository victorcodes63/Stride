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
    'Project',
    'ProjectMilestone',
    'ProjectTask',
    'FacilitySite',
    'FacilityLease',
    'FacilityMaintenanceTicket',
    'GovernanceMeeting',
    'GovernanceResolution',
    'GovernanceActionItem',
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
    'JdDivision',
    'JobDescription',
    'JobKRA',
    'JobKPI',
    'JobCompetency',
    'JdDocument',
    'JdParserConfig',
    'ScorecardTemplate',
    'ScorecardPerspective',
    'ScorecardMeasure',
    'CompetencyRequirement',
    'CompetencyFramework',
    'CompetencyFrameworkEntry',
    'PerformanceObjective',
    'PerformancePip',
    'PerformanceRater',
    'PerformanceCycle',
    'PerformanceGoal',
    'PerformanceReview',
    'PerformanceReviewRating',
    'PerformanceFeedback',
  ],
  hse: ['HseIncident', 'HseAction'],
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
    'FleetTransportPartner',
    'FleetFuelLog',
    'FleetMaintenanceLog',
    'FleetTrip',
    'FleetSettlement',
    'FleetIncident',
    'FleetOrder',
  ],
  sacco: ['SaccoMember', 'SaccoAccount', 'SaccoLedgerEntry', 'SaccoDividendRun', 'SaccoDividendLine'],
  healthcare: ['HealthcareWard', 'HealthcareClinicalAssignment'],
  energy: ['EnergySite', 'EnergyPermit'],
  construction: ['ConstructionSite', 'ConstructionPlantAsset', 'ConstructionSubcontractor'],
  ess: ['EssPortalUser', 'StaffNotification'],
  communications: ['Announcement', 'NotificationPolicy', 'NotificationDelivery', 'WorkflowRun'],
  training: ['TrainingProgram', 'TrainingEnrollment', 'TrainingMaterial'],
  documents: ['CompanyDocument'],
  procurement: ['PurchaseRequest', 'PurchaseRequestLine'],
  legal: ['EmployeeCredential', 'CompanyDocument', 'AccountsContract'],
  sales: [
    'SalesTarget',
    'SalesDeal',
    'SalesActual',
    'SalesRepPeriodMetric',
    'SalesCommissionRule',
  ],
  assessments: [
    'AssessmentTemplate',
    'AssessmentQuestion',
    'JobAssessmentAssignment',
    'ApplicationAssessmentAttempt',
    'ApplicationAssessmentAnswer',
  ],
  projects: ['Project', 'ProjectMilestone', 'ProjectTask'],
  operations: ['CompanyAsset', 'HseIncident', 'Announcement'],
  outsourcing: ['OutsourcingClient', 'OutsourcingRateCard', 'OutsourcingRateCardLine', 'Employee', 'Department'],
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

    if (def.key === 'fleet') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes:
          'FLT-00 verified: full schema (Vehicle/Driver/Partner/Order/Trip/Compliance/POD/Settlement/Incident), lifecycle in fleet-status.ts, all /api/fleet/* use withFleetTenant.',
      };
    }

    if (def.key === 'outsourcing') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes:
          'OUT-01: 12 dashboard pages and 27 API routes under /outsourcing; clients, workforce, payroll, attendance, and leave use withTenant().',
      };
    }

    if (def.key === 'payroll') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'All outsourcing/payroll and payroll/statutory API routes use withTenant() + RLS.',
      };
    }

    if (def.key === 'reports') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'All /api/reports/* routes use withTenant() + org-scoped queries (ISO-03).',
      };
    }

    if (def.key === 'core') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes:
          'All core staff API routes use withTenant(); ESS portal routes use withEssTenant() (ISO-04).',
      };
    }

    if (def.key === 'performance') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes:
          'PERF-01→08: BSC JD/scorecard/cycles, builtin+registered KPI providers, AI eval assist (consent-gated), competency framework, objective cascade, PIP/360; all APIs use withTenant() + RLS.',
      };
    }

    if (def.key === 'leave') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Staff leave, outsourcing leave, and ESS leave routes use withTenant/withEssTenant (ISO-04).',
      };
    }

    if (def.key === 'time') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Rota, biometric, attendance, and ESS clock/rota routes use withTenant/withEssTenant (ISO-04).',
      };
    }

    if (def.key === 'ats') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Staff ATS routes use withTenant(); public careers paths use withOrgContext from job org (ISO-04).',
      };
    }

    if (def.key === 'hse') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Staff HSE + ESS reporting routes use withTenant/withEssTenant (ISO-04).',
      };
    }

    if (def.key === 'disciplinary') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Staff + ESS disciplinary/grievance routes use withTenant/withEssTenant (ISO-04).',
      };
    }

    if (def.key === 'procurement') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'All procurement staff + ESS purchase-request routes tenant-scoped (ISO-04).',
      };
    }

    if (def.key === 'legal') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Legal obligations API uses withTenant() (ISO-04).',
      };
    }

    if (def.key === 'documents') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Company documents API uses withTenant() (ISO-04).',
      };
    }

    if (def.key === 'communications') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Announcements API uses withTenant() (ISO-04).',
      };
    }

    if (def.key === 'training') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'Training programs API uses withTenant() (ISO-04).',
      };
    }

    if (def.key === 'sales') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'All /api/sales/* routes use withTenant(); won revenue sources Finance invoices when linked (SALES-02).',
      };
    }

    if (def.key === 'sacco') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'All /api/sacco/* routes use withTenant() (ISO-04).',
      };
    }

    if (def.key === 'healthcare') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'All /api/healthcare/* routes use withTenant() (ISO-04).',
      };
    }

    if (def.key === 'energy') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'All /api/energy/* routes use withTenant() (ISO-04).',
      };
    }

    if (def.key === 'construction') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'All /api/construction/* routes use withTenant() (ISO-04).',
      };
    }

    if (def.key === 'ess') {
      return {
        ...base,
        phase: 'tenant-safe',
        notes: 'ESS shell routes (home, profile, notifications, etc.) use withEssTenant() (ISO-04).',
      };
    }

    return base;
  },
);

export function migrationRecordFor(module: ModuleKey): ModuleMigrationRecord | undefined {
  return MODULE_MIGRATION_TRACKING.find((r) => r.module === module);
}
