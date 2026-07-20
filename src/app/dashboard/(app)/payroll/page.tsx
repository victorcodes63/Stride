import { PayrollWorkspace } from '@/components/payroll/PayrollWorkspace';
import { INTERNAL_PAYROLL_SURFACE } from '@/lib/payroll-surface';

export default function PayrollPage() {
  return <PayrollWorkspace config={INTERNAL_PAYROLL_SURFACE} />;
}
