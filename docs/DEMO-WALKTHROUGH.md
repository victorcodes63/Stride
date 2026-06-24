# Demo walkthrough — Phase A (demo-ready)

End-to-end path for **Heritage Members SACCO** (`DEMO_PACK=imara-sacco`): ~40 Kenyan staff, approved + draft payroll, leave queue, performance cycle, and M-Pesa sandbox disbursements.

**Local:** [http://localhost:3000/dashboard/login](http://localhost:3000/dashboard/login)  
**Password (all accounts):** `Demo@2026!` (or `NEXT_PUBLIC_DEMO_PASSWORD`)

After login, the dashboard shows a **Demo walkthrough** checklist (reset progress by clearing `stride_demo_walkthrough_done` in localStorage).

---

## Reseed (fresh data)

```bash
cd app
set -a && . ./.env.local && set +a
npm run demo:reseed:imara-sacco
# or full orchestrator:
npm run db:seed-all-demo
```

This seeds ~40 employees, payroll (approved prior month + draft current), leave applications, accounts, staff leave, and an **active performance cycle** (via `scripts/seed-performance-cycle.ts`).

---

## Logins

| Persona | Email | Use for |
|---------|-------|---------|
| Admin | `admin@imara.co.ke` | Full access, settings |
| HR | `hr@nyati.imara.co.ke` | Leave, performance, employees |
| Finance | `finance@nyati.imara.co.ke` | Payroll wizard, disbursements |
| ESS | `employee@nyati.imara.co.ke` | `/ess/login` — leave & self-review |

---

## 15-minute script

### 1. Employees (~2 min)

**http://localhost:3000/dashboard/employees**

- Confirm ~40 active staff
- Open one employee — KRA PIN, NSSF, bank details populated (payroll validation)

### 2. Leave hub (~3 min)

**http://localhost:3000/dashboard/leave**

- **Employees** tab → **Queue** (pending applications)
- **Team calendar** — approved/pending leave on calendar
- **Accrual balances** — balances by leave type
- **Liability report** — cost exposure KPIs
- **Staff** tab → `/dashboard/staff-leave` (internal staff leave, if enabled)

Legacy redirect: `/dashboard/outsourcing/leave` → employee leave hub.

### 3. Payroll run wizard (~5 min)

**http://localhost:3000/dashboard/payroll**

1. **Period** — pick a month with seed data (prior month is **approved**)
2. **Validate** — readiness check (PIN / NSSF / bank)
3. **Generate** — skip if records exist, or create drafts
4. **Review** — totals + prior-month variance
5. **Approve** — bulk approve (password re-auth when prompted)
6. **Export** — bank CSV or jump to M-Pesa

### 4. M-Pesa disbursements (~2 min)

**http://localhost:3000/dashboard/payroll/disbursements**

- Select approved month/year
- Submit sandbox batch → poll line status

### 5. Performance (~3 min)

**http://localhost:3000/dashboard/performance**

- Active **H1** cycle
- Sample reviews in self-submitted state
- ESS: **http://localhost:3000/ess/performance** (log in as `employee@nyati.imara.co.ke`)

---

## Marketing site (demo mode)

With `DEMO_MODE=true`, the public site remains at `/` and `/platform`. **Sign in** / **Book demo** CTAs use `getMarketingLoginUrl()` → `/dashboard/login`.

Module cards show **Live / Partial / Roadmap** badges (RAV-72).

---

## Paths that are roadmap (not dead ends)

These show an honest roadmap panel — not broken links:

- `/dashboard/procurement/*`, `/dashboard/projects/*` — Phase C/D
- `/dashboard/hse` — mock/demo UI (not HR demo path)

---

## Exit criteria (RAV-73)

- [x] `imara-sacco` pack ~40 employees
- [x] Performance cycle seeded in `db:seed-all-demo`
- [x] Dashboard demo walkthrough checklist
- [x] HR primary paths documented and test-covered (`demo-walkthrough.test.ts`)
- [x] Disbursements nav badge → Partial (live sandbox)
