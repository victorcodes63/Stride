'use client';

import type { ReactNode } from 'react';
import { OverviewPinButton } from '@/components/dashboard/overview/OverviewPinButton';
import { useDashboardOverviewLayout } from '@/contexts/dashboard-overview-layout';
import type { OverviewWidgetId } from '@/lib/dashboard-overview-preferences';

type Props = {
  widgetId: OverviewWidgetId;
  title: string;
  description?: ReactNode;
  trailing?: ReactNode;
};

export function OverviewWidgetHeader({ widgetId, title, description, trailing }: Props) {
  const { isWidgetPinned, toggleWidgetPin } = useDashboardOverviewLayout();

  return (
    <div className="dashboard-panel-header group/pin-target flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">{title}</h2>
        {description ? (
          <div className="mt-0.5 text-xs text-[var(--dash-text-muted)]">{description}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <OverviewPinButton
          isPinned={isWidgetPinned(widgetId)}
          label={title}
          onToggle={() => void toggleWidgetPin(widgetId)}
        />
      </div>
    </div>
  );
}
