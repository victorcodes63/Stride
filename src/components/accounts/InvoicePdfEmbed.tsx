'use client';

type Props = {
  pdfUrl: string;
  title?: string;
  className?: string;
};

/** Inline PDF viewer — same output as download/print routes. */
export function InvoicePdfEmbed({ pdfUrl, title = 'Invoice PDF', className = '' }: Props) {
  return (
    <section className={`dashboard-surface shadow-sm overflow-hidden flex flex-col min-h-0 ${className}`}>
      <div className="border-b border-neutral-200/80 px-4 py-3 shrink-0">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Generated PDF — matches download and print.</p>
      </div>
      <iframe
        src={pdfUrl}
        title={title}
        className="w-full flex-1 min-h-[min(72vh,880px)] bg-neutral-100 border-0"
      />
    </section>
  );
}
