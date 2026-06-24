import type { ReactNode } from 'react';

type MarketingPageBodyProps = {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
};

export function MarketingPageBody({
  children,
  className = '',
  narrow = false,
}: MarketingPageBodyProps) {
  return (
    <div
      className={`mx-auto min-w-0 px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12 ${narrow ? 'max-w-[720px]' : 'max-w-[1100px]'} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
