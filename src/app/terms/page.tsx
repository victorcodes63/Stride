'use client';

import { FileText, Scales, Shield, Warning } from '@phosphor-icons/react';
import PublicPageLayout from '@/components/public/PublicPageLayout';
import { PublicLegalPage } from '@/components/public/PublicLegalPage';
import { usePublicBrand } from '@/components/BrandProvider';

export default function TermsOfServicePage() {
  const { contactEmail } = usePublicBrand();

  const sections = [
    {
      icon: FileText,
      title: 'Service agreement',
      description:
        'By using our services you agree to these terms. Please read them carefully before engaging with our HR platform.',
    },
    {
      icon: Scales,
      title: 'Service scope',
      description:
        'Our services include recruitment, HR operations, training, compliance, and related consulting as described in your agreement.',
    },
    {
      icon: Shield,
      title: 'Client responsibilities',
      description:
        'Clients must provide accurate information, maintain confidentiality, and comply with applicable laws and regulations.',
    },
    {
      icon: Warning,
      title: 'Limitation of liability',
      description:
        'Our liability is limited to the extent permitted by law. We are not responsible for indirect or consequential damages.',
    },
  ];

  return (
    <PublicPageLayout>
      <PublicLegalPage
        eyebrow="Terms of service"
        title="Terms of service"
        description="These terms govern your use of the Stride operations platform and related services provided by Raven Tech Group."
        sections={sections}
      >
        <div>
          <h4>1. Service provision</h4>
          <p>
            Raven Tech Group provides the Stride platform as agreed in your service contract, which may
            include HR, payroll, finance, recruitment and other operational modules.
          </p>
        </div>

        <div>
          <h4>2. Client obligations</h4>
          <p>
            Clients must provide accurate information, maintain confidentiality, and comply with applicable laws.
            Payment terms are as specified in the service agreement.
          </p>
        </div>

        <div>
          <h4>3. Confidentiality</h4>
          <p>
            Both parties agree to maintain strict confidentiality regarding business information and personal data
            shared during the professional relationship.
          </p>
        </div>

        <div>
          <h4>4. Limitation of liability</h4>
          <p>
            Our liability is limited to fees paid for the specific service. We are not liable for indirect,
            consequential, or punitive damages arising from our services.
          </p>
        </div>

        <div>
          <h4>5. Termination</h4>
          <p>
            Either party may terminate the service agreement with written notice as specified in the contract.
            Outstanding fees remain due upon termination.
          </p>
        </div>

        <div className="rounded-lg border border-pub-border bg-pub-surface-muted p-6">
          <h4>Questions about these terms?</h4>
          <p className="mt-2">
            Contact us at{' '}
            <a href={`mailto:${contactEmail || 'info@example.com'}`}>
              {contactEmail || 'info@example.com'}
            </a>
            .
          </p>
        </div>
      </PublicLegalPage>
    </PublicPageLayout>
  );
}
