'use client';

import { PlatformArchitectureSection } from '@/components/marketing/platform/PlatformArchitectureSection';

/** Shared architecture section — industries + platform use the same sticky card stack. */
export function CoreVerticalPacks({ leadSection = false }: { leadSection?: boolean }) {
  return <PlatformArchitectureSection leadSection={leadSection} />;
}
