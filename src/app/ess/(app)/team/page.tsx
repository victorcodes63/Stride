'use client';

import { useEffect, useState } from 'react';
import { ESS_TEAM_HUB_TILES } from '@/lib/ess-nav-catalog';
import { EssHubPage } from '@/components/ess/EssHubPage';
import { useEssApp } from '@/contexts/EssAppContext';
import { useRouter } from 'next/navigation';

export default function EssTeamHubPage() {
  const router = useRouter();
  const { showTeamTab, meLoading } = useEssApp();
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (meLoading) return;
    if (!showTeamTab) {
      router.replace('/ess');
      return;
    }
    fetch('/api/ess/team/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setBadges({
            teamLeavePending: data.leavePending ?? 0,
            teamAttendancePending: data.attendancePending ?? 0,
          });
        }
      })
      .catch(() => {});
  }, [showTeamTab, meLoading, router]);

  if (!showTeamTab && !meLoading) return null;

  return (
    <EssHubPage
      title="Team"
      subtitle="Approvals and team visibility"
      tiles={ESS_TEAM_HUB_TILES.map((t) => ({
        ...t,
        badgeKey: t.badgeKey,
      }))}
      badges={badges}
    />
  );
}
