import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow';
import { MarketingReveal } from '@/components/marketing/MarketingReveal';

const STATS = [
  {
    value: '6',
    label: 'Business functions in one platform — HR, Finance, Procurement, Legal, Projects, Admin',
  },
  {
    value: 'Day 1',
    label: 'KRA, NSSF and SHIF compliance out of the box — zero configuration required',
  },
  {
    value: '1',
    label: 'Login for every team member, every module, every entity you run',
  },
] as const;

export function MarketingWhySection() {
  return (
    <section className="pub-on-ink bg-pub-ink px-6 py-[80px] sm:px-10 lg:py-[120px]">
      <div className="mx-auto grid max-w-[1120px] items-center gap-16 lg:grid-cols-2 lg:gap-[90px]">
        <div>
          <MarketingReveal>
            <MarketingEyebrow tone="dark">Why Stride</MarketingEyebrow>
          </MarketingReveal>
          <MarketingReveal delay={0.08}>
            <h2 className="font-heading text-[clamp(2rem,4vw,3.25rem)] font-extrabold leading-[1.06] tracking-[-1.5px] text-[#FBF8F4]">
              Built for
              <br />
              <span className="text-[var(--pub-primary)]">East Africa.</span>
              <br />
              Not adapted for it.
            </h2>
          </MarketingReveal>
          <MarketingReveal delay={0.16}>
            <p className="mt-[18px] max-w-[540px] text-[17px] leading-relaxed text-[#F0EFE9]/65">
              Global ERPs were designed for other markets and retrofitted for Kenya. Stride is built
              from the ground up —{' '}
              <strong className="font-semibold text-pub-surface">
                M-Pesa disbursements, KRA compliance, multi-entity SACCO structures and East African
                payroll logic
              </strong>{' '}
              are first-class features, not afterthoughts.
            </p>
            <div className="my-7 h-[3px] w-12 skew-x-[-14deg] rounded bg-[var(--pub-primary)]" />
            <p className="max-w-[540px] text-[17px] leading-relaxed text-[#F0EFE9]/65">
              A 12-person consultancy and a 300-staff SACCO pay for exactly what they use. No
              enterprise sales cycle. No six-month rollout.
            </p>
          </MarketingReveal>
        </div>

        <div className="flex flex-col gap-[30px]">
          {STATS.map((stat, i) => (
            <MarketingReveal key={stat.value} delay={0.1 + i * 0.08}>
              <div className="border-l-2 border-[var(--pub-primary)] pl-[22px]">
                <p className="font-heading text-[54px] font-extrabold leading-none tracking-[-2px] text-[var(--pub-primary)]">
                  {stat.value}
                </p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#F0EFE9]/65">{stat.label}</p>
              </div>
            </MarketingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
