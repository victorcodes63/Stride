import { MarketingScreenshotFrame } from '@/components/marketing/mockups/IndustryWireframePreview';
import { StatutoryWireframe } from '@/components/marketing/mockups/StatutoryWireframe';

type WhyStrideStatutoryVisualProps = {
  className?: string;
};

/** Statutory compliance wireframe — SwiftFreight demo data, no live screenshot. */
export function WhyStrideStatutoryVisual({ className = '' }: WhyStrideStatutoryVisualProps) {
  return (
    <div className={`relative mx-auto w-full max-w-[1024px] ${className}`.trim()}>
      <MarketingScreenshotFrame
        moduleLabel="Payroll (Kenya)"
        screenTitle="Statutory compliance"
        path="/payroll/statutory"
        className="h-full min-h-[280px] sm:min-h-[320px]"
      >
        <StatutoryWireframe className="h-full p-2" />
      </MarketingScreenshotFrame>
    </div>
  );
}
