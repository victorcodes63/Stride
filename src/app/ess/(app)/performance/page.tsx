'use client';

import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssEmptyState } from '@/components/ess/EssUi';

export default function EssPerformancePage() {
  return (
    <div>
      <EssPageHeader title="Performance" subtitle="Goals and reviews" backHref="/ess/more" />
      <EssEmptyState
        title="No active review cycle"
        message="When your organisation runs a review cycle, your goals and self-assessment will appear here."
      />
    </div>
  );
}
