/**
 * Send every Stride transactional email template to a test inbox,
 * or export HTML previews when RESEND_API_KEY is missing.
 *
 * Usage:
 *   npx tsx scripts/send-all-test-emails.ts [to@example.com]
 *   npx tsx scripts/send-all-test-emails.ts --preview
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(filename: string) {
  try {
    const raw = readFileSync(resolve(process.cwd(), filename), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value && !process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env.resend.test');

import {
  sendAccountInviteEmail,
  sendAccountStatementEmail,
  sendApplicationReceivedEmail,
  sendApplicationRejectedEmail,
  sendContactFormEmail,
  sendInterviewInviteEmail,
  sendPasswordResetEmail,
  sendPayslipEmail,
  sendResendTestEmail,
  sendEmail,
} from '../src/lib/email';
import { buildBrandedEmailHtml, escapeHtml } from '../src/lib/email-template';
import {
  buildNotificationEmail,
  type NotificationEvent,
} from '../src/lib/notification-emails';
import { brand } from '../src/lib/brand';
import { brandConfig } from '../src/lib/brand.config';

const TO =
  process.argv.find((a) => a.includes('@'))?.trim() ||
  process.env.RESEND_TEST_TO?.trim() ||
  'vichumo38@gmail.com';
const PREVIEW_ONLY = process.argv.includes('--preview');

const APP_URL = 'https://app.getstride.co.ke';
const TEST_USER_ID = 'test-user-id-preview';

const NOTIFICATION_EVENTS: NotificationEvent[] = [
  'leave_submitted',
  'leave_approved',
  'leave_rejected',
  'credential_expiring',
  'credential_expired',
  'contract_expiring',
  'missing_clock_out',
  'payroll_generated',
  'payroll_approved',
  'payroll_locked',
  'payslip_ready',
  'rota_published',
  'shift_changed',
  'employee_created',
  'employee_terminated',
  'document_uploaded',
  'attendance_corrected',
  'password_changed',
  'user_invited',
  'profile_change_requested',
  'disciplinary_case_opened',
  'disciplinary_action_added',
  'disciplinary_acknowledged',
  'disciplinary_case_resolved',
  'grievance_submitted',
  'grievance_status_changed',
  'onboarding_task_overdue',
  'mfa_enabled',
];

const SAMPLE_NOTIFICATION_DATA: Record<string, unknown> = {
  appUrl: APP_URL,
  employeeName: 'Jane Wanjiku',
  leaveType: 'Annual leave',
  startDate: '15 Jul 2026',
  endDate: '19 Jul 2026',
  approverName: 'HR Manager',
  reason: 'Peak season staffing requirements',
  timestamp: new Date().toLocaleString('en-KE'),
  email: TO,
  setPasswordUrl: `${APP_URL}/auth/set-password?token=preview`,
  period: 'June 2026',
  body: 'Sample notification body for preview purposes.',
  title: 'New employee record',
  href: '/dashboard/employees',
};

type EmailJob = {
  label: string;
  subject: string;
  html: string;
  send: () => Promise<{ sent: boolean; error?: string }>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(label: string) {
  return label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

async function buildJobs(): Promise<EmailJob[]> {
  const demoRequestHtml = buildBrandedEmailHtml({
    title: 'New demo request',
    content: `
      <p style="margin:0 0 16px;">A new product demo was requested via the marketing site.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
        <tr><td style="padding:8px 0;color:#8A8076;">Name</td><td style="padding:8px 0;">Victor Chumo</td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Email</td><td style="padding:8px 0;">${escapeHtml(TO)}</td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Company</td><td style="padding:8px 0;">Raven Tech Group</td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Team size</td><td style="padding:8px 0;">51–200</td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Modules</td><td style="padding:8px 0;">HR, Payroll, Leave</td></tr>
      </table>
      <p style="margin:16px 0 0;">Lead source: ${escapeHtml(brand.appName)} marketing site (preview).</p>
    `,
  });

  const notificationJobs = NOTIFICATION_EVENTS.map((event) => {
    const { subject, html } = buildNotificationEmail(event, SAMPLE_NOTIFICATION_DATA);
    return {
      label: `Notification — ${event}`,
      subject: `[Preview] ${subject}`,
      html,
      send: async () => {
        const r = await sendEmail({ to: TO, subject: `[Preview] ${subject}`, html });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    };
  });

  return [
    {
      label: 'Resend smoke test',
      subject: `[Preview] Resend provider test`,
      html: buildBrandedEmailHtml({
        title: 'Resend test',
        content: `<p style="margin:0;">Preview of the Resend smoke-test email from Stride.</p>`,
      }),
      send: async () => {
        const r = await sendResendTestEmail(TO);
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'Staff account invite',
      subject: `[Preview] Staff invite`,
      html: buildBrandedEmailHtml({
        title: 'Welcome — set your password',
        content: `<p style="margin:0;">Staff portal invite preview for ${escapeHtml(TO)}.</p>`,
      }),
      send: async () => {
        const r = await sendAccountInviteEmail({
          to: TO,
          name: 'Victor Chumo',
          portal: 'staff',
          userId: TEST_USER_ID,
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'ESS account invite',
      subject: `[Preview] ESS invite`,
      html: buildBrandedEmailHtml({
        title: 'Welcome — set your password',
        content: `<p style="margin:0;">ESS portal invite preview for ${escapeHtml(TO)}.</p>`,
      }),
      send: async () => {
        const r = await sendAccountInviteEmail({
          to: TO,
          name: 'Victor Chumo',
          portal: 'ess',
          userId: TEST_USER_ID,
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'Staff password reset',
      subject: `[Preview] Password reset`,
      html: buildBrandedEmailHtml({
        title: 'Reset your password',
        content: `<p style="margin:0;">Staff password reset preview.</p>`,
      }),
      send: async () => {
        const r = await sendPasswordResetEmail({
          to: TO,
          name: 'Victor Chumo',
          portal: 'staff',
          userId: TEST_USER_ID,
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'ESS password reset',
      subject: `[Preview] ESS password reset`,
      html: buildBrandedEmailHtml({
        title: 'Reset your password',
        content: `<p style="margin:0;">ESS password reset preview.</p>`,
      }),
      send: async () => {
        const r = await sendPasswordResetEmail({
          to: TO,
          name: 'Victor Chumo',
          portal: 'ess',
          userId: TEST_USER_ID,
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'ATS — application received',
      subject: `[Preview] Application received`,
      html: buildBrandedEmailHtml({
        title: 'Application received',
        content: `<p style="margin:0;">Your application for HR Business Partner at Raven Tech Group was received.</p>`,
      }),
      send: async () => {
        const r = await sendApplicationReceivedEmail({
          to: TO,
          applicantFirstName: 'Victor',
          jobTitle: 'HR Business Partner',
          companyName: 'Raven Tech Group',
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'ATS — application rejected',
      subject: `[Preview] Application update`,
      html: buildBrandedEmailHtml({
        title: 'Update on your application',
        content: `<p style="margin:0;">Application rejection email preview.</p>`,
      }),
      send: async () => {
        const r = await sendApplicationRejectedEmail({
          to: TO,
          applicantFirstName: 'Victor',
          jobTitle: 'HR Business Partner',
          companyName: 'Raven Tech Group',
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'ATS — interview invitation',
      subject: `[Preview] Interview invitation`,
      html: buildBrandedEmailHtml({
        title: 'Interview invitation',
        content: `<p style="margin:0;">Interview invite with confirm / reschedule / withdraw CTAs.</p>`,
        ctas: [
          { label: 'Confirm attendance', href: `${APP_URL}/interview/confirm/preview`, variant: 'primary' as const },
          { label: 'Request reschedule', href: `${APP_URL}/interview/reschedule/preview`, variant: 'secondary' as const },
        ],
      }),
      send: async () => {
        const r = await sendInterviewInviteEmail({
          interviewId: 'preview-interview-id',
          to: TO,
          candidateFirstName: 'Victor',
          jobTitle: 'HR Business Partner',
          companyName: 'Raven Tech Group',
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          durationMinutes: 45,
          type: 'video',
          locationOrLink: 'https://meet.google.com/stride-preview',
          notes: 'Please join 5 minutes early.',
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'Marketing — contact form',
      subject: `[Preview] Contact form`,
      html: buildBrandedEmailHtml({
        title: 'New contact form submission',
        content: `<p style="margin:0;">Internal contact form notification preview.</p>`,
      }),
      send: async () => {
        process.env.CONTACT_FORM_TO = TO;
        const r = await sendContactFormEmail({
          name: 'Victor Chumo',
          email: TO,
          phone: '+254 700 000 000',
          company: 'Raven Tech Group',
          subject: 'general',
          message: 'Preview of the contact form notification email.',
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'Marketing — demo request',
      subject: '[Stride] Demo request — Raven Tech Group (Victor Chumo)',
      html: demoRequestHtml,
      send: async () => {
        const r = await sendEmail({
          to: TO,
          subject: '[Stride] Demo request — Raven Tech Group (Victor Chumo)',
          html: demoRequestHtml,
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'Payroll — payslip',
      subject: `[Preview] Payslip`,
      html: buildBrandedEmailHtml({
        title: 'Payslip — June 2026',
        content: `<p style="margin:0;">Payslip email with PDF attachment preview.</p>`,
      }),
      send: async () => {
        const r = await sendPayslipEmail({
          to: TO,
          employeeName: 'Victor Chumo',
          month: 6,
          year: 2026,
          data: {
            employeeName: 'Victor Chumo',
            employeeNumber: 'EMP-001',
            clientName: 'Raven Tech Group',
            departmentName: 'Engineering',
            basicPay: '85000',
            allowances: [
              { name: 'House allowance', amount: 15000 },
              { name: 'Transport', amount: 5000 },
            ],
            deductions: [{ name: 'Salary advance', amount: 10000 }],
            grossPay: '105000',
            paye: '18500',
            nssf: '4320',
            nhif: '1700',
            ahl: '1080',
            netPay: '79400',
          },
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    {
      label: 'Finance — account statement',
      subject: `[Preview] Statement of account`,
      html: buildBrandedEmailHtml({
        title: 'Statement of account',
        content: `<p style="margin:0;">Account statement with PDF attachment preview.</p>`,
      }),
      send: async () => {
        const r = await sendAccountStatementEmail({
          to: TO,
          partyName: 'Raven Tech Group',
          partyType: 'client',
          currency: 'KES',
          closingBalance: 125000,
          pdfBuffer: Buffer.from('%PDF-1.4 preview'),
          pdfFilename: 'Statement_Raven_Tech_Group_Jun2026.pdf',
        });
        return { sent: r.sent, error: r.sent ? undefined : 'error' in r ? r.error : 'not sent' };
      },
    },
    ...notificationJobs,
  ];
}

async function main() {
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const jobs = await buildJobs();
  const previewDir = resolve(process.cwd(), 'email-previews');
  const indexLines: string[] = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stride email previews</title>',
    '<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem}',
    'a{display:block;padding:.75rem 1rem;margin:.5rem 0;border:1px solid #e7e5e4;border-radius:.5rem;text-decoration:none;color:#1c1917}',
    'a:hover{border-color:#e85d4c;background:#fff7f5}</style></head><body>',
    `<h1>Stride email previews</h1><p>${jobs.length} templates · generated ${new Date().toLocaleString()}</p>`,
  ];

  if (!hasResend && !PREVIEW_ONLY) {
    console.warn('RESEND_API_KEY is not set — exporting HTML previews only.');
    console.warn('Add your Resend key to Vercel (stride-platform) or app/.env.local, then re-run.\n');
  }

  console.log(
    hasResend && !PREVIEW_ONLY
      ? `Sending ${jobs.length} templates to ${TO}…\n`
      : `Writing ${jobs.length} HTML previews…\n`,
  );

  mkdirSync(previewDir, { recursive: true });
  const results: { label: string; ok: boolean; error?: string }[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]!;
    const filename = `${String(i + 1).padStart(2, '0')}-${slugify(job.label)}.html`;
    writeFileSync(resolve(previewDir, filename), job.html);
    indexLines.push(`<a href="./${filename}">${escapeHtml(job.label)}</a>`);

    if (hasResend && !PREVIEW_ONLY) {
      process.stdout.write(`[${i + 1}/${jobs.length}] ${job.label}… `);
      try {
        const result = await job.send();
        if (result.sent) {
          console.log('✓');
          results.push({ label: job.label, ok: true });
        } else {
          console.log(`✗ ${result.error ?? 'failed'}`);
          results.push({ label: job.label, ok: false, error: result.error });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`✗ ${msg}`);
        results.push({ label: job.label, ok: false, error: msg });
      }
      await sleep(600);
    } else {
      results.push({ label: job.label, ok: true });
    }
  }

  indexLines.push('</body></html>');
  writeFileSync(resolve(previewDir, 'index.html'), indexLines.join('\n'));

  const sent = results.filter((r) => r.ok).length;
  console.log(`\nPreviews: ${previewDir}/index.html`);

  if (hasResend && !PREVIEW_ONLY) {
    const failed = results.filter((r) => !r.ok);
    console.log(`Sent: ${sent}/${results.length} to ${TO}`);
    if (failed.length) {
      console.log('\nFailed:');
      for (const f of failed) console.log(`  - ${f.label}: ${f.error}`);
      process.exit(1);
    }
  } else {
    console.log(`Exported ${sent} HTML templates. Set RESEND_API_KEY and re-run to deliver to ${TO}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
