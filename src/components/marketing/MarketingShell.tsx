import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingAnalytics } from '@/components/marketing/MarketingAnalytics';
import { MarketingLenis } from '@/components/marketing/MarketingLenis';
import { MarketingStickyScrollFix } from '@/components/marketing/MarketingStickyScrollFix';
import { StudioCraftNav } from '@/components/marketing/v3/StudioCraftNav';
import { StudioCraftShell } from '@/components/marketing/v3/StudioCraftShell';

type MarketingShellProps = {
  children: React.ReactNode;
  /** Homepage: nav pill floats over the hero — no reserved band below the header. */
  navOverlay?: boolean;
};

/** Inner marketing routes — same studio-craft nav as the homepage. */
export function MarketingShell({ children, navOverlay = false }: MarketingShellProps) {
  return (
    <StudioCraftShell>
      <MarketingLenis>
        <MarketingAnalytics />
        <MarketingStickyScrollFix />
        <div className="[--nav-h:4.5rem] sm:[--nav-h:5rem]">
          <header className="marketing-fixed-header fixed inset-x-0 top-0 z-[100] pt-[env(safe-area-inset-top,0px)]">
            <StudioCraftNav overHero={navOverlay} />
          </header>
          <main
            className={
              navOverlay
                ? 'marketing-main min-w-0 overflow-x-clip'
                : 'marketing-main min-w-0 overflow-x-clip pt-[var(--nav-h)]'
            }
          >
            {children}
          </main>
          <MarketingFooter />
        </div>
      </MarketingLenis>
    </StudioCraftShell>
  );
}
