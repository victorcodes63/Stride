import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';
import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';

export const metadata = {
  title: 'SACCOs',
  description:
    'Member ledger, BOSA/FOSA operations, dividend runs, and SASRA-aligned reporting for regulated Kenyan SACCOs.',
};

const FEATURES = [
  {
    title: 'Member register',
    body: 'Member numbers, share capital, BOSA and FOSA balances on one tenant-safe ledger.',
  },
  {
    title: 'Dividend runs',
    body: 'Calculate from share balances, approve with the board, then post credits to member accounts.',
  },
  {
    title: 'BOSA / FOSA ledger',
    body: 'Post contributions, withdrawals, and interest with a full audit trail per account.',
  },
  {
    title: 'SASRA templates',
    body: 'Quarterly summary, membership register, and loan classification extracts for compliance workflows.',
  },
] as const;

const SACCO_FAQ = [
  {
    q: 'Does this replace our SACCO core banking system?',
    a: 'Stride covers workforce, payroll, finance, and the member ledger layer for regulated cooperatives. Deep credit/loan origination remains a follow-on module.',
  },
  {
    q: 'Is M-Pesa supported?',
    a: 'Yes — the horizontal finance module supports M-Pesa reconciliation alongside payroll disbursements.',
  },
  {
    q: 'Can we demo with Heritage Members SACCO?',
    a: 'Yes. The imara-sacco demo pack seeds members, balances, and an approved Q2 dividend run.',
  },
] as const;

export default function SaccosIndustryPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="SACCOs"
        title="Member-trusted operations on the Stride core."
        description="Built for regulated SACCOs that need modern member servicing, dividend workflows, and board-ready SASRA reporting without a multi-year core replacement."
        visual={<IndustryWireframePreview industryId="saccos" />}
      />

      <MarketingPageBody>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-2xl border border-pub-border bg-white p-5 sm:p-6">
              <h2 className="font-heading text-lg font-bold text-pub-ink">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-pub-ink-muted">{f.body}</p>
            </article>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="font-heading text-2xl font-bold text-pub-ink">SACCO FAQ</h2>
          <div className="mt-6 divide-y divide-pub-border rounded-2xl border border-pub-border bg-white">
            {SACCO_FAQ.map((item) => (
              <div key={item.q} className="px-6 py-5">
                <h3 className="font-heading font-semibold text-pub-ink">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pub-ink-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </MarketingPageBody>

      <MarketingCtaBand
        title="See Stride for SACCOs"
        description="Book a walkthrough of the member ledger, dividend run, and SASRA reporting on the Stride core."
        primary={{ href: '/contact', label: 'Book a demo' }}
        secondary={{ href: '/pricing', label: 'View pricing' }}
        variant="coral"
      />
    </>
  );
}
