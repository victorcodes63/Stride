import { DisbursementsWorkspace } from '@/components/payroll/DisbursementsWorkspace';
import { INTERNAL_PAYROLL_SURFACE } from '@/lib/payroll-surface';

export default function PayrollDisbursementsPage() {
  return <DisbursementsWorkspace config={INTERNAL_PAYROLL_SURFACE} />;
}
