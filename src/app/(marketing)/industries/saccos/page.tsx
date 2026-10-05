import { IndustrySectorPage } from '@/components/marketing/industries/IndustrySectorPage';
import { ProductIndustryPreview } from '@/components/marketing/product/ProductIndustryPreview';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata = marketingMetadata({
  title: 'SACCOs',
  description:
    'Member ledger, BOSA/FOSA operations, dividend runs, and SASRA-aligned reporting for regulated Kenyan SACCOs.',
  path: '/industries/saccos',
});

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
    <IndustrySectorPage
      sectorId="saccos"
      name="SACCOs"
      path="/industries/saccos"
      title="Member-trusted operations on the Stride core."
      description="Built for regulated SACCOs that need modern member servicing, dividend workflows, and board-ready SASRA reporting without a multi-year core replacement."
      visual={<ProductIndustryPreview industryId="saccos" />}
      features={FEATURES}
      faq={SACCO_FAQ}
      cta={{
        title: 'See Stride for SACCOs',
        description: 'Book a walkthrough of the member ledger, dividend run, and SASRA reporting on the Stride core.',
      }}
    />
  );
}
