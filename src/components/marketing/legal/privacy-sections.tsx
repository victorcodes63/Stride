import Link from 'next/link';

import type { LegalSection } from '@/components/marketing/legal/legal-types';
import { brandConfig } from '@/lib/brand.config';
import { getMarketingPageUrl, MARKETING_SALES_EMAIL } from '@/lib/marketing-config';

const PRIVACY_EMAIL = 'privacy@getstride.co.ke';
const LEGAL_LAST_UPDATED = '2026-06-27';

export const PRIVACY_LAST_UPDATED = LEGAL_LAST_UPDATED;

export function getPrivacySections(): LegalSection[] {
  const termsUrl = getMarketingPageUrl('/terms');

  return [
    {
      id: 'introduction',
      title: 'Introduction',
      content: (
        <>
          <p>
            This Privacy Policy explains how <strong>{brandConfig.companyLegal}</strong> (&ldquo;Stride&rdquo;,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, stores, and protects personal data when you visit{' '}
            <strong>getstride.co.ke</strong>, use the Stride operations platform at{' '}
            <strong>app.getstride.co.ke</strong>, or interact with us for sales and support.
          </p>
          <p>
            Stride is a multi-tenant software-as-a-service platform for East African businesses — covering HR &
            payroll, finance, procurement, projects, legal, and industry-specific modules. Because we process
            employee, payroll, and financial records on behalf of customer organisations, this policy describes both
            our role as a data processor and the limited data we control directly as a data controller.
          </p>
        </>
      ),
    },
    {
      id: 'roles',
      title: 'Controller and processor roles',
      content: (
        <>
          <p>
            <strong>When Stride is the data controller.</strong> We determine the purposes and means of processing
            for: website analytics and marketing enquiries; account registration and billing contact details for
            the subscribing organisation; platform security logs; and communications with prospective and existing
            customers.
          </p>
          <p>
            <strong>When Stride is the data processor.</strong> For employee, applicant, payroll, finance, and
            operational data entered into a customer&rsquo;s Stride tenant, the <strong>customer organisation</strong>{' '}
            is the data controller. We process that data only on documented instructions from the customer — to
            provide, secure, and support the subscribed services — and in accordance with our data processing terms
            and this policy.
          </p>
          <p>
            If you are an employee or other individual whose employer uses Stride, please contact your employer
            (the controller) in the first instance for access, correction, or deletion requests relating to
            employment data. We will assist our customers in fulfilling those requests as required by contract and
            applicable law.
          </p>
        </>
      ),
    },
    {
      id: 'data-collected',
      title: 'Data we collect',
      content: (
        <>
          <p>Depending on your relationship with Stride, we may process the following categories of personal data:</p>
          <h3>Customer organisation and billing contacts</h3>
          <ul>
            <li>Name, work email, phone number, job title, and company details</li>
            <li>Subscription tier, billing history, and Paystack payment references (not full card numbers)</li>
            <li>Support tickets, demo requests, and correspondence with our team</li>
          </ul>
          <h3>Platform users (staff and administrators)</h3>
          <ul>
            <li>Account credentials or SSO identifiers (Microsoft Entra ID, Google Workspace)</li>
            <li>Role, permissions, login timestamps, IP address, and device/browser metadata for security</li>
            <li>Audit logs of actions taken within the platform</li>
          </ul>
          <h3>Employee and workforce data (processor data)</h3>
          <ul>
            <li>Identity and contact details, national ID or passport references, tax PIN, bank and M-Pesa payout details</li>
            <li>Employment records: job title, department, compensation, leave, attendance, performance, and disciplinary records</li>
            <li>Applicant and recruitment data where the ATS module is enabled</li>
            <li>Documents uploaded to the platform (contracts, IDs, payslips, letters)</li>
          </ul>
          <h3>Finance and operations data (processor data)</h3>
          <ul>
            <li>Chart of accounts, invoices, expenses, approvals, vendor records, and payment instructions</li>
            <li>M-Pesa disbursement batches, reconciliation references, and statutory filing outputs (KRA, NSSF, SHIF, etc.)</li>
            <li>Procurement, asset, fleet, and project records linked to identifiable individuals where applicable</li>
          </ul>
          <h3>Website visitors</h3>
          <ul>
            <li>Cookie and analytics data (where consent or legitimate interest applies)</li>
            <li>Contact form submissions and newsletter preferences</li>
          </ul>
        </>
      ),
    },
    {
      id: 'purposes',
      title: 'Purposes and lawful basis',
      content: (
        <>
          <p>We use personal data for the following purposes and lawful bases under the Kenya Data Protection Act, 2019:</p>
          <table>
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Typical lawful basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Providing and operating the Stride platform for subscribed customers</td>
                <td>Contract performance; legitimate interest of the customer</td>
              </tr>
              <tr>
                <td>Processing payroll, M-Pesa disbursements, and statutory compliance on customer instruction</td>
                <td>Contract performance; legal obligation (where applicable)</td>
              </tr>
              <tr>
                <td>Account security, fraud prevention, and incident response</td>
                <td>Legitimate interest; legal obligation</td>
              </tr>
              <tr>
                <td>Subscription billing via Paystack</td>
                <td>Contract performance</td>
              </tr>
              <tr>
                <td>Product support, onboarding, and service communications</td>
                <td>Contract performance; legitimate interest</td>
              </tr>
              <tr>
                <td>Marketing to prospective customers (demo requests, product updates)</td>
                <td>Consent or legitimate interest with opt-out</td>
              </tr>
              <tr>
                <td>Improving reliability, analytics, and product development (aggregated where possible)</td>
                <td>Legitimate interest</td>
              </tr>
            </tbody>
          </table>
          <p>
            Where we rely on consent, you may withdraw it at any time without affecting processing already
            performed. Where we act as processor, the customer organisation determines the lawful basis for
            employee and operational data.
          </p>
        </>
      ),
    },
    {
      id: 'sub-processors',
      title: 'Sub-processors',
      content: (
        <>
          <p>
            We use carefully selected infrastructure and service providers to deliver Stride. Each sub-processor
            is bound by contractual data protection obligations consistent with this policy.
          </p>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Service</th>
                <th>Data processed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Neon</td>
                <td>Managed PostgreSQL database</td>
                <td>All tenant application data at rest</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>Application hosting, edge network, and deployment</td>
                <td>Request logs, cached assets, environment configuration</td>
              </tr>
              <tr>
                <td>Paystack</td>
                <td>Subscription billing and payment processing</td>
                <td>Billing contact details, transaction references, payment status</td>
              </tr>
              <tr>
                <td>Microsoft / Google</td>
                <td>Single sign-on (Entra ID, Google Workspace)</td>
                <td>Authentication identifiers, name, and work email from identity provider</td>
              </tr>
              <tr>
                <td>SMTP email provider</td>
                <td>Transactional email (invites, payslips, notifications)</td>
                <td>Recipient address, message content as configured by the customer</td>
              </tr>
            </tbody>
          </table>
          <p>
            We may update sub-processors from time to time. Enterprise customers may request prior notice of
            material sub-processor changes as set out in their agreement.
          </p>
        </>
      ),
    },
    {
      id: 'rights',
      title: 'Your data subject rights',
      content: (
        <>
          <p>
            Under the Kenya Data Protection Act, 2019, data subjects have rights including access, rectification,
            erasure, restriction, objection, and data portability, subject to legal exceptions. You may also lodge a
            complaint with the <strong>Office of the Data Protection Commissioner (ODPC)</strong> in Kenya.
          </p>
          <ul>
            <li>
              <strong>Controller data</strong> (marketing, billing, your Stride admin account): contact us at{' '}
              <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
            </li>
            <li>
              <strong>Employee or payroll data</strong> held in your employer&rsquo;s tenant: contact your employer
              first; we will support them in responding within agreed timeframes.
            </li>
          </ul>
          <p>
            We respond to verified requests without undue delay and within timelines required by applicable law,
            typically within 30 days unless an extension is permitted.
          </p>
        </>
      ),
    },
    {
      id: 'retention',
      title: 'Retention',
      content: (
        <>
          <p>We retain personal data only as long as necessary for the purposes described above:</p>
          <ul>
            <li>
              <strong>Active subscription data:</strong> retained for the duration of the customer agreement and
              configured backup windows.
            </li>
            <li>
              <strong>Post-termination:</strong> customer may export data during a defined wind-down period; after
              that, tenant data is deleted from production systems within 90 days unless a longer period is required
              by law or agreed in writing.
            </li>
            <li>
              <strong>Billing and tax records:</strong> retained for at least seven (7) years as required for Kenyan
              tax and accounting purposes.
            </li>
            <li>
              <strong>Security and audit logs:</strong> typically 12–24 months, unless needed for an active
              investigation.
            </li>
            <li>
              <strong>Marketing contacts:</strong> until you unsubscribe or we no longer have a legitimate basis to
              contact you.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'security',
      title: 'Security',
      content: (
        <>
          <p>
            We implement technical and organisational measures appropriate to the sensitivity of HR, payroll, and
            financial data, including:
          </p>
          <ul>
            <li>Encryption in transit (TLS) and encryption at rest for database storage</li>
            <li>Multi-tenant isolation with row-level security and role-based access controls</li>
            <li>Hashed credentials, optional SSO, and session management for staff and ESS portals</li>
            <li>Environment separation between production, staging, and internal demo sandboxes</li>
            <li>Access logging, least-privilege internal access, and periodic review of administrative permissions</li>
            <li>Backups and disaster-recovery procedures for database availability</li>
          </ul>
          <p>
            No method of transmission or storage is completely secure. We require customers to maintain strong
            passwords, enable SSO where available, and configure appropriate internal access roles.
          </p>
        </>
      ),
    },
    {
      id: 'payments',
      title: 'M-Pesa and payment data',
      content: (
        <>
          <p>
            Stride supports M-Pesa bulk salary disbursements and payment reconciliation as part of payroll and
            finance modules. When customers use these features:
          </p>
          <ul>
            <li>
              Mobile money payout instructions (phone numbers, amounts, batch references) are processed on the
              customer&rsquo;s instruction and stored within their tenant.
            </li>
            <li>
              Stride does not store M-Pesa PINs or full mobile-money wallet credentials. Integration with payment
              rails is performed through authorised APIs and customer-configured accounts.
            </li>
            <li>
              Subscription payments for Stride itself are processed by <strong>Paystack</strong>. We do not store
              full payment card numbers on Stride servers; Paystack provides tokenised payment references and
              receipts.
            </li>
          </ul>
          <p>
            Customers are responsible for ensuring they have a lawful basis and employee consent (where required)
            to collect and disburse payments via mobile money.
          </p>
        </>
      ),
    },
    {
      id: 'residency',
      title: 'Data residency and cross-border transfers',
      content: (
        <>
          <p>
            Stride is designed for East African operations with <strong>regional data cells</strong> for Kenya (KE),
            Uganda (UG), and Tanzania (TZ). Customer tenant data is allocated to the cell selected at onboarding
            and remains logically segregated from other regions.
          </p>
          <p>
            Some sub-processors (for example Vercel edge infrastructure and email delivery) may process limited
            metadata outside your selected cell. Where personal data is transferred outside Kenya, we implement
            appropriate safeguards — including contractual clauses and vendor security assessments — consistent
            with the Kenya Data Protection Act and ODPC guidance.
          </p>
          <p>
            Enterprise customers may specify residency requirements in their order form. Cross-border transfers
            within a customer&rsquo;s own multi-entity setup (for example Kenya and Uganda entities in one account)
            occur under the customer&rsquo;s control and documented instructions.
          </p>
        </>
      ),
    },
    {
      id: 'odpc',
      title: 'Kenya Data Protection Act and ODPC',
      content: (
        <>
          <p>
            We align our processing practices with the <strong>Kenya Data Protection Act, 2019</strong> and
            regulations issued by the <strong>Office of the Data Protection Commissioner (ODPC)</strong>, including:
          </p>
          <ul>
            <li>Registering as a data controller/processor where required and maintaining required records of processing</li>
            <li>Processing personal data lawfully, fairly, and transparently with appropriate security measures</li>
            <li>Honouring data subject rights and supporting our customers in honouring rights for processor data</li>
            <li>Conducting data protection impact assessments for high-risk processing where appropriate</li>
            <li>Appointing a contact point for privacy enquiries and regulatory correspondence</li>
          </ul>
          <p>
            You may contact the ODPC at{' '}
            <a href="https://www.odpc.go.ke" rel="noopener noreferrer" target="_blank">
              odpc.go.ke
            </a>{' '}
            if you believe your rights have been infringed and we have not resolved your concern.
          </p>
        </>
      ),
    },
    {
      id: 'breach',
      title: 'Personal data breach notification',
      content: (
        <>
          <p>
            We maintain procedures to detect, investigate, and respond to suspected personal data breaches. If we
            become aware of a breach affecting personal data where we are the controller, we will notify the ODPC
            within seventy-two (72) hours where required and communicate to affected individuals without undue delay
            when the breach is likely to result in a high risk to their rights and freedoms.
          </p>
          <p>
            Where we process data on behalf of a customer, we will notify the customer without undue delay after
            becoming aware of a personal data breach affecting their tenant, and provide reasonable assistance so
            the customer can meet its regulatory and contractual notification obligations.
          </p>
        </>
      ),
    },
    {
      id: 'contact',
      title: 'Contact and Data Protection Officer',
      content: (
        <>
          <p>For privacy questions, data subject requests relating to controller data, or regulatory enquiries:</p>
          <ul>
            <li>
              <strong>Data Protection contact:</strong>{' '}
              <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
            </li>
            <li>
              <strong>General enquiries:</strong>{' '}
              <a href={`mailto:${MARKETING_SALES_EMAIL}`}>{MARKETING_SALES_EMAIL}</a>
            </li>
            <li>
              <strong>Postal address:</strong> Raven Tech Group, Nairobi, Kenya (full registered address available
              on request for contractual and regulatory correspondence)
            </li>
          </ul>
          <p>
            This policy should be read together with our{' '}
            <Link href={termsUrl}>Terms of Service</Link>. We may update this policy from time to time; material
            changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date.
          </p>
        </>
      ),
    },
  ];
}
