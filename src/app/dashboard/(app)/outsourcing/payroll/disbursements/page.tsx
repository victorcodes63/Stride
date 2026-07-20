import { DisbursementsWorkspace } from '@/components/payroll/DisbursementsWorkspace';
import { OUTSOURCING_PAYROLL_SURFACE } from '@/lib/payroll-surface';

export default function OutsourcingPayrollDisbursementsPage() {
  return <DisbursementsWorkspace config={OUTSOURCING_PAYROLL_SURFACE} />;
}
