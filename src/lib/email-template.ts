/**
 * Branded HTML email layout — coral accent, Stride wordmark header.
 */

import { STRIDE_WORDMARK_SRC } from '@/lib/brand-constants';
import { brand, getEmailFooterPlain, getSiteUrl, mailFromName } from '@/lib/brand';
import { STRIDE_PALETTE } from '@/lib/stride-palette';

export const EMAIL_WORDMARK_CID = 'stride-wordmark';

const CORAL = STRIDE_PALETTE.coral;
const INK = STRIDE_PALETTE.ink;
const INK_MUTED = STRIDE_PALETTE.inkMuted;
const PAPER = STRIDE_PALETTE.paper;
const LINE = STRIDE_PALETTE.line;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getEmailWordmarkUrl(): string {
  const base = getSiteUrl().replace(/\/$/, '');
  const path = STRIDE_WORDMARK_SRC.startsWith('/') ? STRIDE_WORDMARK_SRC : `/${STRIDE_WORDMARK_SRC}`;
  return `${base}${path}`;
}

export type BrandedEmailCta = {
  label: string;
  href: string;
  /** Primary coral button vs secondary outline */
  variant?: 'primary' | 'secondary' | 'danger';
};

export type BuildBrandedEmailParams = {
  /** Main HTML body (already escaped where needed) */
  content: string;
  /** Optional heading shown below wordmark */
  title?: string;
  /** Primary call-to-action button */
  cta?: BrandedEmailCta;
  /** Extra CTAs (e.g. interview confirm/reschedule) */
  ctas?: BrandedEmailCta[];
  /** Use cid: for inline wordmark when attachments include logo */
  wordmarkSrc?: string;
};

function ctaStyles(variant: BrandedEmailCta['variant'] = 'primary'): string {
  if (variant === 'danger') {
    return `display:inline-block;padding:12px 24px;background-color:transparent;color:${STRIDE_PALETTE.danger} !important;text-decoration:none;font-size:15px;font-weight:600;text-align:center;border-radius:8px;border:2px solid ${STRIDE_PALETTE.danger};`;
  }
  if (variant === 'secondary') {
    return `display:inline-block;padding:12px 24px;background-color:${INK_MUTED};color:#ffffff !important;text-decoration:none;font-size:15px;font-weight:500;text-align:center;border-radius:8px;border:none;`;
  }
  return `display:inline-block;padding:14px 28px;background-color:${CORAL};color:#ffffff !important;text-decoration:none;font-size:15px;font-weight:600;text-align:center;border-radius:8px;border:none;`;
}

function renderCta(cta: BrandedEmailCta): string {
  return `<a href="${escapeHtml(cta.href)}" style="${ctaStyles(cta.variant)}">${escapeHtml(cta.label)}</a>`;
}

/** Single branded HTML shell for all transactional emails. */
export function buildBrandedEmailHtml(params: BuildBrandedEmailParams): string {
  const wordmarkSrc = params.wordmarkSrc ?? getEmailWordmarkUrl();
  const titleBlock = params.title
    ? `<h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:${INK};line-height:1.3;">${escapeHtml(params.title)}</h1>`
    : '';
  const ctas = params.ctas ?? (params.cta ? [params.cta] : []);
  const ctaBlock =
    ctas.length > 0
      ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px;">
          ${ctas
            .map(
              (c) =>
                `<tr><td style="padding:0 0 12px;">${renderCta(c)}</td></tr>`,
            )
            .join('')}
        </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${PAPER};">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background-color:#ffffff;color:${INK_MUTED};">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background-color:#ffffff;">
      <tr>
        <td style="padding:28px 32px 24px;text-align:center;border-bottom:3px solid ${CORAL};">
          <img src="${wordmarkSrc}" alt="${escapeHtml(brand.appName)}" width="200" style="display:inline-block;max-width:200px;height:auto;" />
        </td>
      </tr>
      <tr>
        <td style="padding:36px 32px 32px;font-size:16px;line-height:1.65;color:${INK_MUTED};">
          ${titleBlock}
          ${params.content}
          ${ctaBlock}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 28px;background-color:${PAPER};border-top:1px solid ${LINE};">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${INK};">${escapeHtml(mailFromName)}</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:${STRIDE_PALETTE.warmSubtle};">${escapeHtml(getEmailFooterPlain())}</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}
