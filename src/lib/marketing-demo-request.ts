import { sendEmail } from '@/lib/email';
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function notifyDemoRequest(payload: DemoRequestPayload) {
  const to = process.env.MARKETING_LEADS_TO?.trim() || brandConfig.supportEmail;
  const name = `${payload.firstName} ${payload.lastName}`.trim();

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1A1714;">
      <h2 style="margin: 0 0 8px; font-size: 20px;">New Stride demo request</h2>
      <p style="margin: 0 0 24px; color: #3D3833;">Submitted via the Book a demo page.</p>
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #8A8076; width: 140px;">Name</td><td style="padding: 8px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #8A8076;">Email</td><td style="padding: 8px 0;">${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding: 8px 0; color: #8A8076;">Company</td><td style="padding: 8px 0;">${escapeHtml(payload.company)}</td></tr>
        <tr><td style="padding: 8px 0; color: #8A8076;">Team size</td><td style="padding: 8px 0;">${escapeHtml(payload.teamSize || '—')}</td></tr>
        <tr><td style="padding: 8px 0; color: #8A8076;">Modules</td><td style="padding: 8px 0;">${escapeHtml(payload.modules.length ? payload.modules.join(', ') : '—')}</td></tr>
        ${
          payload.otherModule
            ? `<tr><td style="padding: 8px 0; color: #8A8076;">Other module</td><td style="padding: 8px 0;">${escapeHtml(payload.otherModule)}</td></tr>`
            : ''
        }
        <tr><td style="padding: 8px 0; color: #8A8076;">Preferred date</td><td style="padding: 8px 0;">${escapeHtml(payload.preferredDate || '—')}${payload.preferredTime ? ` (${escapeHtml(payload.preferredTime)})` : ''}</td></tr>
        <tr><td style="padding: 8px 0; color: #8A8076;">Interest</td><td style="padding: 8px 0;">${escapeHtml(payload.interest)}</td></tr>
      </table>
      ${
        payload.message
          ? `<p style="margin: 24px 0 8px; color: #8A8076; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Message</p><p style="margin: 0; white-space: pre-wrap;">${escapeHtml(payload.message)}</p>`
          : ''
      }
    </div>
  `;

  return sendEmail({
    to,
    subject: `[Stride] Demo request — ${payload.company} (${name})`,
    html,
  });
}
