'use client';

import type React from 'react';
import type { CompanySetupSettings } from '@/lib/company-setup';
import type { PublicBrand } from '@/lib/brand';
import { buildTenantBrandThemeCssVars } from '@/lib/brand-theme';
import { DEFAULT_BRAND_LOGO_SRC } from '@/lib/brand-constants';
import { contrastOnWhiteText, WCAG_AA_NORMAL } from '@/lib/brand-contrast';

/** Live, brand-themed preview of the surfaces white-label settings affect. */
export function BrandingPreview({
  form,
  resolvedBrand,
  allowWhiteLabel,
}: {
  form: CompanySetupSettings;
  resolvedBrand: PublicBrand;
  allowWhiteLabel: boolean;
}) {
  const appName =
    allowWhiteLabel && form.appName.trim() ? form.appName.trim() : resolvedBrand.appName;
  const wordmark =
    allowWhiteLabel && form.wordmark.trim() ? form.wordmark.trim() : appName;
  const orgName = form.orgName.trim() || resolvedBrand.orgName;
  const logo = form.logoSrc || resolvedBrand.tenantLogoSrc || DEFAULT_BRAND_LOGO_SRC;
  const subtitle =
    form.staffLoginWelcomeSubtitle.trim() || resolvedBrand.tagline || 'Sign in to your workspace';

  const style = buildTenantBrandThemeCssVars(
    form.primaryColor,
    form.secondaryColor,
  ) as React.CSSProperties;

  const ratio = contrastOnWhiteText(form.primaryColor);
  const lowContrast = ratio != null && ratio < WCAG_AA_NORMAL;

  return (
    <div className="space-y-3">
      <div className="dash-brand-preview" style={style}>
        <div className="dash-brand-preview-chrome">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-6 w-auto max-w-[120px] object-contain" />
          <span className="text-sm font-semibold dash-setup-heading">{wordmark}</span>
        </div>
        <div className="dash-brand-preview-body">
          <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
            <p className="text-xs uppercase tracking-wide dash-setup-muted">Staff login</p>
            <p className="mt-1 text-base font-semibold dash-setup-heading">
              Welcome to {appName}
            </p>
            <p className="text-xs dash-setup-muted mt-0.5">{subtitle}</p>
            <div className="mt-3 space-y-2">
              <div className="h-8 rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface-raised)]" />
              <div className="h-8 rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface-raised)]" />
              <div className="dash-brand-preview-cta w-full">Sign in</div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--dash-border)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: 'var(--stride-coral)' }}>
                {orgName}
              </span>
              <span className="text-[0.65rem] dash-setup-muted">PAYSLIP</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: 'var(--stride-coral)' }} />
            <p className="mt-2 text-[0.65rem] dash-setup-muted">
              {form.documentFooterText.trim() || 'Document footer text appears here.'}
            </p>
          </div>

          {!form.hidePoweredBy ? (
            <p className="text-center text-[0.65rem] dash-setup-muted">Powered by Stride</p>
          ) : null}
        </div>
      </div>

      {lowContrast ? (
        <p className="dash-brand-contrast-warn">
          Low contrast: white text on your primary colour scores {ratio}:1 (WCAG AA needs {WCAG_AA_NORMAL}:1).
          Consider a darker primary for readable buttons.
        </p>
      ) : null}
    </div>
  );
}
