import { registerAttentionContributor } from '@/lib/dashboard-attention/registry';
import { adminOperationsAttentionContributor } from '@/lib/dashboard-attention/contributors/admin-operations';
import { financeAttentionContributor } from '@/lib/dashboard-attention/contributors/finance';
import { fleetLogisticsAttentionContributor } from '@/lib/dashboard-attention/contributors/fleet-logistics';
import { hrOutsourcingAttentionContributor } from '@/lib/dashboard-attention/contributors/hr-outsourcing';
import { hrPayrollAttentionContributor } from '@/lib/dashboard-attention/contributors/hr-payroll';
import { legalDocumentsAttentionContributor } from '@/lib/dashboard-attention/contributors/legal-documents';
import { platformAdminAttentionContributor } from '@/lib/dashboard-attention/contributors/platform-admin';
import { procurementAttentionContributor } from '@/lib/dashboard-attention/contributors/procurement';
import { projectsAttentionContributor } from '@/lib/dashboard-attention/contributors/projects';
import { salesAttentionContributor } from '@/lib/dashboard-attention/contributors/sales';

/** Idempotent — re-registering replaces the same domainId (HMR-safe). */
export function ensureAttentionContributorsRegistered(): void {
  // One contributor per product domain (order = collection order).
  registerAttentionContributor(hrPayrollAttentionContributor);
  registerAttentionContributor(financeAttentionContributor);
  registerAttentionContributor(procurementAttentionContributor);
  registerAttentionContributor(salesAttentionContributor);
  registerAttentionContributor(fleetLogisticsAttentionContributor);
  registerAttentionContributor(legalDocumentsAttentionContributor);
  registerAttentionContributor(projectsAttentionContributor);
  registerAttentionContributor(hrOutsourcingAttentionContributor);
  registerAttentionContributor(adminOperationsAttentionContributor);
  registerAttentionContributor(platformAdminAttentionContributor);
}
