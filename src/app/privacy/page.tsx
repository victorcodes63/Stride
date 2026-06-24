'use client';

import { Eye, FileText, Lock, Shield } from '@phosphor-icons/react';
import PublicPageLayout from '@/components/public/PublicPageLayout';
import { PublicLegalPage } from '@/components/public/PublicLegalPage';
import { usePublicBrand } from '@/components/BrandProvider';

export default function PrivacyPolicyPage() {
  const { contactEmail } = usePublicBrand();

  const sections = [
    {
      icon: FileText,
      title: 'Information we collect',
      description:
        'We collect information you provide when you create an account, apply for roles, or contact us for support.',
    },
    {
      icon: Eye,
      title: 'How we use it',
      description:
        'We use your information to provide HR services, process applications, communicate with you, and improve our platform.',
    },
    {
      icon: Shield,
      title: 'Information sharing',
      description:
        'We do not sell personal information. Data is shared only with your consent or as required to deliver our services.',
    },
    {
      icon: Lock,
      title: 'Data security',
      description:
        'We apply industry-standard safeguards to protect personal information from unauthorized access or disclosure.',
    },
  ];

  return (
    <PublicPageLayout>
      <PublicLegalPage
        eyebrow="Privacy policy"
        title="Your privacy matters"
        description="Stride is committed to protecting personal information processed through our platform. This policy explains how we collect, use, and safeguard data when you use Stride services."
        sections={sections}
      >
        <div>
          <h4>1. Information collection</h4>
          <p>
            We collect information when you register, submit job applications, or contact us. This may include your
            name, email address, phone number, résumé, and other details relevant to HR and recruitment.
          </p>
        </div>

        <div>
          <h4>2. Use of information</h4>
          <p>
            We use your information to provide HR services, match candidates with opportunities, communicate about
            our services, and improve the platform experience.
          </p>
        </div>

        <div>
          <h4>3. Data protection</h4>
          <p>
            We implement appropriate technical and organisational measures to protect personal information from
            unauthorized access, use, or disclosure.
          </p>
        </div>

        <div>
          <h4>4. Your rights</h4>
          <p>
            You may request access to, correction of, or deletion of your personal information. You can also opt out
            of non-essential communications where applicable.
          </p>
        </div>

        <div className="rounded-lg border border-pub-border bg-pub-surface-muted p-6">
          <h4>Questions about this policy?</h4>
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
