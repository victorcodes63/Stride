# Bi-weekly payroll (sample client flow)

## Idea

- **Period 1** payslip: gross for first ~2 weeks (e.g. 1–15).
- **Period 2** payslip: gross for second ~2 weeks (unequal is OK).
- **Statutory (PAYE, NSSF, SHIF, AHL)** is computed once on **combined monthly gross** = Period 1 + Period 2 (+ monthly allowances). Same rules as monthly payroll.
- **Per-period payslip**: each period shows its gross and a **proportional share** of the monthly statutory so the employee sees sensible mid-month payslips; the **month total** matches one monthly remittance.
- **Final month view**: one row in the app still holds full-month gross + full statutory + net (after other deductions).

## Setup

1. **Client** `payrollFrequency = "biweekly"`
  - API: `PATCH /api/outsourcing/clients/:id` body `{ "payrollFrequency": "biweekly" }`  
  - Or seed: `node prisma/seed-biweekly-client.js` → **Two-Week Pay Demo Ltd**
2. **Generate payroll** for that client/month → drafts get **Period 1** / **Period 2** prefilled as half of monthly `baseSalary` (adjust in edit).
3. **Edit payroll** → set **Period 1 gross** and **Period 2 gross** → **Recalculate statutory** → combined gross drives PAYE/NSSF/SHIF/AHL; table shows proportional split for Payslip 1 / Payslip 2 / month.

## Allocation math

`share_period1 = monthly_stat × (g1 / (g1+g2))` (rounded); remainder on period 2 so totals match exactly.

## Monthly clients

Leave `payrollFrequency` as `monthly` (default). No period fields required.

## Legal note

Employer remittance calendars (KRA/NSSF/SHIF) remain your compliance scope; this module models **one monthly taxable base** split into two pay runs for cash flow.