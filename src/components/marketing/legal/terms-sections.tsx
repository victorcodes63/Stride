import Link from 'next/link';

import type { LegalSection } from '@/components/marketing/legal/legal-types';
import { brandConfig } from '@/lib/brand.config';
import { getMarketingPageUrl, MARKETING_SALES_EMAIL } from '@/lib/marketing-config';

const LEGAL_LAST_UPDATED = '2026-06-27';

export const TERMS_LAST_UPDATED = LEGAL_LAST_UPDATED;

export function getTermsSections(): LegalSection[] {
  const privacyUrl = getMarketingPageUrl('/privacy');

  return [
    {
      id: 'agreement',
      title: 'Agreement and acceptance',
      content: (
        <>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the Stride operations platform
            and related services provided by <strong>{brandConfig.companyLegal}</strong> (&ldquo;Stride&rdquo;,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account, clicking to accept, or using the services,
            the organisation you represent (&ldquo;Customer&rdquo;, &ldquo;you&rdquo;) agrees to these Terms.
          </p>
          <p>
            If you use Stride on behalf of an organisation, you represent that you have authority to bind that
            organisation. Individual users (employees, administrators) access the platform under their
            employer&rsquo;s subscription and acceptable use rules.
          </p>
          <p>
            These Terms incorporate our <Link href={privacyUrl}>Privacy Policy</Link> and any order form, statement
            of work, or enterprise agreement signed with Stride. In case of conflict, a signed enterprise agreement
            prevails over these Terms for that Customer.
          </p>
        </>
      ),
    },
    {
      id: 'service',
      title: 'The service',
      content: (
        <>
          <p>
            Stride is a cloud-based, multi-tenant software platform for East African businesses. Depending on your
            subscription, modules may include HR &amp; payroll, finance, procurement, legal, projects, employee
            self-service (ESS), and industry vertical packs (for example logistics, SACCOs, healthcare, construction).
          </p>
          <p>
            We may update features, user interfaces, and underlying infrastructure to improve security, compliance,
            and performance. Material reductions to subscribed modules will not apply during a paid term without
            notice, except where required for legal or security reasons.
          </p>
          <p>
            Demo and sandbox environments are provided for evaluation only, may contain sample data, and are not
            covered by production SLAs unless expressly agreed.
          </p>
        </>
      ),
    },
    {
      id: 'subscription',
      title: 'Subscription, tiers, and billing',
      content: (
        <>
          <p>
            Stride is offered on recurring subscription tiers — typically <strong>Starter</strong>,{' '}
            <strong>Growth</strong>, and <strong>Enterprise</strong> — priced in Kenyan shillings (KES) unless
            otherwise stated on your order form. Current list pricing and included modules are published at{' '}
            <Link href="/pricing">getstride.co.ke/pricing</Link>.
          </p>
          <h3>Billing via Paystack</h3>
          <p>
            Subscription fees are billed in advance (monthly or annually as selected) through{' '}
            <strong>Paystack</strong>. By subscribing, you authorise recurring charges to your designated payment
            method until cancellation. Failed payments may result in grace-period reminders and, if unresolved,
            read-only or suspended access as described below.
          </p>
          <h3>Seat bands and headcount</h3>
          <ul>
            <li>
              <strong>Starter</strong> — up to 25 active employees unless otherwise specified on your order.
            </li>
            <li>
              <strong>Growth</strong> — up to 100 active employees with additional modules and multi-entity support.
            </li>
            <li>
              <strong>Enterprise</strong> — custom headcount, modules, and rollout terms.
            </li>
          </ul>
          <p>
            &ldquo;Active employees&rdquo; means individuals with a live profile in your tenant who count toward
            your plan limit. Exceeding your band may require upgrade or purchase of additional seats; we will
            notify account administrators before enforcing limits.
          </p>
          <h3>Add-ons</h3>
          <p>
            Optional modules (for example advanced payroll, fleet, vertical packs) and implementation services may
            be purchased as add-ons. Add-on fees are billed according to your order form or in-app upgrade flow and
            renew with your base subscription unless cancelled.
          </p>
          <p>
            Fees are exclusive of VAT and applicable withholding taxes unless stated otherwise. You are responsible
            for any taxes due on your purchase other than taxes based on Stride&rsquo;s net income.
          </p>
        </>
      ),
    },
    {
      id: 'renewals',
      title: 'Renewals and changes to plans',
      content: (
        <>
          <p>
            Subscriptions renew automatically at the end of each billing period for the same term unless you cancel
            before the renewal date through your billing settings or by written notice to{' '}
            <a href={`mailto:${MARKETING_SALES_EMAIL}`}>{MARKETING_SALES_EMAIL}</a>.
          </p>
          <p>
            We may change list prices or packaging for new customers at any time. Price changes for existing
            customers take effect at the next renewal after at least thirty (30) days&rsquo; notice. Downgrades
            take effect at the next renewal and may require reduction of active employees or modules to fit the
            selected tier.
          </p>
          <p>
            Upgrades (tier, seats, or add-ons) may be applied immediately with pro-rated charges for the remainder
            of the current billing period.
          </p>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      content: (
        <>
          <p>You agree not to, and not to permit users to:</p>
          <ul>
            <li>Use Stride in violation of applicable law, including employment, tax, and data protection regulations</li>
            <li>Upload unlawful, defamatory, or infringing content, or content you do not have rights to process</li>
            <li>Attempt to bypass security, access another tenant&rsquo;s data, or probe or scan systems without authorisation</li>
            <li>Reverse engineer, copy, or resell the platform except as expressly permitted in writing</li>
            <li>Introduce malware, excessive automated traffic, or conduct that degrades service availability for others</li>
            <li>Use Stride to send unsolicited bulk communications without lawful basis and opt-out mechanisms</li>
          </ul>
          <p>
            We may investigate suspected violations and cooperate with law enforcement where required. Customers are
            responsible for configuring roles and permissions appropriately for their users.
          </p>
        </>
      ),
    },
    {
      id: 'customer-data',
      title: 'Customer data ownership, export, and no lock-in',
      content: (
        <>
          <p>
            <strong>You own your Customer Data.</strong> All employee, payroll, finance, and operational data you
            or your users submit to Stride remains your property. Stride receives only a limited licence to host,
            process, and display Customer Data as necessary to provide and improve the subscribed services.
          </p>
          <p>
            <strong>Export.</strong> Administrators may export data through built-in reports, document downloads,
            and standard export formats provided in the platform. During subscription and for a reasonable period
            after termination (typically thirty (30) days), we will make self-service export available unless
            legally prohibited or suspended for breach.
          </p>
          <p>
            <strong>No lock-in.</strong> We do not impose exit fees for standard subscriptions. Upon verified
            termination and export, we will delete Customer Data from production systems in accordance with our{' '}
            <Link href={privacyUrl}>Privacy Policy</Link> retention schedules, subject to backup cycles and legal
            hold requirements.
          </p>
          <p>
            Anonymised and aggregated usage statistics that cannot identify individuals or your organisation may
            be used to improve Stride.
          </p>
        </>
      ),
    },
    {
      id: 'sla',
      title: 'Service levels and uptime',
      content: (
        <>
          <p>
            Stride targets the following monthly uptime for the production application at{' '}
            <strong>app.getstride.co.ke</strong>, measured against our monitoring excluding scheduled maintenance
            announced in advance:
          </p>
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Monthly uptime target</th>
                <th>Support response target (business hours EAT)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Starter</td>
                <td>99.5%</td>
                <td>Email — next business day for standard issues</td>
              </tr>
              <tr>
                <td>Growth</td>
                <td>99.9%</td>
                <td>Priority email/chat — within 8 business hours for critical issues</td>
              </tr>
              <tr>
                <td>Enterprise</td>
                <td>99.95% (or as per signed SLA)</td>
                <td>Dedicated success manager; custom response times in agreement</td>
              </tr>
            </tbody>
          </table>
          <p>
            &ldquo;Critical issues&rdquo; are production outages or security incidents affecting access to subscribed
            modules. Scheduled maintenance windows, force majeure, third-party network failures outside our control,
            and issues caused by Customer configuration or unauthorised changes are excluded from uptime calculations.
          </p>
          <p>
            Service credits for verified downtime below target may be available for Growth and Enterprise customers
            as specified in their order form. Starter tier receives good-faith remediation but no financial credits
            unless required by law.
          </p>
        </>
      ),
    },
    {
      id: 'support',
      title: 'Support scope',
      content: (
        <>
          <p>
            Support includes assistance with platform availability, account access, and defects in Stride&rsquo;s
            standard functionality. Support does not include unlimited custom development, on-site IT services,
            legal or tax advice, or reconciliation of third-party payment rails beyond documented integration behaviour.
          </p>
          <p>
            Onboarding and implementation for Growth and Enterprise may include configured setup sessions as stated
            on your order. Documentation and in-app guidance are provided to all tiers.
          </p>
        </>
      ),
    },
    {
      id: 'warranties',
      title: 'Warranties and disclaimers',
      content: (
        <>
          <p>
            Stride is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis to the extent permitted
            by Kenyan law. We warrant that we will provide the services with reasonable skill and care and will use
            commercially reasonable efforts to maintain security and availability as described in these Terms.
          </p>
          <p>
            We do not warrant uninterrupted or error-free operation, or that Stride will meet every regulatory
            requirement specific to your industry without appropriate configuration and Customer oversight. Payroll,
            tax, and statutory outputs depend on accurate data and settings supplied by Customer.
          </p>
          <p>
            Except as expressly stated, we disclaim all other warranties, including implied warranties of
            merchantability, fitness for a particular purpose, and non-infringement.
          </p>
        </>
      ),
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      content: (
        <>
          <p>
            To the maximum extent permitted by Kenyan law, neither party is liable for indirect, incidental, special,
            consequential, or punitive damages, or for loss of profits, revenue, data, or goodwill, even if advised of
            the possibility of such damages.
          </p>
          <p>
            Stride&rsquo;s total aggregate liability arising out of or related to these Terms or the services in any
            twelve (12) month period is limited to the fees paid by Customer to Stride for the services in that period,
            except that this cap does not apply to liability that cannot be limited by law (including fraud or wilful
            misconduct) or to Customer&rsquo;s payment obligations.
          </p>
          <p>
            Customer is responsible for backing up business-critical exports and for decisions made using reports
            generated from the platform.
          </p>
        </>
      ),
    },
    {
      id: 'suspension',
      title: 'Suspension and termination',
      content: (
        <>
          <p>
            <strong>By Customer.</strong> You may cancel your subscription at the end of a billing period through
            billing settings or written notice. Cancellation stops future charges; access continues until the end of
            the paid period unless otherwise agreed.
          </p>
          <p>
            <strong>By Stride.</strong> We may suspend or terminate access immediately if you materially breach these
            Terms, fail to pay undisputed fees after notice, pose a security risk, or use the service unlawfully.
            Non-payment may first result in read-only mode after a grace period.
          </p>
          <p>
            <strong>Effect of termination.</strong> Upon termination, your licence to use Stride ends. Sections that
            by nature should survive (confidentiality, liability limits, governing law, payment obligations) will
            survive. We will retain and delete Customer Data as described in our Privacy Policy.
          </p>
        </>
      ),
    },
    {
      id: 'confidentiality',
      title: 'Confidentiality',
      content: (
        <>
          <p>
            Each party may receive confidential information from the other in connection with the services. The
            receiving party will use confidential information only to perform under these Terms and will protect it
            with at least reasonable care, not disclosing it to third parties except to employees, contractors, and
            sub-processors who need to know and are bound by similar obligations.
          </p>
          <p>
            Customer Data is treated as Customer confidential information. Stride&rsquo;s product roadmaps, pricing
            not publicly published, and non-public security documentation are Stride confidential information.
          </p>
          <p>
            Exclusions apply to information that is public without breach, independently developed, or rightfully
            received from a third party without restriction.
          </p>
        </>
      ),
    },
    {
      id: 'ip',
      title: 'Intellectual property',
      content: (
        <>
          <p>
            Stride and its licensors retain all rights in the platform, software, documentation, trademarks, and
            related intellectual property. These Terms grant Customer a limited, non-exclusive, non-transferable,
            revocable licence to use Stride during an active subscription for internal business purposes.
          </p>
          <p>
            Customer retains all rights in Customer Data and in its own trademarks and materials uploaded to the
            platform. Customer grants Stride the rights necessary to host and process Customer Data to provide the
            services.
          </p>
          <p>
            Feedback you provide may be used by Stride to improve products without obligation or attribution,
            provided it does not identify Customer confidential information.
          </p>
        </>
      ),
    },
    {
      id: 'governing-law',
      title: 'Governing law and disputes',
      content: (
        <>
          <p>
            These Terms are governed by the laws of the <strong>Republic of Kenya</strong>, without regard to
            conflict-of-law principles. The courts of Nairobi, Kenya have exclusive jurisdiction, except that either
            party may seek injunctive relief in any competent court to protect intellectual property or confidential
            information.
          </p>
          <p>
            Before formal proceedings, the parties will attempt in good faith to resolve disputes through escalation
            to senior representatives within thirty (30) days of written notice.
          </p>
        </>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to these Terms',
      content: (
        <>
          <p>
            We may update these Terms to reflect legal, security, or product changes. Material updates will be posted
            at <Link href="/terms">getstride.co.ke/terms</Link> with a revised &ldquo;Last updated&rdquo; date and,
            where appropriate, notice to account administrators by email at least thirty (30) days before changes
            take effect for existing subscriptions.
          </p>
          <p>
            Continued use after the effective date constitutes acceptance. If you do not agree, you may cancel before
            the effective date without penalty for the change itself (standard billing periods still apply).
          </p>
        </>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      content: (
        <>
          <p>Questions about these Terms or your subscription:</p>
          <ul>
            <li>
              <strong>Email:</strong>{' '}
              <a href={`mailto:${MARKETING_SALES_EMAIL}`}>{MARKETING_SALES_EMAIL}</a>
            </li>
            <li>
              <strong>Legal / contracts:</strong>{' '}
              <a href="mailto:legal@getstride.co.ke">legal@getstride.co.ke</a>
            </li>
          </ul>
          <p>
            See also our <Link href={privacyUrl}>Privacy Policy</Link> for how we handle personal data.
          </p>
        </>
      ),
    },
  ];
}
