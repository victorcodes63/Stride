'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { JsonLd } from '@/components/marketing/JsonLd';
import { faqPageJsonLd } from '@/lib/marketing-schema';
import { PRICING_FAQ, contactHref } from '@/lib/pricing';

export function PricingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      className="mt-20 grid gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-14"
      aria-labelledby="pricing-faq-heading"
    >
      <JsonLd data={faqPageJsonLd(PRICING_FAQ)} />
      <div className="text-center lg:sticky lg:top-28 lg:self-start lg:text-left">
        <h2
          id="pricing-faq-heading"
          className="font-heading text-[clamp(1.5rem,4vw,2rem)] font-extrabold leading-tight tracking-[-0.02em] text-pub-ink"
        >
          Pricing questions
        </h2>
        <p className="mx-auto mt-3 max-w-[30rem] text-sm leading-relaxed text-pub-ink-muted lg:mx-0">
          How billing works, what the free payroll run covers, and what happens as your team grows.
        </p>
        <p className="mt-5 text-sm text-pub-ink-muted">
          Still unsure?{' '}
          <Link
            href={contactHref()}
            className="font-semibold text-[var(--pub-primary)] underline-offset-4 hover:underline"
          >
            Talk to us
          </Link>
        </p>
      </div>

      <div className="min-w-0 rounded-[20px] border border-pub-border bg-white px-5 sm:px-8">
        {PRICING_FAQ.map((item, index) => {
          const open = openIndex === index;
          const panelId = `pricing-faq-panel-${index}`;

          return (
            <div key={item.question} className="border-b border-pub-border last:border-b-0">
              <button
                type="button"
                className="marketing-accordion-trigger flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pub-primary)]/30 focus-visible:ring-offset-2"
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
                <p id={panelId} className="-mt-1 max-w-[42rem] pb-5 text-sm leading-relaxed text-pub-ink-muted">
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
