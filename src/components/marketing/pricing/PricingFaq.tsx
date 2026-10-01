'use client';

import { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { JsonLd } from '@/components/marketing/JsonLd';
import { faqPageJsonLd } from '@/lib/marketing-schema';
import { PRICING_FAQ } from '@/lib/pricing';

export function PricingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mt-16" aria-labelledby="pricing-faq-heading">
      <JsonLd data={faqPageJsonLd(PRICING_FAQ)} />
      <div className="text-center">
        <h2
          id="pricing-faq-heading"
          className="font-heading text-[clamp(1.5rem,4vw,2rem)] font-extrabold tracking-[-0.02em] text-pub-ink"
        >
          Pricing questions
        </h2>
      </div>

      <div className="mx-auto mt-8 max-w-[46rem] rounded-[20px] border border-pub-border bg-white px-4 sm:px-6">
        {PRICING_FAQ.map((item, index) => {
          const open = openIndex === index;
          const panelId = `pricing-faq-panel-${index}`;

          return (
            <div key={item.question} className="border-b border-pub-border last:border-b-0">
              <button
                type="button"
                className="marketing-accordion-trigger flex w-full items-center justify-between gap-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pub-primary)]/30 focus-visible:ring-offset-2"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span className="font-heading text-sm font-bold text-pub-ink sm:text-base">
                  {item.question}
                </span>
                <CaretDown
                  size={16}
                  weight="bold"
                  className={`shrink-0 text-pub-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
              {open ? (
                <p id={panelId} className="pb-4 text-sm leading-relaxed text-pub-ink-muted">
                  {item.answer}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
