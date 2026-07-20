import { StatutoryWorkspace } from '@/components/payroll/StatutoryWorkspace';
import { OUTSOURCING_PAYROLL_SURFACE } from '@/lib/payroll-surface';

export default function OutsourcingPayrollStatutoryPage() {
  return <StatutoryWorkspace config={OUTSOURCING_PAYROLL_SURFACE} />;
}
