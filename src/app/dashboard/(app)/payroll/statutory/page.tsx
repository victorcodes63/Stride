import { StatutoryWorkspace } from '@/components/payroll/StatutoryWorkspace';
import { INTERNAL_PAYROLL_SURFACE } from '@/lib/payroll-surface';

export default function PayrollStatutoryPage() {
  return <StatutoryWorkspace config={INTERNAL_PAYROLL_SURFACE} />;
}
