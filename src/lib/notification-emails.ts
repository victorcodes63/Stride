import { brand, emailSubjectTag } from '@/lib/brand';
import { buildBrandedEmailHtml, escapeHtml } from '@/lib/email-template';
import { STRIDE_PALETTE } from '@/lib/stride-palette';

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
  | 'grievance_status_changed'
  | 'onboarding_task_overdue'
  | 'mfa_enabled';

type TemplateResult = { subject: string; html: string };

export function buildNotificationEmail(
  event: NotificationEvent,
  data: Record<string, unknown>,
): TemplateResult {
  const appUrl = String(data.appUrl || '').replace(/\/$/, '');

  const templates: Partial<Record<NotificationEvent, (d: Record<string, unknown>) => TemplateResult>> = {
    leave_submitted: (d) => ({
      subject: `${emailSubjectTag} Leave request submitted`,
      html: buildBrandedEmailHtml({
        title: 'Leave request submitted',
        content: `<p style="margin:0 0 12px;">${escapeHtml(String(d.employeeName || 'An employee'))} submitted a ${escapeHtml(String(d.leaveType || 'leave'))} request from ${escapeHtml(String(d.startDate || '-'))} to ${escapeHtml(String(d.endDate || '-'))}.</p>`,
        cta: appUrl ? { label: 'Review request', href: `${appUrl}/dashboard/leave`, variant: 'primary' } : undefined,
      }),
    }),
    leave_approved: (d) => ({
      subject: `${emailSubjectTag} Leave approved`,
      html: buildBrandedEmailHtml({
        title: 'Leave approved',
        content: `<p style="margin:0 0 12px;">Your ${escapeHtml(String(d.leaveType || 'leave'))} leave from ${escapeHtml(String(d.startDate || '-'))} to ${escapeHtml(String(d.endDate || '-'))} has been approved${d.approverName ? ` by ${escapeHtml(String(d.approverName))}` : ''}.</p>`,
        cta: appUrl ? { label: 'View in portal', href: `${appUrl}/ess/leave`, variant: 'primary' } : undefined,
      }),
    }),
    leave_rejected: (d) => ({
      subject: `${emailSubjectTag} Leave not approved`,
      html: buildBrandedEmailHtml({
        title: 'Leave not approved',
        content: `<p style="margin:0 0 12px;">Your ${escapeHtml(String(d.leaveType || 'leave'))} leave from ${escapeHtml(String(d.startDate || '-'))} to ${escapeHtml(String(d.endDate || '-'))} was not approved.</p>${d.reason ? `<p style="margin:0;">Reason: ${escapeHtml(String(d.reason))}</p>` : ''}`,
        cta: appUrl ? { label: 'View in portal', href: `${appUrl}/ess/leave`, variant: 'primary' } : undefined,
      }),
    }),
    password_changed: (d) => ({
      subject: `${emailSubjectTag} Password changed`,
      html: buildBrandedEmailHtml({
        title: 'Password changed',
        content: `<p style="margin:0 0 12px;">Your ${escapeHtml(brand.appName)} password was changed on ${escapeHtml(String(d.timestamp || new Date().toISOString()))}.</p><p style="margin:0;">If you did not make this change, contact your administrator immediately.</p>`,
      }),
    }),
    user_invited: (d) => ({
      subject: `${emailSubjectTag} Welcome — set your password`,
      html: buildBrandedEmailHtml({
        title: `Welcome to ${brand.appName}`,
        content: `<p style="margin:0 0 12px;">An account has been created for ${escapeHtml(String(d.email || 'you'))}.</p><p style="margin:0;">Use the button below to set your password. This link expires in 48 hours.</p>`,
        cta: d.setPasswordUrl
          ? { label: 'Set your password', href: String(d.setPasswordUrl), variant: 'primary' }
          : d.loginUrl
            ? { label: 'Sign in', href: String(d.loginUrl), variant: 'primary' }
            : undefined,
      }),
    }),
    payslip_ready: (d) => ({
      subject: `${emailSubjectTag} Payslip available — ${d.period || 'current period'}`,
      html: buildBrandedEmailHtml({
        title: 'Payslip available',
        content: `<p style="margin:0;">Your payslip for ${escapeHtml(String(d.period || 'this period'))} is now available in the employee portal.</p>`,
        cta: appUrl ? { label: 'View payslip', href: `${appUrl}/ess/payslips`, variant: 'primary' } : undefined,
      }),
    }),
    payroll_generated: (d) => ({
      subject: `${emailSubjectTag} Payroll run generated`,
      html: buildBrandedEmailHtml({
        title: 'Payroll run ready for review',
        content: `<p style="margin:0;">Payroll for ${escapeHtml(String(d.period || 'the current period'))} has been generated and is ready for review.</p>`,
        cta: appUrl ? { label: 'Open payroll', href: `${appUrl}/dashboard/payroll`, variant: 'primary' } : undefined,
      }),
    }),
    payroll_approved: (d) => ({
      subject: `${emailSubjectTag} Payroll approved`,
      html: buildBrandedEmailHtml({
        title: 'Payroll approved',
        content: `<p style="margin:0;">Payroll for ${escapeHtml(String(d.period || 'the current period'))} has been approved.</p>`,
      }),
    }),
    onboarding_task_overdue: (d) => ({
      subject: `${emailSubjectTag} Overdue onboarding task`,
      html: buildBrandedEmailHtml({
        title: 'Overdue onboarding task',
        content: `<p style="margin:0;">${escapeHtml(String(d.body || 'An onboarding task is overdue.'))}</p>`,
        cta: d.href ? { label: 'View task', href: `${appUrl}${String(d.href)}`, variant: 'primary' } : undefined,
      }),
    }),
    mfa_enabled: () => ({
      subject: `${emailSubjectTag} Two-factor authentication enabled`,
      html: buildBrandedEmailHtml({
        title: 'Two-factor authentication enabled',
        content: `<p style="margin:0 0 12px;">Two-factor authentication (MFA) was enabled on your ${escapeHtml(brand.appName)} account.</p><p style="margin:0;">If you did not enable this, contact your administrator immediately.</p>`,
      }),
    }),
    credential_expiring: (d) => ({
      subject: `${emailSubjectTag} Credential expiring soon`,
      html: buildBrandedEmailHtml({
        title: 'Credential expiring',
        content: `<p style="margin:0;">${escapeHtml(String(d.body || 'A credential is expiring soon.'))}</p>`,
        cta: appUrl ? { label: 'View credentials', href: `${appUrl}/ess/credentials`, variant: 'primary' } : undefined,
      }),
    }),
    employee_created: (d) => ({
      subject: `${emailSubjectTag} ${String(d.title || 'HR notification')}`,
      html: buildBrandedEmailHtml({
        title: String(d.title || 'Notification'),
        content: `<p style="margin:0;">${escapeHtml(String(d.body || 'You have a new HR notification.'))}</p>`,
        cta: d.href && appUrl ? { label: 'Open', href: `${appUrl}${String(d.href)}`, variant: 'primary' } : undefined,
      }),
    }),
  };

  const builder = templates[event];
  if (!builder) {
    return {
      subject: `${emailSubjectTag} Notification`,
      html: buildBrandedEmailHtml({
        content: `<p style="margin:0;">${escapeHtml(String(data.body || 'You have a new notification.'))}</p>`,
      }),
    };
  }
  return builder(data);
}
