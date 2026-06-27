import { sendEmail } from '@/lib/email';
import { buildBrandedEmailHtml, escapeHtml } from '@/lib/email-template';
import { brandConfig } from '@/lib/brand.config';

export type DemoRequestPayload = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  teamSize: string;
  interest: string;
  modules: string[];
  /** Free-text module feedback when the lead picks "Something else". */
  otherModule: string;
  preferredDate: string;
  preferredTime: string;
  message: string;
};

export type DemoRequestNotifyResult = {
  sent: boolean;
  leadId: string;
  reason?: string;
  error?: string;
  webhookSent?: boolean;
};

function buildLeadId() {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function notifyMarketingLeadWebhook(payload: DemoRequestPayload, leadId: string) {
  const webhookUrl = process.env.MARKETING_LEADS_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  const name = `${payload.firstName} ${payload.lastName}`.trim();
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId,
        source: 'stride-marketing',
        name,
        email: payload.email,
        company: payload.company,
        teamSize: payload.teamSize,
        modules: payload.modules,
        preferredDate: payload.preferredDate,
        preferredTime: payload.preferredTime,
        message: payload.message,
      }),
    });
    return res.ok;
  } catch (error) {
    console.warn('[marketing/demo-request] Webhook failed:', error);
    return false;
  }
}

export async function notifyDemoRequest(payload: DemoRequestPayload): Promise<DemoRequestNotifyResult> {
  const leadId = buildLeadId();
  const to = process.env.MARKETING_LEADS_TO?.trim() || brandConfig.supportEmail;
  const name = `${payload.firstName} ${payload.lastName}`.trim();

  const webhookSent = await notifyMarketingLeadWebhook(payload, leadId);

  const html = buildBrandedEmailHtml({
    title: 'New demo request',
    content: `
      <p style="margin:0 0 16px;">Submitted via the Book a demo page.</p>
      <p style="margin:0 0 16px;font-size:12px;color:#8A8076;">Lead ID: ${escapeHtml(leadId)}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#8A8076;width:140px;">Name</td><td style="padding:8px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Email</td><td style="padding:8px 0;">${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Company</td><td style="padding:8px 0;">${escapeHtml(payload.company)}</td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Team size</td><td style="padding:8px 0;">${escapeHtml(payload.teamSize || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Modules</td><td style="padding:8px 0;">${escapeHtml(payload.modules.length ? payload.modules.join(', ') : '—')}</td></tr>
        ${
          payload.otherModule
            ? `<tr><td style="padding:8px 0;color:#8A8076;">Other module</td><td style="padding:8px 0;">${escapeHtml(payload.otherModule)}</td></tr>`
            : ''
        }
        <tr><td style="padding:8px 0;color:#8A8076;">Preferred date</td><td style="padding:8px 0;">${escapeHtml(payload.preferredDate || '—')}${payload.preferredTime ? ` (${escapeHtml(payload.preferredTime)})` : ''}</td></tr>
        <tr><td style="padding:8px 0;color:#8A8076;">Interest</td><td style="padding:8px 0;">${escapeHtml(payload.interest)}</td></tr>
      </table>
      ${
        payload.message
          ? `<p style="margin:24px 0 8px;color:#8A8076;font-size:12px;text-transform:uppercase;">Message</p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(payload.message)}</p>`
          : ''
      }
    `,
  });

  const emailResult = await sendEmail({
    to,
    subject: `[Stride] Demo request — ${payload.company} (${name})`,
    html,
  });

  if (!emailResult.sent) {
    console.info('[marketing/demo-request] Lead captured (email not sent):', {
      leadId,
      to,
      company: payload.company,
      email: payload.email,
      reason: emailResult.reason,
      webhookSent,
    });
  }

  return {
    sent: emailResult.sent,
    leadId,
    reason: emailResult.sent ? undefined : emailResult.reason,
    error: emailResult.sent ? undefined : emailResult.error,
    webhookSent,
  };
}
