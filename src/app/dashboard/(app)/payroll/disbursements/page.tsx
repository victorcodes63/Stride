import { DisbursementsContent } from './DisbursementsContent';

export default function PayrollDisbursementsPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />}>
      <DisbursementsContent />
    </Suspense>
  );
}
