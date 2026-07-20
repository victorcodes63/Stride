import { PayrollWorkspace } from '@/components/payroll/PayrollWorkspace';
import { OUTSOURCING_PAYROLL_SURFACE } from '@/lib/payroll-surface';

export default function OutsourcingPayrollPage() {
  return <PayrollWorkspace config={OUTSOURCING_PAYROLL_SURFACE} />;
}
