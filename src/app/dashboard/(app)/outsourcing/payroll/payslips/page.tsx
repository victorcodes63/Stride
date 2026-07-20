import { PayslipsWorkspace } from '@/components/payroll/PayslipsWorkspace';
import { OUTSOURCING_PAYROLL_SURFACE } from '@/lib/payroll-surface';

export default function OutsourcingPayslipsPage() {
  return <PayslipsWorkspace config={OUTSOURCING_PAYROLL_SURFACE} />;
}
