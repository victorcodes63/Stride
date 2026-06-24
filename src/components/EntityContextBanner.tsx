'use client';

import { useEntity } from '@/components/EntitySwitcher';
import useEntityConfig from '@/hooks/useEntityConfig';

export function EntityContextBanner() {
  const { activeEntity } = useEntity();
  const config = useEntityConfig();
  return (
    <div
      data-marketing-screenshot-hide
      className="text-xs text-neutral-400 flex flex-wrap items-center gap-1.5 mt-1"
    >
      <span className="font-medium text-neutral-500">{activeEntity.name}</span>
      <span className="text-neutral-400">·</span>
      <span>{config.currency.code}</span>
      <span className="text-neutral-400">·</span>
      <span>{config.payroll.taxAuthority} jurisdiction</span>
    </div>
  );
}
