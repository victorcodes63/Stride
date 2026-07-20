import { StaffRotaPlanner } from '@/components/dashboard/staff-rota/StaffRotaPlanner';

export const dynamic = 'force-dynamic';

/**
 * Tenant-own (internal staff) rota & scheduling.
 *
 * Subjects are the organization's own staff Users (via OrganizationMembership),
 * distinct from the outsourcing rota (/dashboard/outsourcing/rota) which is
 * keyed on Employee + OutsourcingClient.
 */
export default function RotaPage() {
  return <StaffRotaPlanner />;
}
