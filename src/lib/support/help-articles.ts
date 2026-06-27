export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  category: string;
  body: string[];
  relatedTicketCategory?: string;
};

export const HELP_ARTICLE_CATEGORIES = [
  'Getting started',
  'Payroll & statutory',
  'People & leave',
  'Access & security',
  'Billing & account',
] as const;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'workspace-modules',
    title: 'Switching modules and company context',
    summary: 'Use the workspace control in the top bar to move between Finance, HR, Legal, and other modules.',
    category: 'Getting started',
    body: [
      'The module switcher changes which pages appear in your sidebar — payroll lives under HR & Payroll, invoices under Finance, and so on.',
      'The company context switcher scopes data to a legal entity (Kenya vs Uganda, KES vs UGX). Reports, payroll runs, and statutory filings respect the active entity.',
      'Pinned pages and ⌘K search work across modules; your module order can be customized under Settings → Module order.',
    ],
    relatedTicketCategory: 'service_request',
  },
  {
    id: 'payroll-cutoff',
    title: 'Payroll cut-off and disbursement timing',
    summary: 'Understand when payroll locks, how M-Pesa batches run, and what to do if a run fails.',
    category: 'Payroll & statutory',
    body: [
      'Payroll cut-off day is set in Settings and controls when a period stops accepting changes before processing.',
      'After approval, disbursement batches queue M-Pesa or bank payments. Failed lines stay in the batch with a reason code — you can retry without re-running the whole payroll.',
      'PAYE, NSSF, NHIF, and Housing Levy returns are generated from the same payroll period. Re-open the period only if your administrator has enabled corrections.',
    ],
    relatedTicketCategory: 'payroll_statutory',
  },
  {
    id: 'statutory-filings',
    title: 'KRA, NSSF, and statutory returns',
    summary: 'Filing calendars, export formats, and common rejection reasons.',
    category: 'Payroll & statutory',
    body: [
      'Statutory exports use the active company entity’s configuration. Confirm the correct entity is selected before downloading P9, PAYE, or NSSF schedules.',
      'If KRA rejects a file, check employee KRA PINs and tax status in the employee profile — mismatched IDs are the most common cause.',
      'Multi-entity accounts file separately per country; consolidated dashboards are for reporting only, not filing.',
    ],
    relatedTicketCategory: 'payroll_statutory',
  },
  {
    id: 'leave-approvals',
    title: 'Leave balances and approval chains',
    summary: 'How approvers are assigned, ESS self-service, and balance adjustments.',
    category: 'People & leave',
    body: [
      'Each employee’s manager (leave approver) receives applications in the dashboard and ESS team views.',
      'Leave types and accrual rules are configured per company. Negative balances may be blocked depending on policy.',
      'HR admins can post manual balance adjustments with a reason — these appear in the employee’s ledger.',
    ],
    relatedTicketCategory: 'service_request',
  },
  {
    id: 'roles-permissions',
    title: 'Roles, permissions, and SSO',
    summary: 'Admin vs staff access, Microsoft sign-in, and inviting users.',
    category: 'Access & security',
    body: [
      'Organization admins manage users under Administration. Fine-grained permissions use role presets plus optional overrides.',
      'Microsoft 365 SSO is enabled per tenant in Company setup when your plan includes it.',
      'If a user cannot see a module, check both their role and your plan entitlements — locked modules show an upgrade badge in the module switcher.',
    ],
    relatedTicketCategory: 'access_permissions',
  },
  {
    id: 'data-import',
    title: 'Importing employees and opening balances',
    summary: 'CSV templates, validation errors, and safe rollback practices.',
    category: 'Getting started',
    body: [
      'Use the import templates from Employees → Import. Required columns vary by country pack.',
      'Validation runs before commit — fix rows in the error report and re-upload rather than partial imports.',
      'Opening balances for leave and payroll should be imported before the first live run to avoid duplicate accruals.',
    ],
    relatedTicketCategory: 'data_import',
  },
  {
    id: 'billing-seats',
    title: 'Plans, seats, and billing status',
    summary: 'What happens when you approach seat limits or if billing is past due.',
    category: 'Billing & account',
    body: [
      'Active employees and dashboard users count toward your seat limit. ESS-only users may be metered separately depending on plan.',
      'Past-due accounts retain read access for a grace period; new payroll runs and disbursements may be restricted.',
      'Contact your account owner or raise a billing ticket below for invoice copies or plan changes.',
    ],
    relatedTicketCategory: 'billing_account',
  },
  {
    id: 'incidents',
    title: 'Reporting an outage or error',
    summary: 'What to include so Raven support can reproduce and resolve quickly.',
    category: 'Getting started',
    body: [
      'Note the page URL, active module, company entity, and the approximate time the issue started.',
      'Screenshots and export IDs (payroll run, batch, employee number) speed up triage.',
      'For urgent payroll-blocking issues, set priority to Urgent and include a callback number.',
    ],
    relatedTicketCategory: 'incident',
  },
];
