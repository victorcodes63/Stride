#!/usr/bin/env node
/**
 * Generate Stride manual UAT checklist (HTML + PDF).
 * Usage: node scripts/generate-uat-checklist-pdf.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outHtml = path.join(root, 'docs/STRIDE-MANUAL-UAT-CHECKLIST.html');
const outPdf = path.join(root, 'docs/STRIDE-MANUAL-UAT-CHECKLIST.pdf');

const READINESS = {
  live: { label: 'Live', hint: 'Should work end-to-end with demo data' },
  partial: { label: 'Partial', hint: 'UI exists; some flows may be roadmap or limited' },
  planned: { label: 'Planned', hint: 'Mostly shell / roadmap — note gaps explicitly' },
};

function rows(items) {
  return items
    .map(
      (r) => `<tr>
  <td class="num"></td>
  <td><code>${r.path}</code><br><span class="muted">${r.label}</span></td>
  <td class="ready ${r.ready}">${READINESS[r.ready].label}</td>
  <td class="tick">☐</td>
  <td class="tick">☐</td>
  <td class="tick">☐</td>
  <td class="notes"></td>
</tr>`,
    )
    .join('\n');
}

function section(title, ready, checks) {
  const hint = READINESS[ready]?.hint ?? '';
  return `<section class="module-section">
  <h2>${title} <span class="badge ${ready}">${READINESS[ready].label}</span></h2>
  ${hint ? `<p class="hint">${hint}</p>` : ''}
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Page / route</th>
        <th>Status</th>
        <th>Pass</th>
        <th>Fail</th>
        <th>N/A</th>
        <th>Issues / notes</th>
      </tr>
    </thead>
    <tbody>
${rows(checks)}
    </tbody>
  </table>
</section>`;
}

function flowRows(items) {
  return items
    .map(
      (f) => `<tr>
  <td class="tick">☐</td>
  <td><strong>${f.title}</strong><br><span class="muted">${f.steps}</span></td>
  <td class="notes"></td>
</tr>`,
    )
    .join('\n');
}

const CRITICAL_FLOWS = [
  {
    title: 'Login & session',
    steps: 'Resolve email → password → dashboard loads with modules & overview KPIs (< 3s local DB)',
  },
  {
    title: 'Entity switcher',
    steps: 'Switch each vertical context — data/branding scopes correctly (6 sectors if multi-vertical seed)',
  },
  {
    title: 'Add employee',
    steps: 'People → Employees → Add employee → save → appears in list',
  },
  {
    title: 'Import / export',
    steps: 'Download template dropdown visible → download → import Excel (optional)',
  },
  {
    title: 'Leave approval',
    steps: 'Leave hub → pending queue → approve/reject → balance updates',
  },
  {
    title: 'Payroll run',
    steps: 'Payroll runs → validate → generate → review → approve → payslip PDF',
  },
  {
    title: 'M-Pesa disbursements',
    steps: 'Disbursements → select approved month → sandbox batch → poll status',
  },
  {
    title: 'Recruitment',
    steps: 'Job opening → application in pipeline → schedule interview',
  },
  {
    title: 'Onboarding workflow',
    steps: 'Start onboarding for employee → tasks appear for HR role',
  },
  {
    title: 'Finance invoice',
    steps: 'Create invoice → PDF preview → record receipt (if seeded)',
  },
  {
    title: 'Fleet trip',
    steps: 'Fleet → trips/orders → open trip → compliance/docs visible',
  },
  {
    title: 'ESS employee',
    steps: 'ESS login → payslips → leave request → profile',
  },
];

const KNOWN_GAPS = [
  ['General ledger & full accounting', 'Finance module is AR/AP focused — not a full ERP GL.'],
  ['Multi-currency consolidation', 'Entity switcher supports KE/UG; group consolidation is limited.'],
  ['Projects module', 'Marked planned — expect roadmap UI, not full PM suite.'],
  ['SACCO / Healthcare / Energy verticals', 'Vertical packs are planned/partial — sector pages may be shells.'],
  ['Procurement GRN & 3-way match', 'PR → LPO exists; full procure-to-pay may be incomplete.'],
  ['Sales CRM depth', 'Pipeline KPIs partial — not a full Salesforce replacement.'],
  ['Native mobile apps', 'ESS is PWA/web — no iOS/Android store apps.'],
  ['Biometric hardware', 'Device integration seeded for demo; production device sync varies by vendor.'],
  ['Control plane (billing)', 'Client provisioning, Paystack dunning — separate internal surface.'],
  ['SSO / Microsoft / Google', 'Only shown when configured per org — not default in local demo.'],
  ['Real M-Pesa / KRA live APIs', 'Sandbox/disbursement simulation in demo — not production tax filing.'],
  ['Workflow builder', 'Onboarding uses templates — custom workflow designer is limited.'],
  ['Document OCR / e-sign', 'Document storage exists; advanced e-sign integrations may be missing.'],
  ['Inventory / warehouse WMS', 'Fleet & assets cover logistics ops — not full WMS.'],
  ['Helpdesk / ITSM', 'No dedicated ticketing module — use tasks/onboarding/discipline.'],
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Stride Manual UAT Checklist</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.45; }
    h1 { font-size: 22pt; margin: 0 0 6px; color: #9f1239; }
    h2 { font-size: 13pt; margin: 18px 0 8px; page-break-after: avoid; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    h3 { font-size: 11pt; margin: 14px 0 6px; }
    p, li { margin: 4px 0; }
    .cover { page-break-after: always; padding-top: 24mm; }
    .subtitle { font-size: 12pt; color: #4b5563; margin-bottom: 20px; }
    .meta { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin: 12px 0; }
    .meta dt { font-weight: 600; float: left; width: 130px; clear: left; }
    .meta dd { margin-left: 140px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 9pt; }
    th, td { border: 1px solid #d1d5db; padding: 5px 6px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; font-weight: 600; }
    td.tick, th:nth-child(n+4):nth-child(-n+6) { width: 32px; text-align: center; }
    td.num { width: 22px; text-align: center; color: #6b7280; }
    td.notes { min-width: 120px; height: 28px; }
    td.ready { width: 52px; text-align: center; font-size: 8pt; font-weight: 600; }
    code { font-size: 8.5pt; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
    .muted { color: #6b7280; font-size: 8.5pt; }
    .hint { font-size: 9pt; color: #4b5563; font-style: italic; margin: 0 0 8px; }
    .badge { font-size: 8pt; padding: 2px 8px; border-radius: 999px; font-weight: 600; vertical-align: middle; }
    .badge.live, .ready.live { background: #dcfce7; color: #166534; }
    .badge.partial, .ready.partial { background: #fef3c7; color: #92400e; }
    .badge.planned, .ready.planned { background: #fee2e2; color: #991b1b; }
    .legend { display: flex; gap: 16px; flex-wrap: wrap; margin: 10px 0; font-size: 9pt; }
    .module-section { page-break-inside: avoid; }
    .module-section table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    .page-break { page-break-before: always; }
    ul.compact { margin: 6px 0; padding-left: 18px; }
    ul.compact li { margin: 2px 0; }
  </style>
</head>
<body>

<div class="cover">
  <h1>Stride — Manual UAT Checklist</h1>
  <p class="subtitle">Page-by-page verification for localhost / demo environment<br>Tick Pass · Fail · N/A and record issues in the notes column.</p>

  <dl class="meta">
    <dt>Document version</dt><dd>2026-07-08 (generated from app nav catalog)</dd>
    <dt>Environment</dt><dd>http://localhost:3000 — local PostgreSQL recommended</dd>
    <dt>Primary login</dt><dd><code>demo@demo.imara.co.ke</code> / <code>Demo@2026!</code></dd>
    <dt>HR login</dt><dd><code>hr@swiftfreight.imara.co.ke</code> (per active vertical)</dd>
    <dt>Finance login</dt><dd><code>finance@swiftfreight.imara.co.ke</code></dd>
    <dt>ESS login</dt><dd><code>moses.okello@swiftfreight.imara.co.ke</code> → /ess/login</dd>
    <dt>Tester name</dt><dd>_______________________________</dd>
    <dt>Test date</dt><dd>_______________________________</dd>
    <dt>Build / branch</dt><dd>_______________________________</dd>
  </dl>

  <h3>How to use this document</h3>
  <ol class="compact">
    <li>Work module-by-module using the module switcher (top bar) or sidebar.</li>
    <li>For each page: confirm it loads without console errors, shows sensible demo data, and primary actions work.</li>
    <li>Mark <strong>Pass</strong> if acceptable for demo/client UAT; <strong>Fail</strong> if broken; <strong>N/A</strong> if not licensed or not applicable.</li>
    <li>Log every Fail in the notes column and in the Issue Log (last section).</li>
    <li>Compare against <strong>Known platform gaps</strong> — some items are expected limitations, not bugs.</li>
  </ol>

  <div class="legend">
    <span><span class="badge live">Live</span> Production-ready target</span>
    <span><span class="badge partial">Partial</span> Some gaps expected</span>
    <span><span class="badge planned">Planned</span> Roadmap / shell UI</span>
  </div>
</div>

<section>
  <h2>Critical end-to-end flows</h2>
  <p>Complete these first — they cover the main sales demo story.</p>
  <table>
    <thead><tr><th>Done</th><th>Flow</th><th>Issues</th></tr></thead>
    <tbody>${flowRows(CRITICAL_FLOWS)}</tbody>
  </table>
</section>

<section>
  <h2>Vertical entity switcher (multi-sector demo)</h2>
  <p>Test each context from the top-bar company switcher after <code>demo:reseed:all-verticals</code>.</p>
  <table>
    <thead><tr><th>Done</th><th>Entity</th><th>Issues</th></tr></thead>
    <tbody>
      ${[
        'Heritage Members SACCO Ltd (imara-sacco__ke)',
        'Northline Kenya Ltd (petroleum-retail__ke)',
        'SwiftFreight East Africa Ltd (cargo-logistics__ke)',
        'Amani Medical Centre (hospital-healthcare__ke)',
        'Horizon Travels Ltd (travel-agency__ke)',
        'Kilimani Builders Ltd (construction__ke)',
      ]
        .map(
          (e) => `<tr><td class="tick">☐</td><td>${e}</td><td class="notes"></td></tr>`,
        )
        .join('\n')}
    </tbody>
  </table>
</section>

<div class="page-break"></div>

${section('Command center & platform', 'live', [
  { path: '/dashboard', label: 'Overview / command center', ready: 'live' },
  { path: '/dashboard/people', label: 'HR & Payroll hub', ready: 'live' },
  { path: '/dashboard/notifications', label: 'Notifications center', ready: 'live' },
  { path: '/dashboard/help', label: 'Help & support', ready: 'live' },
])}

${section('01 — HR & Payroll · People', 'live', [
  { path: '/dashboard/employees', label: 'Employees list & search', ready: 'live' },
  { path: '/dashboard/employees/new', label: 'Add employee form', ready: 'live' },
  { path: '/dashboard/departments', label: 'Departments', ready: 'live' },
  { path: '/dashboard/people/tasks', label: 'My onboarding/offboarding tasks', ready: 'live' },
  { path: '/dashboard/onboarding', label: 'Onboarding workflows', ready: 'live' },
  { path: '/dashboard/onboarding/templates', label: 'Onboarding templates', ready: 'live' },
  { path: '/dashboard/performance', label: 'Performance cycles & reviews', ready: 'live' },
  { path: '/dashboard/performance/jds', label: 'Job description library', ready: 'live' },
  { path: '/dashboard/disciplinary', label: 'Disciplinary & grievance', ready: 'live' },
  { path: '/dashboard/org-chart', label: 'Org chart', ready: 'live' },
  { path: '/dashboard/staff-leave', label: 'Internal staff leave (if enabled)', ready: 'live' },
])}

${section('01 — HR & Payroll · Recruitment', 'live', [
  { path: '/dashboard/jobs', label: 'Job openings', ready: 'live' },
  { path: '/dashboard/jobs/new', label: 'Create job opening', ready: 'live' },
  { path: '/dashboard/applications', label: 'Applications pipeline', ready: 'live' },
  { path: '/dashboard/candidates', label: 'Talent pool', ready: 'live' },
  { path: '/dashboard/assessments', label: 'Assessment templates', ready: 'partial' },
  { path: '/dashboard/interviews', label: 'Interviews list', ready: 'live' },
  { path: '/dashboard/interviews/schedule', label: 'Interview calendar', ready: 'live' },
  { path: '/careers', label: 'Public careers board', ready: 'live' },
])}

${section('01 — HR & Payroll · Time & attendance', 'live', [
  { path: '/dashboard/rota', label: 'Rota & scheduling', ready: 'live' },
  { path: '/dashboard/attendance', label: 'Attendance records', ready: 'live' },
  { path: '/dashboard/leave', label: 'Leave hub (balances, queue, calendar)', ready: 'live' },
  { path: '/dashboard/biometric-devices', label: 'Biometric devices', ready: 'live' },
])}

${section('01 — HR & Payroll · Payroll', 'live', [
  { path: '/dashboard/payroll', label: 'Payroll runs wizard', ready: 'live' },
  { path: '/dashboard/payroll/payslips', label: 'Payslips', ready: 'live' },
  { path: '/dashboard/payroll/statutory', label: 'Statutory returns (PAYE/NSSF/SHIF)', ready: 'live' },
  { path: '/dashboard/payroll/disbursements', label: 'M-Pesa & disbursements', ready: 'live' },
])}

${section('01 — HR & Payroll · Development & ESS admin', 'live', [
  { path: '/dashboard/training', label: 'Training programs', ready: 'live' },
  { path: '/dashboard/ess/portal-accounts', label: 'ESS portal accounts', ready: 'live' },
  { path: '/dashboard/ess/shifts', label: 'ESS & shifts admin', ready: 'live' },
  { path: '/dashboard/ess/document-requests', label: 'Document requests', ready: 'live' },
])}

<div class="page-break"></div>

${section('02 — Finance', 'partial', [
  { path: '/dashboard/accounts', label: 'Finance overview', ready: 'partial' },
  { path: '/dashboard/accounts/clients', label: 'Billing clients', ready: 'partial' },
  { path: '/dashboard/accounts/invoices', label: 'Invoices (AR)', ready: 'partial' },
  { path: '/dashboard/accounts/invoices/new', label: 'Create invoice', ready: 'partial' },
  { path: '/dashboard/accounts/invoicing-setup', label: 'Invoicing setup', ready: 'partial' },
  { path: '/dashboard/accounts/receipts', label: 'Receipts & allocations', ready: 'partial' },
  { path: '/dashboard/accounts/mpesa-reconciliation', label: 'M-Pesa reconciliation', ready: 'partial' },
  { path: '/dashboard/accounts/payment-accounts', label: 'Payment accounts', ready: 'partial' },
  { path: '/dashboard/accounts/vendors', label: 'Vendors', ready: 'partial' },
  { path: '/dashboard/accounts/vendor-bills', label: 'Vendor bills (AP)', ready: 'partial' },
  { path: '/dashboard/accounts/expenses', label: 'Expense claims', ready: 'partial' },
  { path: '/dashboard/accounts/statements', label: 'Statements & ageing', ready: 'partial' },
  { path: '/dashboard/accounts/budgets', label: 'Budgets', ready: 'partial' },
  { path: '/dashboard/accounts/petty-cash', label: 'Petty cash', ready: 'partial' },
  { path: '/dashboard/accounts/financial-reports', label: 'Financial reports', ready: 'partial' },
])}

${section('03 — Procurement', 'partial', [
  { path: '/dashboard/procurement', label: 'Procurement overview', ready: 'partial' },
  { path: '/dashboard/procurement/purchase-requests', label: 'Purchase requests', ready: 'partial' },
  { path: '/dashboard/procurement/lpos', label: 'LPO register', ready: 'partial' },
  { path: '/dashboard/procurement/spend', label: 'Spend dashboard', ready: 'partial' },
])}

${section('04 — Legal & Documents', 'partial', [
  { path: '/dashboard/legal', label: 'Compliance hub', ready: 'partial' },
  { path: '/dashboard/people/contracts', label: 'Employee contracts', ready: 'partial' },
  { path: '/dashboard/credentials', label: 'Licences & credentials register', ready: 'partial' },
  { path: '/dashboard/company-documents', label: 'Company policies & SOPs', ready: 'partial' },
  { path: '/dashboard/legal/obligations', label: 'Obligations register', ready: 'partial' },
])}

${section('05 — Projects', 'planned', [
  { path: '/dashboard/projects', label: 'Projects overview', ready: 'planned' },
  { path: '/dashboard/projects/all', label: 'All projects', ready: 'planned' },
  { path: '/dashboard/projects/board', label: 'Project board', ready: 'planned' },
  { path: '/dashboard/projects/tasks', label: 'Tasks & deliverables', ready: 'planned' },
  { path: '/dashboard/projects/budget', label: 'Budget vs actual', ready: 'planned' },
])}

<div class="page-break"></div>

${section('06 — Fleet · Orders & dispatch', 'partial', [
  { path: '/dashboard/fleet', label: 'Fleet overview', ready: 'partial' },
  { path: '/dashboard/fleet/orders', label: 'Transport orders', ready: 'partial' },
  { path: '/dashboard/fleet/customers', label: 'Fleet customers', ready: 'partial' },
  { path: '/dashboard/fleet/planning', label: 'Route planning', ready: 'partial' },
  { path: '/dashboard/fleet/trips', label: 'Trip board', ready: 'partial' },
  { path: '/dashboard/fleet/compliance', label: 'Pre-trip compliance', ready: 'partial' },
])}

${section('06 — Fleet · Monitoring', 'partial', [
  { path: '/dashboard/fleet/tracking', label: 'Live tracking', ready: 'partial' },
  { path: '/dashboard/fleet/geofences', label: 'Geofences', ready: 'partial' },
  { path: '/dashboard/fleet/driving-time', label: 'Driving time', ready: 'partial' },
  { path: '/dashboard/fleet/incidents', label: 'Incidents', ready: 'partial' },
  { path: '/dashboard/fleet/alarms', label: 'Events & alarms', ready: 'partial' },
])}

${section('06 — Fleet · Assets & commercial', 'partial', [
  { path: '/dashboard/fleet/vehicles', label: 'Vehicles register', ready: 'partial' },
  { path: '/dashboard/fleet/service', label: 'Service planning', ready: 'partial' },
  { path: '/dashboard/fleet/defects', label: 'Defect reports', ready: 'partial' },
  { path: '/dashboard/fleet/registers', label: 'Fleet registers', ready: 'partial' },
  { path: '/dashboard/fleet/settlements', label: 'Driver/partner settlements', ready: 'partial' },
  { path: '/dashboard/fleet/billing', label: 'Client billing', ready: 'partial' },
  { path: '/dashboard/fleet/drivers/performance', label: 'Driver performance', ready: 'partial' },
  { path: '/dashboard/fleet/environmental', label: 'Environmental reporting', ready: 'partial' },
  { path: '/dashboard/fleet/reports', label: 'Performance reports', ready: 'partial' },
])}

${section('07 — Operations (Assets & HSE)', 'partial', [
  { path: '/dashboard/operations', label: 'Operations hub', ready: 'partial' },
  { path: '/dashboard/assets', label: 'Asset register', ready: 'partial' },
  { path: '/dashboard/hse', label: 'HSE incidents', ready: 'live' },
  { path: '/dashboard/announcements', label: 'Announcements', ready: 'live' },
  { path: '/dashboard/reports', label: 'All reports', ready: 'live' },
  { path: '/dashboard/analytics', label: 'Analytics (admin)', ready: 'live' },
])}

${section('08 — HR Outsourcing', 'partial', [
  { path: '/dashboard/outsourcing', label: 'Outsourcing overview', ready: 'partial' },
  { path: '/dashboard/outsourcing/clients', label: 'Client register', ready: 'partial' },
  { path: '/dashboard/outsourcing/employees', label: 'Outsourced employees', ready: 'partial' },
  { path: '/dashboard/outsourcing/departments', label: 'Departments', ready: 'partial' },
  { path: '/dashboard/outsourcing/payroll', label: 'Client payroll', ready: 'partial' },
  { path: '/dashboard/outsourcing/attendance', label: 'Client attendance', ready: 'partial' },
  { path: '/dashboard/outsourcing/leave', label: 'Client leave', ready: 'partial' },
  { path: '/dashboard/outsourcing/disciplinary', label: 'Client disciplinary', ready: 'partial' },
])}

${section('09 — Sales', 'partial', [
  { path: '/dashboard/sales', label: 'Sales performance', ready: 'partial' },
  { path: '/dashboard/sales/targets', label: 'Sales targets', ready: 'partial' },
  { path: '/dashboard/sales/deals', label: 'Pipeline / deals', ready: 'partial' },
  { path: '/dashboard/sales/attainment', label: 'Attainment', ready: 'partial' },
  { path: '/dashboard/sales/commissions', label: 'Commissions (if nav visible)', ready: 'partial' },
])}

<div class="page-break"></div>

${section('Vertical packs · SACCO', 'planned', [
  { path: '/dashboard/sacco', label: 'SACCO overview', ready: 'planned' },
  { path: '/dashboard/sacco/members', label: 'Members', ready: 'planned' },
  { path: '/dashboard/sacco/accounts', label: 'BOSA & FOSA', ready: 'planned' },
  { path: '/dashboard/sacco/dividends', label: 'Dividends', ready: 'planned' },
  { path: '/dashboard/sacco/reports', label: 'SASRA reports', ready: 'planned' },
])}

${section('Vertical packs · Healthcare', 'planned', [
  { path: '/dashboard/healthcare', label: 'Healthcare overview', ready: 'planned' },
  { path: '/dashboard/healthcare/wards', label: 'Wards & rules', ready: 'planned' },
  { path: '/dashboard/healthcare/rota', label: 'Clinical rota', ready: 'planned' },
  { path: '/dashboard/healthcare/nhif', label: 'NHIF / SHIF', ready: 'planned' },
])}

${section('Vertical packs · Energy', 'planned', [
  { path: '/dashboard/energy', label: 'Energy overview', ready: 'planned' },
  { path: '/dashboard/energy/sites', label: 'Sites', ready: 'planned' },
  { path: '/dashboard/energy/permits', label: 'Permits', ready: 'planned' },
  { path: '/dashboard/energy/hse', label: 'HSE rollup', ready: 'planned' },
])}

${section('Vertical packs · Construction', 'partial', [
  { path: '/dashboard/construction', label: 'Construction overview', ready: 'planned' },
  { path: '/dashboard/construction/sites', label: 'Sites', ready: 'planned' },
  { path: '/dashboard/construction/plant', label: 'Plant assets', ready: 'planned' },
  { path: '/dashboard/construction/subcontractors', label: 'Subcontractors', ready: 'planned' },
])}

${section('Platform admin', 'live', [
  { path: '/dashboard/platform', label: 'Platform admin hub', ready: 'live' },
  { path: '/dashboard/admin/company-setup', label: 'Company setup & branding', ready: 'live' },
  { path: '/dashboard/users/staff', label: 'System users', ready: 'live' },
  { path: '/dashboard/admin/roles-permissions', label: 'Roles & permissions', ready: 'live' },
  { path: '/dashboard/admin/holidays', label: 'Public holidays', ready: 'live' },
  { path: '/dashboard/admin/facilities', label: 'Facilities', ready: 'live' },
  { path: '/dashboard/admin/governance', label: 'Board & governance', ready: 'live' },
  { path: '/dashboard/admin/audit-log', label: 'Audit log', ready: 'live' },
  { path: '/dashboard/settings', label: 'User settings', ready: 'live' },
])}

<div class="page-break"></div>

<section>
  <h2>Employee Self-Service (ESS) portal</h2>
  <p>Login at <code>/ess/login</code> as <code>moses.okello@swiftfreight.imara.co.ke</code> (or vertical ESS user).</p>
  <table>
    <thead><tr><th>#</th><th>Page</th><th>Status</th><th>Pass</th><th>Fail</th><th>N/A</th><th>Issues</th></tr></thead>
    <tbody>
${rows([
  { path: '/ess', label: 'ESS home', ready: 'live' },
  { path: '/ess/work', label: 'Work hub', ready: 'live' },
  { path: '/ess/leave', label: 'Leave request & history', ready: 'live' },
  { path: '/ess/attendance', label: 'Attendance', ready: 'live' },
  { path: '/ess/rota', label: 'My rota', ready: 'live' },
  { path: '/ess/payslips', label: 'Payslips download', ready: 'live' },
  { path: '/ess/pay', label: 'Pay summary', ready: 'live' },
  { path: '/ess/pay/ytd', label: 'YTD earnings', ready: 'live' },
  { path: '/ess/pay/tax-certificates', label: 'Tax certificates', ready: 'live' },
  { path: '/ess/pay/bank-details', label: 'Bank details', ready: 'live' },
  { path: '/ess/profile', label: 'Profile', ready: 'live' },
  { path: '/ess/documents', label: 'Documents', ready: 'live' },
  { path: '/ess/credentials', label: 'My credentials', ready: 'live' },
  { path: '/ess/onboarding', label: 'My onboarding tasks', ready: 'live' },
  { path: '/ess/performance', label: 'Self-review / performance', ready: 'live' },
  { path: '/ess/team/leave', label: 'Manager leave approvals', ready: 'live' },
  { path: '/ess/disciplinary', label: 'Disciplinary (if assigned)', ready: 'live' },
  { path: '/ess/install', label: 'PWA install prompt', ready: 'live' },
])}
    </tbody>
  </table>
</section>

<section>
  <h2>Cross-cutting checks (all modules)</h2>
  <table>
    <thead><tr><th>Done</th><th>Check</th><th>Issues</th></tr></thead>
    <tbody>
      ${[
        'No JavaScript console errors on primary pages',
        'No infinite loading spinners / blank screens',
        'Dates & currency show Africa/Nairobi + KES correctly',
        'Role-based access: HR vs Finance vs Admin see appropriate actions',
        'Search (⌘K) finds people, payroll, departments',
        'Import/export dropdowns not clipped by headers',
        'Mobile sidebar opens/closes on narrow viewport',
        'Logout and re-login works cleanly',
        'Dark mode toggle works (if enabled)',
        'PDF downloads open correctly (payslips, invoices)',
      ]
        .map((c) => `<tr><td class="tick">☐</td><td>${c}</td><td class="notes"></td></tr>`)
        .join('\n')}
    </tbody>
  </table>
</section>

<div class="page-break"></div>

<section>
  <h2>Known platform gaps (expected — not necessarily bugs)</h2>
  <p>Use this when deciding Pass vs "missing for a full business platform".</p>
  <table>
    <thead><tr><th>Area</th><th>Expected limitation / missing capability</th><th>Affects us?</th></tr></thead>
    <tbody>
      ${KNOWN_GAPS.map(
        ([a, b]) =>
          `<tr><td><strong>${a}</strong></td><td>${b}</td><td class="tick">☐</td></tr>`,
      ).join('\n')}
    </tbody>
  </table>
</section>

<section>
  <h2>Issue log</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>Module / path</th><th>Severity</th><th>Expected</th><th>Actual</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${Array.from({ length: 12 })
        .map(
          (_, i) => `<tr>
        <td>${i + 1}</td><td></td><td>Blocker / Major / Minor</td><td></td><td></td><td>Open</td>
      </tr>`,
        )
        .join('\n')}
    </tbody>
  </table>
</section>

<section>
  <h2>Sign-off</h2>
  <table>
    <tbody>
      <tr><td><strong>Overall result</strong></td><td>☐ Pass for demo &nbsp; ☐ Pass with issues &nbsp; ☐ Fail</td></tr>
      <tr><td><strong>Blockers found</strong></td><td class="notes"></td></tr>
      <tr><td><strong>Tester signature</strong></td><td>________________________ Date: __________</td></tr>
      <tr><td><strong>Reviewer signature</strong></td><td>________________________ Date: __________</td></tr>
    </tbody>
  </table>
</section>

</body>
</html>`;

writeFileSync(outHtml, html, 'utf8');
console.log('Wrote', outHtml);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({
  path: outPdf,
  format: 'A4',
  printBackground: true,
  margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
});
await browser.close();
console.log('Wrote', outPdf);
