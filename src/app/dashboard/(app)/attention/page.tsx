'use client';

import { Suspense } from 'react';
import { ActionCenterPage } from '@/components/dashboard/attention/ActionCenterPage';
import { DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

export default function AttentionRoutePage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <ActionCenterPage />
    </Suspense>
  );
}
