/**
 * Shared email sending for applicant and staff notifications.
 * Primary provider on Vercel: Microsoft Graph API over HTTPS.
 * Fallback provider: SMTP via Nodemailer.
 */

import nodemailer from 'nodemailer';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createInterviewToken } from '@/lib/interview-token';
import { generatePayslipPdf } from '@/lib/payslip-pdf';
import { APP_TIMEZONE } from '@/lib/timezone';
import {
  brand,
  getPublicLogoUrl,
  getLogoFileAbsolutePath,
  getSiteUrl,
  mailFromName,
  accountsMailFromName,
  emailSubjectTag,
  getEmailFooterPlain,
} from '@/lib/brand';

const FROM_NAME = mailFromName;
const FROM_EMAIL = process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || '';

/** Base URL for absolute links in email. Set NEXT_PUBLIC_SITE_URL in production. */
const BASE_URL = getSiteUrl();
/** For confirm/reschedule links: use localhost in dev (so links work when testing locally). */
const INVITE_LINK_BASE =
  (typeof process.env.INVITE_LINK_BASE === 'string' && process.env.INVITE_LINK_BASE.trim()) ||
  (process.env.NODE_ENV === 'development' && !process.env.VERCEL_URL
    ? 'http://localhost:3000'
    : BASE_URL.replace(/\/$/, ''));
const LOGO_URL = getPublicLogoUrl();
const LOGO_CID = 'stride-logo';
const LOGO_FILE_PATH = getLogoFileAbsolutePath();

function getLogoAttachmentFilename(): string {
  const rel = brand.logoPngPath.replace(/^\//, '');
  const base = rel.split('/').pop() ?? 'brand-logo';
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(base)) return base;
  return `${base}.png`;
}

export type EmailSendResult =
  | { sent: true; messageId?: string }
  | {
      sent: false;
      reason:
        | 'graph_not_configured'
        | 'graph_auth_error'
        | 'graph_send_error'
        | 'smtp_not_configured'
        | 'from_email_missing'
        | 'smtp_error';
      error: string;
      diagnostics?: {
        provider?: 'graph' | 'smtp';
        graphMailbox?: string;
        hasTenantId?: boolean;
        hasClientId?: boolean;
        hasClientSecret?: boolean;
        host: string;
        port: number;
        secure: boolean;
        hasUser: boolean;
        hasPass: boolean;
        hasFromEmail: boolean;
        smtpResponse?: unknown;
        smtpResponseCode?: unknown;
      };
    };

function getSmtpLogoAsset(): {
  src: string;
  attachments?: Array<{ filename: string; path: string; cid: string }>;
} {
  if (existsSync(LOGO_FILE_PATH)) {
    return {
      src: `cid:${LOGO_CID}`,
      attachments: [
        {
          filename: getLogoAttachmentFilename(),
          path: LOGO_FILE_PATH,
          cid: LOGO_CID,
        },
      ],
    };
  }
  return { src: LOGO_URL };
}

function getGraphLogoAsset(): {
  src: string;
  attachments?: Array<Record<string, unknown>>;
} {
  if (existsSync(LOGO_FILE_PATH)) {
    const contentBytes = readFileSync(LOGO_FILE_PATH).toString('base64');
    return {
      src: `cid:${LOGO_CID}`,
      attachments: [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: getLogoAttachmentFilename(),
          contentType: 'image/png',
          contentId: LOGO_CID,
          isInline: true,
          contentBytes,
        },
      ],
    };
  }
  return { src: LOGO_URL };
}

function getTransporter(): nodemailer.Transporter | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port,
    secure,
    auth: { user, pass },
  });
}

/** Accounts mailbox transporter (set ACCOUNTS_SMTP_USER) for payslips, invoices, etc. */
function getAccountsTransporter(): nodemailer.Transporter | null {
  const user = process.env.ACCOUNTS_SMTP_USER;
  const pass = process.env.ACCOUNTS_SMTP_PASS;
  if (!user?.trim() || !pass) return null;
  const host = process.env.ACCOUNTS_SMTP_HOST || process.env.SMTP_HOST || 'smtp.office365.com';
  const port = parseInt(process.env.ACCOUNTS_SMTP_PORT || process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;
  return nodemailer.createTransport({ host, port, secure, auth: { user: user.trim(), pass } });
}

/** Diagnostic config for accounts SMTP (safe to log – no passwords). */
function getAccountsSmtpConfig() {
  const user = process.env.ACCOUNTS_SMTP_USER?.trim();
  const pass = process.env.ACCOUNTS_SMTP_PASS;
  const host = process.env.ACCOUNTS_SMTP_HOST || process.env.SMTP_HOST || 'smtp.office365.com';
  const port = parseInt(process.env.ACCOUNTS_SMTP_PORT || process.env.SMTP_PORT || '587', 10);
  return {
    host,
    port,
    secure: port === 465,
    user: user ?? '(not set)',
    hasPass: Boolean(pass),
    passLength: pass ? pass.length : 0,
  };
}

function getSmtpDiagnostics() {
  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  return {
    host,
    port,
    secure: port === 465,
    hasUser: Boolean(process.env.SMTP_USER?.trim()),
    hasPass: Boolean(process.env.SMTP_PASS?.trim()),
    hasFromEmail: Boolean(FROM_EMAIL?.trim()),
  };
}

function getGraphConfig() {
  const tenantId = process.env.MS_TENANT_ID?.trim() || '';
  const clientId = process.env.MS_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim() || '';
  const mailbox =
    process.env.MS_GRAPH_MAILBOX?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    '';
  return {
    tenantId,
    clientId,
    clientSecret,
    mailbox,
    enabled: Boolean(tenantId && clientId && clientSecret && mailbox),
  };
}

async function sendViaMicrosoftGraph(params: {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  attachments?: Array<Record<string, unknown>>;
}): Promise<EmailSendResult> {
  const graph = getGraphConfig();
  if (!graph.enabled) {
    return {
      sent: false,
      reason: 'graph_not_configured',
      error: 'MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, or MS_GRAPH_MAILBOX missing.',
      diagnostics: {
        provider: 'graph',
        graphMailbox: graph.mailbox || undefined,
        hasTenantId: Boolean(graph.tenantId),
        hasClientId: Boolean(graph.clientId),
        hasClientSecret: Boolean(graph.clientSecret),
        ...getSmtpDiagnostics(),
      },
    };
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${graph.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: graph.clientId,
        client_secret: graph.clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      }).toString(),
    }
  );

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    return {
      sent: false,
      reason: 'graph_auth_error',
      error: `Graph token request failed (${tokenRes.status}): ${body.slice(0, 300)}`,
      diagnostics: {
        provider: 'graph',
        graphMailbox: graph.mailbox,
        hasTenantId: true,
        hasClientId: true,
        hasClientSecret: true,
        ...getSmtpDiagnostics(),
      },
    };
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return {
      sent: false,
      reason: 'graph_auth_error',
      error: 'Graph token response missing access_token.',
      diagnostics: {
        provider: 'graph',
        graphMailbox: graph.mailbox,
        hasTenantId: true,
        hasClientId: true,
        hasClientSecret: true,
        ...getSmtpDiagnostics(),
      },
    };
  }

  const sendRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(graph.mailbox)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: { contentType: 'HTML', content: params.html },
          from: {
            emailAddress: { address: graph.mailbox, name: FROM_NAME },
          },
          toRecipients: [{ emailAddress: { address: params.to } }],
          ...(params.cc?.trim()
            ? { ccRecipients: [{ emailAddress: { address: params.cc.trim() } }] }
            : {}),
          ...(params.attachments?.length ? { attachments: params.attachments } : {}),
        },
        saveToSentItems: true,
      }),
    }
  );

  if (!sendRes.ok) {
    const body = await sendRes.text().catch(() => '');
    return {
      sent: false,
      reason: 'graph_send_error',
      error: `Graph sendMail failed (${sendRes.status}): ${body.slice(0, 300)}`,
      diagnostics: {
        provider: 'graph',
        graphMailbox: graph.mailbox,
        hasTenantId: true,
        hasClientId: true,
        hasClientSecret: true,
        ...getSmtpDiagnostics(),
      },
    };
  }

  return { sent: true, messageId: 'graph-sendmail-accepted' };
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  cc?: string;
}): Promise<EmailSendResult> {
  const graphResult = await sendViaMicrosoftGraph({
    to: params.to,
    cc: params.cc,
    subject: params.subject,
    html: params.html,
  });
  if (graphResult.sent) return graphResult;

  const transporter = getTransporter();
  if (!transporter) return graphResult;
  if (!FROM_EMAIL) {
    return {
      sent: false,
      reason: 'from_email_missing',
      error: 'From email is missing. Set SMTP_USER or SMTP_FROM_EMAIL.',
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }

  try {
    const info = (await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: params.to,
      cc: params.cc?.trim() || undefined,
      subject: params.subject,
      html: params.html,
    })) as { messageId?: string };
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sent: false,
      reason: 'smtp_error',
      error: message,
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }
}

/**
 * Send "application received" confirmation to the applicant (and your records).
 * Provider order: Microsoft Graph (recommended on Vercel) -> SMTP fallback.
 */
export async function sendApplicationReceivedEmail(params: {
  to: string;
  applicantFirstName: string;
  jobTitle: string;
  companyName: string;
  applicationId?: string;
}): Promise<EmailSendResult> {
  const { to, applicantFirstName, jobTitle, companyName } = params;
  const subject = `${emailSubjectTag} Application received - ${jobTitle} at ${companyName}`;
  const applicant = applicantFirstName || 'Applicant';
  const smtpLogoAsset = getSmtpLogoAsset();
  const graphLogoAsset = getGraphLogoAsset();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px;">
        <tr>
          <td style="padding: 24px 0 32px; text-align: center; border-bottom: 1px solid #e5e7eb;">
            <img src="${graphLogoAsset.src}" alt="${brand.orgName}" width="180" style="display: inline-block; max-width: 180px; height: auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 0 24px;">
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">Dear ${applicant},</p>
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">We acknowledge receipt of your application for the position of <strong>${jobTitle}</strong> at ${companyName}.</p>
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">Thank you for showing interest in joining our team.</p>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6;">Should your profile match our requirements, a member of our recruitment team will get in touch with you.</p>
            <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6;">We appreciate the effort you have put into your application and look forward to working together.</p>
            <p style="margin: 0 0 8px; font-size: 16px; line-height: 1.6;">Sincerely,</p>
            <p style="margin: 0 0 4px; font-size: 16px; line-height: 1.6;"><strong>Recruitment Team</strong></p>
            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #0B1D39;"><strong>${FROM_NAME}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 0; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #6b7280;">${getEmailFooterPlain()}</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  const graphResult = await sendViaMicrosoftGraph({
    to,
    subject,
    html,
    attachments: graphLogoAsset.attachments,
  });
  if (graphResult.sent) return graphResult;

  const transporter = getTransporter();
  if (!transporter) {
    return graphResult;
  }
  if (!FROM_EMAIL) {
    return {
      sent: false,
      reason: 'from_email_missing',
      error: 'From email is missing. Set SMTP_USER or SMTP_FROM_EMAIL.',
      diagnostics: {
        provider: 'smtp',
        ...getSmtpDiagnostics(),
      },
    };
  }

  try {
    const info = (await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      attachments: smtpLogoAsset.attachments,
    })) as { messageId?: string };
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sent: false,
      reason: 'smtp_error',
      error: message,
      diagnostics: {
        provider: 'smtp',
        ...getSmtpDiagnostics(),
      },
    };
  }
}

/**
 * Send "application not successful" / rejection email to an applicant.
 * Professional, sympathetic tone; encourages future applications.
 */
export async function sendApplicationRejectedEmail(params: {
  to: string;
  applicantFirstName: string;
  jobTitle: string;
  companyName: string;
}): Promise<EmailSendResult> {
  const { to, applicantFirstName, jobTitle, companyName } = params;
  const applicant = applicantFirstName || 'Applicant';
  const subject = `Update on your application – ${jobTitle} at ${companyName}`;
  const smtpLogoAsset = getSmtpLogoAsset();
  const graphLogoAsset = getGraphLogoAsset();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; color: #1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff;">
        <tr>
          <td style="padding: 32px 24px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
            <img src="${graphLogoAsset.src}" alt="${brand.orgName}" width="160" style="display: inline-block; max-width: 160px; height: auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 32px 32px;">
            <p style="margin: 0 0 20px; font-size: 17px; line-height: 1.6; color: #1f2937;">Dear ${applicant},</p>
            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.65; color: #374151;">Thank you for your interest in the position of <strong style="color: #0B1D39;">${jobTitle}</strong> at ${companyName} and for the time you invested in your application.</p>
            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.65; color: #374151;">After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs for this role.</p>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.65; color: #374151;">We encourage you to apply for future vacancies that match your skills and experience. We keep all applications on file and will consider you for suitable opportunities as they arise.</p>
            <p style="margin: 0 0 8px; font-size: 16px; line-height: 1.5; color: #1f2937;">Sincerely,</p>
            <p style="margin: 0 0 2px; font-size: 16px; font-weight: 600; color: #0B1D39;">Recruitment Team</p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #0B1D39;">${FROM_NAME}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #64748b;">${getEmailFooterPlain()}</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  const graphResult = await sendViaMicrosoftGraph({
    to,
    subject,
    html,
    attachments: graphLogoAsset.attachments,
  });
  if (graphResult.sent) return graphResult;

  const transporter = getTransporter();
  if (!transporter) return graphResult;
  if (!FROM_EMAIL) {
    return {
      sent: false,
      reason: 'from_email_missing',
      error: 'From email is missing. Set SMTP_USER or SMTP_FROM_EMAIL.',
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }

  try {
    const info = (await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      attachments: smtpLogoAsset.attachments,
    })) as { messageId?: string };
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sent: false,
      reason: 'smtp_error',
      error: message,
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }
}

/**
 * Send official interview invitation to candidate. From recruitment@, CC account holder.
 * Optional: attach official letter PDF (e.g. for government clients).
 * Includes links for candidate to confirm attendance or request reschedule.
 */
export async function sendInterviewInviteEmail(params: {
  interviewId: string;
  to: string;
  cc?: string;
  candidateFirstName: string;
  jobTitle: string;
  companyName: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  type: string; // phone | video | onsite
  locationOrLink?: string | null;
  notes?: string | null;
  officialLetterPath?: string | null; // e.g. /uploads/documents/xxx.pdf
}): Promise<EmailSendResult> {
  const {
    interviewId,
    to,
    cc,
    candidateFirstName,
    jobTitle,
    companyName,
    scheduledAt,
    durationMinutes,
    type,
    locationOrLink,
    notes,
    officialLetterPath,
  } = params;
  const token = createInterviewToken(interviewId);
  const confirmUrl = `${INVITE_LINK_BASE}/interview/confirm/${token}`;
  const rescheduleUrl = `${INVITE_LINK_BASE}/interview/reschedule/${token}`;
  const withdrawUrl = `${INVITE_LINK_BASE}/interview/withdraw/${token}`;
  const candidateName = candidateFirstName || 'Candidate';
  const typeLabel = type === 'phone' ? 'Phone' : type === 'video' ? 'Video' : 'On-site';
  const date = new Date(scheduledAt);
  const dateStr = Number.isNaN(date.getTime())
    ? scheduledAt
    : date.toLocaleDateString('en-KE', { dateStyle: 'long', timeZone: APP_TIMEZONE });
  const timeStr = Number.isNaN(date.getTime())
    ? ''
    : `${date.toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: APP_TIMEZONE,
      })} (EAT)`;
  const durationStr = `${durationMinutes} minutes`;
  const locationLine = locationOrLink?.trim()
    ? `Location / Link: ${locationOrLink.trim()}`
    : 'We will share the meeting details separately if applicable.';

  const subject = `Interview invitation – ${jobTitle} at ${companyName}`;
  const smtpLogoAsset = getSmtpLogoAsset();
  const graphLogoAsset = getGraphLogoAsset();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; color: #1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff;">
        <!-- Header -->
        <tr>
          <td style="padding: 32px 24px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
            <img src="${graphLogoAsset.src}" alt="${brand.orgName}" width="160" style="display: inline-block; max-width: 160px; height: auto;" />
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding: 40px 32px 32px;">
            <p style="margin: 0 0 20px; font-size: 17px; line-height: 1.6; color: #1f2937;">Dear ${candidateName},</p>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.65; color: #374151;">We are pleased to invite you for an interview for the position of <strong style="color: #0B1D39;">${jobTitle}</strong> at ${companyName}.</p>
            
            <!-- Interview details box -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 28px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <tr>
                <td style="padding: 24px;">
                  <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Interview details</p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="padding: 4px 0; font-size: 15px; line-height: 1.5; color: #334155;"><strong style="color: #475569;">Date:</strong> ${dateStr}</td></tr>
                    <tr><td style="padding: 4px 0; font-size: 15px; line-height: 1.5; color: #334155;"><strong style="color: #475569;">Time:</strong> ${timeStr}</td></tr>
                    <tr><td style="padding: 4px 0; font-size: 15px; line-height: 1.5; color: #334155;"><strong style="color: #475569;">Duration:</strong> ${durationStr}</td></tr>
                    <tr><td style="padding: 4px 0; font-size: 15px; line-height: 1.5; color: #334155;"><strong style="color: #475569;">Type:</strong> ${typeLabel}</td></tr>
                    <tr><td style="padding: 4px 0; font-size: 15px; line-height: 1.5; color: #334155;"><strong style="color: #475569;">${locationOrLink?.trim() ? 'Location / Link:' : 'Location:'}</strong> ${locationOrLink?.trim() || 'To be shared separately'}</td></tr>
                  </table>
                </td>
              </tr>
            </table>
            ${notes?.trim() ? `
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 24px; background-color: #fffbeb; border-radius: 8px; border: 1px solid #fde68a;">
              <tr>
                <td style="padding: 20px 24px;">
                  <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e;">Additional notes</p>
                  <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #78350f; white-space: pre-wrap;">${notes.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                </td>
              </tr>
            </table>
            ` : ''}
            ${officialLetterPath ? '<p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #64748b;">An official invitation letter is attached to this email.</p>' : ''}
            
            <!-- Action buttons -->
            <p style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #374151;">Please confirm your availability:</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 12px;">
              <tr>
                <td>
                  <a href="${confirmUrl}" style="display: block; width: 100%; padding: 14px 24px; background-color: #ffffff; color: #000000 !important; text-decoration: none; font-size: 15px; font-weight: 600; text-align: center; border-radius: 8px; border: 2px solid #16a34a;">Confirm attendance</a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 12px;">
              <tr>
                <td>
                  <a href="${rescheduleUrl}" style="display: block; width: 100%; padding: 14px 24px; background-color: #475569; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 500; text-align: center; border-radius: 8px; border: none;">Cannot attend / Request reschedule</a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 20px;">
              <tr>
                <td>
                  <a href="${withdrawUrl}" style="display: block; width: 100%; padding: 12px 24px; background-color: transparent; color: #b91c1c !important; text-decoration: none; font-size: 14px; font-weight: 500; text-align: center; border-radius: 8px; border: 2px solid #b91c1c;">Withdraw from role</a>
                </td>
              </tr>
            </table>
            <p style="margin: 0 0 32px; font-size: 13px; line-height: 1.5; color: #94a3b8;">You can also reply to this email if you prefer.</p>
            
            <!-- Signature -->
            <p style="margin: 0 0 4px; font-size: 16px; line-height: 1.5; color: #1f2937;">Sincerely,</p>
            <p style="margin: 0 0 2px; font-size: 16px; font-weight: 600; color: #0B1D39;">Recruitment Team</p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #0B1D39;">${FROM_NAME}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #64748b;">${getEmailFooterPlain()}</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  const graphAttachments: Array<Record<string, unknown>> = [...(graphLogoAsset.attachments || [])];
  const smtpAttachments: Array<{ filename: string; path?: string; content?: Buffer }> = [
    ...(smtpLogoAsset.attachments || []),
  ];
  if (officialLetterPath?.trim()) {
    const letterPath = resolve(process.cwd(), 'public', officialLetterPath.replace(/^\//, ''));
    if (existsSync(letterPath)) {
      const contentBytes = readFileSync(letterPath).toString('base64');
      graphAttachments.push({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: 'Interview-Letter.pdf',
        contentType: 'application/pdf',
        contentBytes,
      });
      smtpAttachments.push({ filename: 'Interview-Letter.pdf', path: letterPath });
    }
  }

  const graphResult = await sendViaMicrosoftGraph({
    to,
    cc,
    subject,
    html,
    attachments: graphAttachments,
  });
  if (graphResult.sent) return graphResult;

  const transporter = getTransporter();
  if (!transporter) return graphResult;
  if (!FROM_EMAIL) {
    return {
      sent: false,
      reason: 'from_email_missing',
      error: 'From email is missing. Set SMTP_USER or SMTP_FROM_EMAIL.',
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }
  try {
    const mailOptions: Parameters<typeof transporter.sendMail>[0] = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      cc: cc?.trim() || undefined,
      subject,
      html,
      attachments: smtpAttachments,
    };
    const info = (await transporter.sendMail(mailOptions)) as { messageId?: string };
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sent: false,
      reason: 'smtp_error',
      error: message,
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }
}

const SUBJECT_LABELS: Record<string, string> = {
  recruitment: 'Recruitment & Executive Search',
  outsourcing: 'HR Management',
  training: 'Training & Development',
  advisory: 'HR Advisory & Policy',
  payroll: 'Payroll Management',
  general: 'General Inquiry',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Send contact form submission to CONTACT_FORM_TO (default: info@example.com).
 */
export async function sendContactFormEmail(params: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
}): Promise<EmailSendResult> {
  const { name, email, phone, company, subject, message } = params;
  const subjectLabel = SUBJECT_LABELS[subject] || subject;
  const to = process.env.CONTACT_FORM_TO?.trim() || brand.contactEmail;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #0B1D39;">New contact form submission</h2>
      <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Subject: ${subjectLabel}</p>
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0; font-weight: 600; width: 120px;">Name</td><td style="padding: 8px 0;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 600;">Email</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        ${phone ? `<tr><td style="padding: 8px 0; font-weight: 600;">Phone</td><td style="padding: 8px 0;"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>` : ''}
        ${company ? `<tr><td style="padding: 8px 0; font-weight: 600;">Company</td><td style="padding: 8px 0;">${escapeHtml(company)}</td></tr>` : ''}
      </table>
      <div style="margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px;">
        <p style="margin: 0 0 8px; font-weight: 600;">Message</p>
        <p style="margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escapeHtml(message)}</p>
      </div>
      <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">Sent via ${FROM_NAME} contact form</p>
    </div>
  `;

  const emailSubject = `${emailSubjectTag} Contact Form - ${subjectLabel} - ${name}`;

  const graphResult = await sendViaMicrosoftGraph({
    to,
    subject: emailSubject,
    html,
  });
  if (graphResult.sent) return graphResult;

  const transporter = getTransporter();
  if (!transporter) return graphResult;
  if (!FROM_EMAIL) {
    return {
      sent: false,
      reason: 'from_email_missing',
      error: 'From email is missing. Set SMTP_USER or SMTP_FROM_EMAIL.',
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }

  try {
    const info = (await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: emailSubject,
      html,
    })) as { messageId?: string };
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      sent: false,
      reason: 'smtp_error',
      error: errMsg,
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }
}

/** Payslip data for email content */
export interface PayslipEmailData {
  employeeName: string;
  employeeNumber?: string | null;
  clientName: string;
  departmentName?: string | null;
  basicPay: string;
  allowances: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  grossPay: string;
  /** Included on payslip only when > 0 */
  leavePay?: string;
  paye: string;
  nssf: string;
  nhif: string;
  ahl: string;
  /** Employer NITA; informational on payslip, not deducted from net pay. */
  employerNita?: string;
  netPay: string;
  biweekly?: boolean;
  period1Gross?: string;
  period2Gross?: string;
  biweeklyAttendance?: { period1: string[]; period2: string[] };
}

const ACCOUNTS_FROM_NAME = accountsMailFromName;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatPayslipAmount(val: string | number): string {
  return Number(val).toLocaleString('en-KE', { minimumFractionDigits: 2 });
}

function buildPayslipHtml(data: PayslipEmailData, month: number, year: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? String(month);
  const allowancesRows = (data.allowances ?? []).map(
    (a) => `<tr><td style="padding:6px 0;color:#374151;">${a.name}</td><td style="text-align:right;font-family:monospace;color:#374151;">KES ${formatPayslipAmount(a.amount)}</td></tr>`
  ).join('');
  const leavePayNum = Number(data.leavePay ?? 0);
  const leavePayRow =
    leavePayNum > 0
      ? `<tr><td style="padding:6px 0;color:#374151;">Leave pay</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.leavePay!)}</td></tr>`
      : '';
  const wd = (dates: string[]) =>
    dates
      .map((iso) => {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      })
      .join(', ') || '—';
  const biweeklyBlock =
    data.biweekly && data.biweeklyAttendance
      ? `<tr><td style="padding:16px;background:#fff9f0;border:1px solid #ffe1b3;border-radius:8px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#0B1D39;">Bi-weekly — days worked (Mon–Sat)</p>
          <p style="margin:0 0 4px;font-size:11px;color:#374151;"><strong>Period 1</strong> (1st–15th) · KES ${formatPayslipAmount(data.period1Gross || 0)} · <strong>${data.biweeklyAttendance.period1.length}</strong> days</p>
          <p style="margin:0 0 8px;font-size:10px;color:#6b7280;">${wd(data.biweeklyAttendance.period1)}</p>
          <p style="margin:0 0 4px;font-size:11px;color:#374151;"><strong>Period 2</strong> (16th–end) · KES ${formatPayslipAmount(data.period2Gross || 0)} · <strong>${data.biweeklyAttendance.period2.length}</strong> days</p>
          <p style="margin:0;font-size:10px;color:#6b7280;">${wd(data.biweeklyAttendance.period2)}</p>
        </td></tr>`
      : '';
  const deductionsRows = (data.deductions ?? []).map(
    (d) => `<tr><td style="padding:6px 0;color:#374151;">${d.name}</td><td style="text-align:right;font-family:monospace;color:#374151;">KES ${formatPayslipAmount(d.amount)}</td></tr>`
  ).join('');
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#374151;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:24px 0 20px;text-align:center;border-bottom:2px solid #0B1D39;">
            <img src="${LOGO_URL}" alt="${brand.orgName}" width="160" style="display:inline-block;max-width:160px;height:auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 16px;">
            <p style="margin:0 0 8px;font-size:16px;">Dear ${data.employeeName},</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Please find your payslip for <strong>${monthName} ${year}</strong>.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              <tr>
                <td style="padding:0 0 8px;"><strong>Employee</strong></td>
                <td style="text-align:right;padding:0 0 8px;">${data.employeeName}${data.employeeNumber ? ` (${data.employeeNumber})` : ''}</td>
              </tr>
              <tr>
                <td style="padding:0 0 8px;"><strong>Client</strong></td>
                <td style="text-align:right;padding:0 0 8px;">${data.clientName}</td>
              </tr>
              ${data.departmentName ? `<tr><td style="padding:0 0 8px;"><strong>Department</strong></td><td style="text-align:right;padding:0 0 8px;">${data.departmentName}</td></tr>` : ''}
            </table>
          </td>
        </tr>
        ${biweeklyBlock}
        <tr>
          <td style="padding:20px 0 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">
              <tr><td colspan="2" style="padding:8px 0;font-weight:600;color:#0B1D39;border-bottom:1px solid #e5e7eb;">Earnings</td></tr>
              <tr><td style="padding:6px 0;color:#374151;">Basic pay</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.basicPay)}</td></tr>
              ${allowancesRows}
              ${leavePayRow}
              <tr><td style="padding:8px 0;font-weight:600;border-top:1px solid #e5e7eb;">Gross pay</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb;">KES ${formatPayslipAmount(data.grossPay)}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">
              <tr><td colspan="2" style="padding:8px 0;font-weight:600;color:#0B1D39;border-bottom:1px solid #e5e7eb;">Deductions</td></tr>
              <tr><td style="padding:6px 0;color:#374151;">PAYE</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.paye)}</td></tr>
              <tr><td style="padding:6px 0;color:#374151;">NSSF</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.nssf)}</td></tr>
              <tr><td style="padding:6px 0;color:#374151;">SHIF</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.nhif)}</td></tr>
              <tr><td style="padding:6px 0;color:#374151;">AHL (1.5%)</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.ahl ?? 0)}</td></tr>
              ${deductionsRows}
              <tr><td style="padding:8px 0;font-weight:600;color:#0B1D39;border-top:1px solid #e5e7eb;">Net pay</td><td style="text-align:right;font-weight:600;color:#0B1D39;border-top:1px solid #e5e7eb;">KES ${formatPayslipAmount(data.netPay)}</td></tr>
            </table>
          </td>
        </tr>
        ${
          Number(data.employerNita ?? 0) > 0
            ? `<tr>
          <td style="padding:12px 0 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;border-collapse:collapse;">
              <tr><td colspan="2" style="padding:8px 0;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Employer contributions (informational)</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">NITA levy (employer — not deducted from your pay)</td><td style="text-align:right;font-family:monospace;color:#6b7280;">KES ${formatPayslipAmount(data.employerNita!)}</td></tr>
            </table>
          </td>
        </tr>`
            : ''
        }
        <tr>
          <td style="padding:16px 0;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
            Computer-generated payslip. For queries, contact ${FROM_NAME}.
          </td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Send payslip email from ACCOUNTS_SMTP_USER.
 * Uses ACCOUNTS_SMTP_USER and ACCOUNTS_SMTP_PASS; falls back to SMTP_HOST/SMTP_PORT if ACCOUNTS_* not set.
 * Attaches a PDF version of the payslip while keeping the HTML body.
 */
export async function sendPayslipEmail(params: {
  to: string;
  employeeName: string;
  month: number;
  year: number;
  data: PayslipEmailData;
}): Promise<EmailSendResult> {
  const transporter = getAccountsTransporter();
  if (!transporter) {
    return {
      sent: false,
      reason: 'smtp_not_configured',
      error: 'Accounts SMTP not configured. Set ACCOUNTS_SMTP_USER and ACCOUNTS_SMTP_PASS.',
      diagnostics: {
        provider: 'smtp',
        host: process.env.ACCOUNTS_SMTP_HOST || process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.ACCOUNTS_SMTP_PORT || process.env.SMTP_PORT || '587', 10),
        secure: false,
        hasUser: Boolean(process.env.ACCOUNTS_SMTP_USER?.trim()),
        hasPass: Boolean(process.env.ACCOUNTS_SMTP_PASS),
        hasFromEmail: Boolean(process.env.ACCOUNTS_SMTP_USER?.trim()),
      },
    };
  }
  const from = process.env.ACCOUNTS_SMTP_USER?.trim();
  if (!from) {
    return {
      sent: false,
      reason: 'from_email_missing',
      error: 'ACCOUNTS_SMTP_USER is required as the from address.',
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }

  const config = getAccountsSmtpConfig();
  console.log('[sendPayslipEmail] Accounts SMTP config:', JSON.stringify(config, null, 0));

  const subject = `${emailSubjectTag} Payslip - ${MONTH_NAMES[(params.month || 1) - 1]} ${params.year}`;
  const html = buildPayslipHtml(params.data, params.month, params.year);
  const monthName = MONTH_NAMES[(params.month || 1) - 1];
  const pdfFilename = `Payslip_${params.data.employeeName.replace(/\s+/g, '_')}_${monthName}_${params.year}.pdf`;

  let attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  try {
    const pdfBuffer = await generatePayslipPdf(params.data, params.month, params.year);
    attachments = [{ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' }];
  } catch (pdfErr) {
    console.warn('[sendPayslipEmail] PDF generation failed, sending without attachment:', pdfErr);
  }

  try {
    console.log('[sendPayslipEmail] Verifying SMTP connection...');
    await transporter.verify();
    console.log('[sendPayslipEmail] SMTP verify OK, sending mail to', params.to, 'with PDF attachment');
    const info = (await transporter.sendMail({
      from: `"${ACCOUNTS_FROM_NAME}" <${from}>`,
      to: params.to,
      subject,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    })) as { messageId?: string };
    console.log('[sendPayslipEmail] Sent successfully, messageId:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errObj = err as { response?: string; responseCode?: number; command?: string; code?: string };
    console.error('[sendPayslipEmail] SMTP error:', {
      message,
      response: errObj.response,
      responseCode: errObj.responseCode,
      command: errObj.command,
      code: errObj.code,
      config: { host: config.host, port: config.port, user: config.user },
    });
    return {
      sent: false,
      reason: 'smtp_error',
      error: message,
      diagnostics: {
        provider: 'smtp',
        ...getSmtpDiagnostics(),
        host: config.host,
        port: config.port,
        secure: config.secure,
        smtpResponse: errObj.response,
        smtpResponseCode: errObj.responseCode,
      },
    };
  }
}

/** Send debtor/creditor statement PDF via accounts SMTP (same channel as payslips). */
export async function sendAccountStatementEmail(params: {
  to: string;
  partyName: string;
  partyType: 'client' | 'vendor';
  currency: string;
  closingBalance: number;
  pdfBuffer: Buffer;
  pdfFilename: string;
}): Promise<EmailSendResult> {
  const transporter = getAccountsTransporter();
  if (!transporter) {
    return {
      sent: false,
      reason: 'smtp_not_configured',
      error: 'Accounts SMTP not configured. Set ACCOUNTS_SMTP_USER and ACCOUNTS_SMTP_PASS.',
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }
  const from = process.env.ACCOUNTS_SMTP_USER?.trim();
  if (!from) {
    return {
      sent: false,
      reason: 'from_email_missing',
      error: 'ACCOUNTS_SMTP_USER is required as the from address.',
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }

  const label = params.partyType === 'client' ? 'debtor' : 'creditor';
  const subject = `${emailSubjectTag} Statement of account — ${params.partyName}`;
  const balanceFmt = params.closingBalance.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const html = `
    <p>Dear ${params.partyName},</p>
    <p>Please find attached your ${label} statement of account.</p>
    <p><strong>Closing balance:</strong> ${balanceFmt} ${params.currency}</p>
    <p>If you have any questions, reply to this email.</p>
    ${getEmailFooterPlain()}
  `;

  try {
    const info = (await transporter.sendMail({
      from: `"${ACCOUNTS_FROM_NAME}" <${from}>`,
      to: params.to,
      subject,
      html,
      attachments: [
        {
          filename: params.pdfFilename,
          content: params.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })) as { messageId?: string };
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sent: false,
      reason: 'smtp_error',
      error: message,
      diagnostics: { provider: 'smtp', ...getSmtpDiagnostics() },
    };
  }
}
