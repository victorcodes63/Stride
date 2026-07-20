'use client';

import { Suspense } from 'react';
import { StaffAttendanceClient } from '@/components/dashboard/staff-attendance/StaffAttendanceClient';

export default function StaffAttendancePage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />}>
      <StaffAttendanceClient />
    </Suspense>
  );
}
