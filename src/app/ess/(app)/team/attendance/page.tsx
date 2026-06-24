'use client';

import { EssPageHeader } from '@/components/ess/EssPageHeader';

export default function EssTeamAttendancePage() {
  return (
    <div>
      <EssPageHeader
        title="Attendance exceptions"
        subtitle="Team attendance reviews"
        backHref="/ess/team"
      />
      <p className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-600">
        Team attendance exception reviews will appear here when pending items are assigned to you.
      </p>
    </div>
  );
}
