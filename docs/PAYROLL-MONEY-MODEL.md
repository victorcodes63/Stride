# Payroll & money: how it ties together

Your **SABIC PAYROLL 2026**-style sheet is a **monthly payroll run**: one row per person with earnings, statutory lines, voluntary deductions, and net pay. The app models that in two layers.

## 1. Master data (per employee)


| Your CSV / real world                    | In the app                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| **B/Salary** (monthly basic)             | `**Employee.baseSalary`** — set on Add/Edit employee (or Excel import). |
| Position, ID, KRA, NSSF, NHIF/SHIF, bank | Already on **Employee** (job title, IDs, bank).                         |
| Default pay for “normal” months          | `**baseSalary`** is copied when you **Generate payroll** for a month.   |


There is no separate “contract” table yet; `**baseSalary`** is the monthly default. Change it when someone gets a raise; already-generated months stay as they were unless you edit that month’s payroll row.

## 2. Period data (per employee per month)

Each `**Payroll**` row = one person × **month × year** (the period).


| CSV column                                   | App field                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| B/Salary                                     | `**basicPay`** (usually = `baseSalary` at generate; edit if pro-rated)                                   |
| Bonus, Overtime                              | `**allowances**` JSON — use **Bonus**, **Overtime** (or any name)                                        |
| G/Pay                                        | `**grossPay`** = basic + sum(allowances)                                                                 |
| NSSF, PAYE, SHIF                             | `**nssf**`, `**paye**`, `**nhif**` (SHIF stored in `nhif` slot)                                          |
| SACCO, Advance, Pension, S/Welfare, Co.Dtion | `**deductions**` JSON — one line per item                                                                |
| Leave days                                   | Not stored yet — use **unpaid leave** as a negative allowance or a “Leave deduction” line if you need it |
| NET PAY                                      | `**netPay`**                                                                                             |
| Leave pay (some clients)                     | `**leavePay**` on payroll; `**OutsourcingClient.leavePayMode**`                                          |


### Leave pay (per client)


| Mode                               | Behaviour                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**none**`                         | No leave pay line; payroll behaves as basic + allowances only.                                                                                                                                                                                                                                        |
| `**paye_only**` (Client X)         | **NSSF, SHIF, AHL** are calculated **only** on gross **without** leave pay (basic + allowances). **PAYE** uses **basic + allowances + leave pay** as gross for tax, minus those same NSSF/SHIF/AHL figures. **Net** = employment gross − PAYE − NSSF − SHIF − AHL − other deductions **+ leave pay**. |
| `**included_in_gross`** (Client Y) | Leave pay is in gross first; **NSSF, SHIF, AHL, PAYE** all use **employment + leave pay** (full gross).                                                                                                                                                                                               |


Set mode on **Edit client → Payroll**. Enter **Leave pay (KES)** on each month’s payroll row when the client uses it.

**Included in gross — statutories on full gross:** Saving a row with leave pay (or any positive leave pay on PATCH) now **always recalculates** PAYE/NSSF/SHIF/AHL so they use **basic + allowances + leave pay**. (Previously, gross could show 100k while deductions stayed on 80k if statutory wasn’t recalculated.)

**Generate payroll:** Optional JSON body field `**defaultLeavePay`** (KES) pre-fills leave pay for every new row when the client uses leave pay (same amount for all staff that month). Per-person amounts are still edited on each row.

**Partial month / pro-rating:** e.g. joined mid-month → either set `**basicPay`** manually for that month, or later add `daysPaid` on `Payroll` and auto-prorate from `baseSalary`.

**Loans:** Model as recurring **deductions** each month (Advance, Loan, SACCO). For **running balances** and schedules, a future `**EmployeeLoan`** table would amortize automatically; today you enter the monthly deduction in **Other deductions**.

## 3. Flow in the app

1. Set `**baseSalary`** (and bank/IDs) on each employee.
2. **Generate payroll** for client + month → creates draft rows with basic = `baseSalary`, gross = basic, statutory pre-calculated (Kenyan PAYE/NSSF/SHIF).
3. Open each row (or only those with overtime/bonus/loans) → add **Bonus/Overtime**, **SACCO/Advance/Loan**, **Recalculate statutory** if gross changed.
4. Approve / pay when ready.

## 4. CSV import (future / manual)

A payroll CSV like SABIC can be mapped row-by-row to `**Payroll`** updates (same employee matched by ID or name). Not automated yet; the structure above is what any importer should fill.

## 5. Employer costs (your sheet footer)

Lines like **Employer NSSF**, **Employer AHL**, **NITA**, **management fee + VAT** are **client-level costs**, not stored per employee in `Payroll` today. A later `**PayrollRun`** or `**ClientInvoice**` model can hold totals for “Total Payroll (A)” and fees.

---

**Summary:** Money is tied in by (**1**) `**Employee.baseSalary`** as the default monthly basic, (**2**) monthly `**Payroll`** rows for what was actually earned and deducted that month, and (**3**) allowances + deductions JSON for everything that varies (bonus, overtime, loans, SACCO).