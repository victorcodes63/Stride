import { MarketingFooter } from '@/components/marketing/MarketingFooter';
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
      <MarketingStickyScrollFix />
      <div className="[--nav-h:5.25rem] sm:[--nav-h:5.75rem]">
        <header className="marketing-fixed-header fixed inset-x-0 top-0 z-[100] pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:pt-3">
          <StudioCraftNav />
        </header>
        <main className={navOverlay ? 'min-w-0' : 'min-w-0 pt-[var(--nav-h)]'}>{children}</main>
        <MarketingFooter />
      </div>
    </StudioCraftShell>
  );
}
