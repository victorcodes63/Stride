import { PayslipsWorkspace } from '@/components/payroll/PayslipsWorkspace';
import { INTERNAL_PAYROLL_SURFACE } from '@/lib/payroll-surface';

export default function PayrollPayslipsPage() {
  return <PayslipsWorkspace config={INTERNAL_PAYROLL_SURFACE} />;
}
