/**
 * Transactional email via Resend (no-reply@getstride.co.ke).
 * All sends go through sendEmail() on the branded HTML template.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Resend } from 'resend';
import {
  createAccountLinkToken,
  getAccountLinkPath,
  type AccountLinkPurpose,
} from '@/lib/account-link-token';
import { createInterviewToken } from '@/lib/interview-token';
import { generatePayslipPdf } from '@/lib/payslip-pdf';
import { APP_TIMEZONE } from '@/lib/timezone';
import {
  brand,
  emailSubjectTag,
  getSiteUrl,
  mailFromName,
} from '@/lib/brand';
import { STRIDE_WORDMARK_SRC } from '@/lib/brand-constants';
import {
  buildBrandedEmailHtml,
  escapeHtml,
  getEmailWordmarkUrl,
  EMAIL_WORDMARK_CID,
} from '@/lib/email-template';
import { STRIDE_PALETTE } from '@/lib/stride-palette';

const FROM_EMAIL = 'no-reply@getstride.co.ke';
const REPLY_TO = 'hello@raventechgroup.com';
const FROM_NAME = mailFromName;

const BASE_URL = getSiteUrl().replace(/\/$/, '');
const INVITE_LINK_BASE =
  (typeof process.env.INVITE_LINK_BASE === 'string' && process.env.INVITE_LINK_BASE.trim()) ||
  (process.env.NODE_ENV === 'development' && !process.env.VERCEL_URL
    ? 'http://localhost:3000'
    : BASE_URL);

const WORDMARK_FILE = resolve(process.cwd(), 'public', STRIDE_WORDMARK_SRC.replace(/^\//, ''));

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type EmailSendResult =
  | { sent: true; messageId?: string }
  | {
      sent: false;
      reason: 'resend_not_configured' | 'resend_error';
      error: string;
    };

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function logDevEmail(params: {
  to: string;
  subject: string;
  html: string;
  cc?: string;
  attachments?: EmailAttachment[];
}): EmailSendResult {
  console.log('[email] RESEND_API_KEY not set — logging email instead of sending:');
  console.log(JSON.stringify({ from: FROM_EMAIL, replyTo: REPLY_TO, ...params, html: `[${params.html.length} chars]` }, null, 2));
  return { sent: true, messageId: 'dev-console-log' };
}

/** Core send helper — all transactional email routes through here. */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  cc?: string;
  attachments?: EmailAttachment[];
}): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) return logDevEmail(params);

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: params.to,
    cc: params.cc?.trim() || undefined,
    replyTo: REPLY_TO,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  if (error) {
    return { sent: false, reason: 'resend_error', error: error.message };
  }
  return { sent: true, messageId: data?.id };
}

function absoluteAccountLink(purpose: AccountLinkPurpose, token: string): string {
  return `${BASE_URL}${getAccountLinkPath(purpose, token)}`;
}

export function buildStaffSetPasswordLink(userId: string, email: string): string {
  const token = createAccountLinkToken({ userId, email, purpose: 'staff_set_password' });
  return absoluteAccountLink('staff_set_password', token);
}

export function buildStaffResetPasswordLink(userId: string, email: string): string {
  const token = createAccountLinkToken({ userId, email, purpose: 'staff_reset_password' });
  return absoluteAccountLink('staff_reset_password', token);
}

export function buildEssSetPasswordLink(userId: string, email: string): string {
  const token = createAccountLinkToken({ userId, email, purpose: 'ess_set_password' });
  return absoluteAccountLink('ess_set_password', token);
}

export function buildEssResetPasswordLink(userId: string, email: string): string {
  const token = createAccountLinkToken({ userId, email, purpose: 'ess_reset_password' });
  return absoluteAccountLink('ess_reset_password', token);
}

/** Account invite — set-password link only, never plaintext password. */
export async function sendAccountInviteEmail(params: {
  to: string;
  name: string;
  portal: 'staff' | 'ess';
  userId: string;
}): Promise<EmailSendResult> {
  const setPasswordUrl =
    params.portal === 'ess'
      ? buildEssSetPasswordLink(params.userId, params.to)
      : buildStaffSetPasswordLink(params.userId, params.to);
  const portalLabel = params.portal === 'ess' ? 'Employee Self Service' : 'staff dashboard';

  const html = buildBrandedEmailHtml({
    title: `Welcome to ${brand.appName}`,
    content: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(params.name || 'there')},</p>
      <p style="margin:0 0 16px;">An account has been created for you on ${escapeHtml(brand.appName)}. Use the button below to set your password and access the ${escapeHtml(portalLabel)}.</p>
      <p style="margin:0 0 8px;font-size:14px;color:${STRIDE_PALETTE.warmSubtle};">Sign-in email: <strong>${escapeHtml(params.to)}</strong></p>
      <p style="margin:16px 0 0;font-size:13px;color:${STRIDE_PALETTE.warmSubtle};">This link expires in 48 hours. If you did not expect this email, you can ignore it.</p>
    `,
    cta: { label: 'Set your password', href: setPasswordUrl, variant: 'primary' },
  });

  return sendEmail({
    to: params.to,
    subject: `${emailSubjectTag} Welcome — set your password`,
    html,
  });
}

/** Password reset — link only. */
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  portal: 'staff' | 'ess';
  userId: string;
}): Promise<EmailSendResult> {
  const resetUrl =
    params.portal === 'ess'
      ? buildEssResetPasswordLink(params.userId, params.to)
      : buildStaffResetPasswordLink(params.userId, params.to);

  const html = buildBrandedEmailHtml({
    title: 'Reset your password',
    content: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(params.name || 'there')},</p>
      <p style="margin:0 0 16px;">We received a request to reset your ${escapeHtml(brand.appName)} password. Click the button below to choose a new password.</p>
      <p style="margin:16px 0 0;font-size:13px;color:${STRIDE_PALETTE.warmSubtle};">If you did not request this, you can safely ignore this email. The link expires in 48 hours.</p>
    `,
    cta: { label: 'Reset password', href: resetUrl, variant: 'primary' },
  });

  return sendEmail({
    to: params.to,
    subject: `${emailSubjectTag} Reset your password`,
    html,
  });
}

export async function sendApplicationReceivedEmail(params: {
  to: string;
  applicantFirstName: string;
  jobTitle: string;
  companyName: string;
  applicationId?: string;
}): Promise<EmailSendResult> {
  const { to, applicantFirstName, jobTitle, companyName } = params;
  const applicant = applicantFirstName || 'Applicant';

  const html = buildBrandedEmailHtml({
    title: 'Application received',
    content: `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(applicant)},</p>
      <p style="margin:0 0 16px;">We acknowledge receipt of your application for <strong>${escapeHtml(jobTitle)}</strong> at ${escapeHtml(companyName)}.</p>
      <p style="margin:0 0 16px;">Thank you for your interest in joining our team. Should your profile match our requirements, a member of our recruitment team will be in touch.</p>
      <p style="margin:0;">Sincerely,<br><strong>Recruitment Team</strong></p>
    `,
  });

  return sendEmail({ to, subject: `${emailSubjectTag} Application received — ${jobTitle} at ${companyName}`, html });
}

export async function sendApplicationRejectedEmail(params: {
  to: string;
  applicantFirstName: string;
  jobTitle: string;
  companyName: string;
}): Promise<EmailSendResult> {
  const { to, applicantFirstName, jobTitle, companyName } = params;
  const applicant = applicantFirstName || 'Applicant';

  const html = buildBrandedEmailHtml({
    title: 'Update on your application',
    content: `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(applicant)},</p>
      <p style="margin:0 0 16px;">Thank you for your interest in <strong>${escapeHtml(jobTitle)}</strong> at ${escapeHtml(companyName)}.</p>
      <p style="margin:0 0 16px;">After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
      <p style="margin:0;">We encourage you to apply for future vacancies. Sincerely,<br><strong>Recruitment Team</strong></p>
    `,
  });

  return sendEmail({ to, subject: `Update on your application — ${jobTitle} at ${companyName}`, html });
}

export async function sendInterviewInviteEmail(params: {
  interviewId: string;
  to: string;
  cc?: string;
  candidateFirstName: string;
  jobTitle: string;
  companyName: string;
  scheduledAt: string;
  durationMinutes: number;
  type: string;
  locationOrLink?: string | null;
  notes?: string | null;
  officialLetterPath?: string | null;
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
    : `${date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: APP_TIMEZONE })} (EAT)`;

  const notesBlock = notes?.trim()
    ? `<div style="margin:20px 0;padding:16px;background:${STRIDE_PALETTE.warningSubtle};border-radius:8px;border:1px solid #fde68a;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${STRIDE_PALETTE.warning};">Additional notes</p>
        <p style="margin:0;font-size:15px;white-space:pre-wrap;">${escapeHtml(notes.trim())}</p>
      </div>`
    : '';

  const html = buildBrandedEmailHtml({
    title: 'Interview invitation',
    content: `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(candidateName)},</p>
      <p style="margin:0 0 20px;">We are pleased to invite you for an interview for <strong>${escapeHtml(jobTitle)}</strong> at ${escapeHtml(companyName)}.</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;background:${STRIDE_PALETTE.paper};border-radius:8px;border:1px solid ${STRIDE_PALETTE.line};">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;text-transform:uppercase;color:${STRIDE_PALETTE.warmSubtle};">Interview details</p>
          <p style="margin:4px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>
          <p style="margin:4px 0;"><strong>Time:</strong> ${escapeHtml(timeStr)}</p>
          <p style="margin:4px 0;"><strong>Duration:</strong> ${durationMinutes} minutes</p>
          <p style="margin:4px 0;"><strong>Type:</strong> ${escapeHtml(typeLabel)}</p>
          <p style="margin:4px 0;"><strong>Location:</strong> ${escapeHtml(locationOrLink?.trim() || 'To be shared separately')}</p>
        </td></tr>
      </table>
      ${notesBlock}
      ${officialLetterPath ? '<p style="font-size:14px;color:' + STRIDE_PALETTE.warmSubtle + ';">An official invitation letter is attached.</p>' : ''}
      <p style="margin:20px 0 12px;font-size:14px;font-weight:600;">Please confirm your availability:</p>
    `,
    ctas: [
      { label: 'Confirm attendance', href: confirmUrl, variant: 'primary' },
      { label: 'Request reschedule', href: rescheduleUrl, variant: 'secondary' },
      { label: 'Withdraw from role', href: withdrawUrl, variant: 'danger' },
    ],
  });

  const attachments: EmailAttachment[] = [];
  if (officialLetterPath?.trim()) {
    const letterPath = resolve(process.cwd(), 'public', officialLetterPath.replace(/^\//, ''));
    if (existsSync(letterPath)) {
      attachments.push({
        filename: 'Interview-Letter.pdf',
        content: readFileSync(letterPath),
        contentType: 'application/pdf',
      });
    }
  }

  return sendEmail({ to, cc, subject: `Interview invitation — ${jobTitle} at ${companyName}`, html, attachments });
}

const SUBJECT_LABELS: Record<string, string> = {
  recruitment: 'Recruitment & Executive Search',
  outsourcing: 'HR Management',
  training: 'Training & Development',
  advisory: 'HR Advisory & Policy',
  payroll: 'Payroll Management',
  general: 'General Inquiry',
};

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

  const rows = [
    `<tr><td style="padding:8px 0;font-weight:600;width:120px;">Name</td><td>${escapeHtml(name)}</td></tr>`,
    `<tr><td style="padding:8px 0;font-weight:600;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>`,
    phone ? `<tr><td style="padding:8px 0;font-weight:600;">Phone</td><td>${escapeHtml(phone)}</td></tr>` : '',
    company ? `<tr><td style="padding:8px 0;font-weight:600;">Company</td><td>${escapeHtml(company)}</td></tr>` : '',
  ].join('');

  const html = buildBrandedEmailHtml({
    title: 'New contact form submission',
    content: `
      <p style="margin:0 0 8px;font-size:14px;color:${STRIDE_PALETTE.warmSubtle};">Subject: ${escapeHtml(subjectLabel)}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">${rows}</table>
      <div style="padding:16px;background:${STRIDE_PALETTE.paper};border-radius:8px;">
        <p style="margin:0 0 8px;font-weight:600;">Message</p>
        <p style="margin:0;white-space:pre-wrap;font-size:14px;">${escapeHtml(message)}</p>
      </div>
    `,
  });

  return sendEmail({ to, subject: `${emailSubjectTag} Contact Form — ${subjectLabel} — ${name}`, html });
}

export interface PayslipEmailData {
  employeeName: string;
  employeeNumber?: string | null;
  clientName: string;
  departmentName?: string | null;
  basicPay: string;
  allowances: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  grossPay: string;
  leavePay?: string;
  paye: string;
  nssf: string;
  nhif: string;
  ahl: string;
  employerNita?: string;
  netPay: string;
  biweekly?: boolean;
  period1Gross?: string;
  period2Gross?: string;
  biweeklyAttendance?: { period1: string[]; period2: string[] };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatPayslipAmount(val: string | number): string {
  return Number(val).toLocaleString('en-KE', { minimumFractionDigits: 2 });
}

function buildPayslipContent(data: PayslipEmailData, month: number, year: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? String(month);
  const allowancesRows = (data.allowances ?? [])
    .map((a) => `<tr><td style="padding:6px 0;">${escapeHtml(a.name)}</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(a.amount)}</td></tr>`)
    .join('');
  const leavePayNum = Number(data.leavePay ?? 0);
  const leavePayRow =
    leavePayNum > 0
      ? `<tr><td style="padding:6px 0;">Leave pay</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.leavePay!)}</td></tr>`
      : '';
  const deductionsRows = (data.deductions ?? [])
    .map((d) => `<tr><td style="padding:6px 0;">${escapeHtml(d.name)}</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(d.amount)}</td></tr>`)
    .join('');

  return `
    <p style="margin:0 0 8px;">Dear ${escapeHtml(data.employeeName)},</p>
    <p style="margin:0 0 20px;">Please find your payslip for <strong>${monthName} ${year}</strong> attached as a PDF. Summary below:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:16px;">
      <tr><td><strong>Employee</strong></td><td style="text-align:right;">${escapeHtml(data.employeeName)}${data.employeeNumber ? ` (${escapeHtml(data.employeeNumber)})` : ''}</td></tr>
      <tr><td><strong>Client</strong></td><td style="text-align:right;">${escapeHtml(data.clientName)}</td></tr>
      ${data.departmentName ? `<tr><td><strong>Department</strong></td><td style="text-align:right;">${escapeHtml(data.departmentName)}</td></tr>` : ''}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">
      <tr><td colspan="2" style="padding:8px 0;font-weight:600;border-bottom:1px solid ${STRIDE_PALETTE.line};">Earnings</td></tr>
      <tr><td>Basic pay</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.basicPay)}</td></tr>
      ${allowancesRows}${leavePayRow}
      <tr><td style="font-weight:600;border-top:1px solid ${STRIDE_PALETTE.line};">Gross pay</td><td style="text-align:right;font-weight:600;border-top:1px solid ${STRIDE_PALETTE.line};">KES ${formatPayslipAmount(data.grossPay)}</td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;margin-top:16px;">
      <tr><td colspan="2" style="padding:8px 0;font-weight:600;border-bottom:1px solid ${STRIDE_PALETTE.line};">Deductions</td></tr>
      <tr><td>PAYE</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.paye)}</td></tr>
      <tr><td>NSSF</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.nssf)}</td></tr>
      <tr><td>SHIF</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.nhif)}</td></tr>
      <tr><td>AHL</td><td style="text-align:right;font-family:monospace;">KES ${formatPayslipAmount(data.ahl ?? 0)}</td></tr>
      ${deductionsRows}
      <tr><td style="font-weight:600;color:${STRIDE_PALETTE.coral};border-top:1px solid ${STRIDE_PALETTE.line};">Net pay</td><td style="text-align:right;font-weight:600;color:${STRIDE_PALETTE.coral};border-top:1px solid ${STRIDE_PALETTE.line};">KES ${formatPayslipAmount(data.netPay)}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:${STRIDE_PALETTE.warmSubtle};">Computer-generated payslip. For queries, reply to this email.</p>
  `;
}

export async function sendPayslipEmail(params: {
  to: string;
  employeeName: string;
  month: number;
  year: number;
  data: PayslipEmailData;
}): Promise<EmailSendResult> {
  const monthName = MONTH_NAMES[(params.month || 1) - 1];
  const subject = `${emailSubjectTag} Payslip — ${monthName} ${params.year}`;
  const html = buildBrandedEmailHtml({
    title: `Payslip — ${monthName} ${params.year}`,
    content: buildPayslipContent(params.data, params.month, params.year),
    wordmarkSrc: getEmailWordmarkUrl(),
  });

  const pdfFilename = `Payslip_${params.data.employeeName.replace(/\s+/g, '_')}_${monthName}_${params.year}.pdf`;
  const attachments: EmailAttachment[] = [];
  try {
    const pdfBuffer = await generatePayslipPdf(params.data, params.month, params.year);
    attachments.push({ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' });
  } catch (pdfErr) {
    console.warn('[sendPayslipEmail] PDF generation failed, sending without attachment:', pdfErr);
  }

  return sendEmail({ to: params.to, subject, html, attachments });
}

export async function sendAccountStatementEmail(params: {
  to: string;
  partyName: string;
  partyType: 'client' | 'vendor';
  currency: string;
  closingBalance: number;
  pdfBuffer: Buffer;
  pdfFilename: string;
}): Promise<EmailSendResult> {
  const label = params.partyType === 'client' ? 'debtor' : 'creditor';
  const balanceFmt = params.closingBalance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const html = buildBrandedEmailHtml({
    title: 'Statement of account',
    content: `
      <p style="margin:0 0 16px;">Dear ${escapeHtml(params.partyName)},</p>
      <p style="margin:0 0 16px;">Please find attached your ${label} statement of account.</p>
      <p style="margin:0;"><strong>Closing balance:</strong> ${balanceFmt} ${escapeHtml(params.currency)}</p>
      <p style="margin:16px 0 0;font-size:14px;">If you have any questions, reply to this email.</p>
    `,
  });

  return sendEmail({
    to: params.to,
    subject: `${emailSubjectTag} Statement of account — ${params.partyName}`,
    html,
    attachments: [{ filename: params.pdfFilename, content: params.pdfBuffer, contentType: 'application/pdf' }],
  });
}

/** Branded wrapper for notification system HTML fragments. */
export function wrapNotificationHtml(content: string, title?: string): string {
  return buildBrandedEmailHtml({ title, content });
}

/** Smoke-test send for Resend verification (RAV-243 AC). */
export async function sendResendTestEmail(to: string): Promise<EmailSendResult> {
  const html = buildBrandedEmailHtml({
    title: 'Resend test',
    content: `<p style="margin:0;">This is a test email from ${escapeHtml(brand.appName)} via Resend (<code>${escapeHtml(FROM_EMAIL)}</code>).</p>`,
    wordmarkSrc: existsSync(WORDMARK_FILE) ? `cid:${EMAIL_WORDMARK_CID}` : getEmailWordmarkUrl(),
  });
  return sendEmail({ to, subject: `${emailSubjectTag} Resend provider test`, html });
}
