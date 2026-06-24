import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';

type PublicPageLayoutProps = {
  children: React.ReactNode;
  showFooter?: boolean;
};

/** Stride public chrome — dark ink nav/footer on careers, legal, and tenant-facing pages. */
export default function PublicPageLayout({ children, showFooter = true }: PublicPageLayoutProps) {
  return (
    <>
      <MarketingNav />
      <div className="pt-[var(--nav-h,4.25rem)]">{children}</div>
      {showFooter ? <MarketingFooter /> : null}
    </>
  );
}
