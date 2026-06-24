'use client';

import { ESS_WORK_HUB_TILES } from '@/lib/ess-nav-catalog';
import { EssHubPage } from '@/components/ess/EssHubPage';

export default function EssWorkHubPage() {
  return (
    <EssHubPage
      title="Work"
      subtitle="Leave, time, rota, and onboarding"
      tiles={ESS_WORK_HUB_TILES}
    />
  );
}
