import { brand, emailSubjectTag, mailFromName } from '@/lib/brand';

export type NotificationEvent =
  | 'leave_submitted'
  | 'leave_approved'
  | 'leave_rejected'
  | 'credential_expiring'
  | 'credential_expired'
  | 'contract_expiring'
  | 'missing_clock_out'
  | 'payroll_generated'
  | 'payroll_approved'
  | 'payroll_locked'
  | 'payslip_ready'
  | 'rota_published'
  | 'shift_changed'
  | 'employee_created'
  | 'employee_terminated'
  | 'document_uploaded'
  | 'attendance_corrected'
  | 'password_changed'
  | 'user_invited'
  | 'profile_change_requested'
  | 'disciplinary_case_opened'
  | 'disciplinary_action_added'
  | 'disciplinary_acknowledged'
  | 'disciplinary_case_resolved'
  | 'grievance_submitted'
  | 'grievance_status_changed';

type TemplateResult = { subject: string; html: string };

function footerBits(): string {
  const lines: string[] = [];
  if (brand.contactAddress) lines.push(brand.contactAddress);
  if (brand.contactPhone) lines.push(brand.contactPhone);
  lines.push(brand.contactEmail);
  return lines.join('<br>\n        ');
}

function wrapInLayout(content: string): string {
  return `
    <div style="max-width:560px;margin:0 auto;font-family:Inter,Arial,sans-serif;color:#0B1F2A;line-height:1.6;">
      <div style="padding:24px 0;border-bottom:2px solid #0F766E;margin-bottom:24px;">
        <strong style="font-size:16px;color:#0F766E;">${mailFromName}</strong>
      </div>
      ${content}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;">
        ${footerBits()}
      </div>
    </div>
  `;
}

export function buildNotificationEmail(
  event: NotificationEvent,
  data: Record<string, unknown>
): TemplateResult {
  const appUrl = String(data.appUrl || '').replace(/\/$/, '');

  const templates: Partial<Record<NotificationEvent, (d: Record<string, unknown>) => TemplateResult>> = {
    leave_approved: (d) => ({
      subject: `${emailSubjectTag} Leave approved`,
      html: wrapInLayout(`
        <h2>Leave approved</h2>
        <p>Your ${d.leaveType || 'leave'} leave from ${d.startDate || '-'} to ${d.endDate || '-'} has been approved by ${d.approverName || 'your approver'}.</p>
        <p><a href="${appUrl}/ess/leave">View in portal</a></p>
      `),
    }),
    leave_rejected: (d) => ({
      subject: `${emailSubjectTag} Leave not approved`,
      html: wrapInLayout(`
        <h2>Leave not approved</h2>
        <p>Your ${d.leaveType || 'leave'} leave from ${d.startDate || '-'} to ${d.endDate || '-'} was not approved.</p>
        ${d.reason ? `<p>Reason: ${String(d.reason)}</p>` : ''}
        <p><a href="${appUrl}/ess/leave">View in portal</a></p>
      `),
    }),
    password_changed: (d) => ({
      subject: `${emailSubjectTag} Password changed`,
      html: wrapInLayout(`
        <h2>Password changed</h2>
        <p>Your password was changed on ${d.timestamp || new Date().toISOString()}.</p>
        <p>If you did not make this change, contact your administrator immediately.</p>
      `),
    }),
    user_invited: (d) => ({
      subject: `Welcome to ${brand.appName}`,
      html: wrapInLayout(`
        <h2>Welcome to ${brand.appName}</h2>
        <p>An account has been created for you.</p>
        <p>Email: ${d.email || '-'}</p>
        <p><a href="${d.loginUrl || `${appUrl}/dashboard/login`}">Log in to your account</a></p>
      `),
    }),
    payslip_ready: (d) => ({
      subject: `${emailSubjectTag} Payslip available - ${d.period || 'current period'}`,
      html: wrapInLayout(`
        <h2>Payslip available</h2>
        <p>Your payslip for ${d.period || 'this period'} is now available in the employee portal.</p>
        <p><a href="${appUrl}/ess/payslips">View payslip</a></p>
      `),
    }),
  };

  const builder = templates[event];
  if (!builder) {
    return {
      subject: `${emailSubjectTag} Notification`,
      html: wrapInLayout(`<p>${String(data.body || 'You have a new notification.')}</p>`),
    };
  }
  return builder(data);
}
