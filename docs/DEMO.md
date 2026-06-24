# Eagle HR — Internal leave demo

Polished demo environment for **Eagle HR’s internal team** (dashboard `User` accounts). Focus: staff leave balances, requests, approvals, and a leadership team overview.

This is **not** an outsourcing / ESS / geofencing demo.

---

## Quick start (local)

```bash
cd Stride
cp .env.example .env.local   # set DATABASE_URL + DIRECT_DATABASE_URL (or unpooled URL)
npm install
npm run db:migrate:deploy      # or: npx prisma migrate deploy
npm run db:seed-demo
npm run dev
```

Open [http://localhost:3000/dashboard/login](http://localhost:3000/dashboard/login) → leave module at [http://localhost:3000/dashboard/staff-leave](http://localhost:3000/dashboard/staff-leave) (alias: `/dashboard/leave`).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL (pooled OK for app) |
| `DIRECT_DATABASE_URL` | Non-pooler URL for Prisma migrations |
| `DEMO_MODE=true` | Demo licensing + behaviour |
| `NEXT_PUBLIC_DEMO_MODE=true` | Login credential hints + dashboard demo banner |
| `DEMO_INTERNAL_PASSWORD` | Optional override for seeded passwords (default `Demo2026!`) |

Optional login-hint overrides:

| Variable | Default (after seed) |
|----------|----------------------|
| `NEXT_PUBLIC_DEMO_ADMIN_EMAIL` | `demo-admin@eaglehr.demo` |
| `NEXT_PUBLIC_DEMO_HR_EMAIL` | `demo-approver@eaglehr.demo` |
| `NEXT_PUBLIC_DEMO_FINANCE_EMAIL` | `grace.kamau@eaglehr.demo` |
| `NEXT_PUBLIC_DEMO_PASSWORD` | `Demo2026!` |

Staff session secret: use existing auth env from `.env.example` (`STAFF_SESSION_SECRET` or project equivalent).

---

## Demo logins

**Password for all accounts:** `Demo2026!` (unless `DEMO_INTERNAL_PASSWORD` is set)

| Email | Role | Demo purpose |
|-------|------|----------------|
| `admin@eaglehr.co.ke` | Admin / Director | Full org team overview, Types & setup |
| `wanjiku.mwangi@eaglehr.co.ke` | Business manager | Default **Team overview**, 5 reportees, Approvals |
| `james.otieno@eaglehr.co.ke` | Operations | **My leave** only — has 1 pending request |
| `grace.kamau@eaglehr.demo` | Finance | Reportee on approver’s team |
| `peter.ndungu@eaglehr.demo` | Operations | Partial annual used + cancelled request |
| `sarah.wanjiru@eaglehr.demo` | Operations | Upcoming approved leave in sidebar |
| `daniel.ochieng@eaglehr.demo` | Operations | Rejected historical request |
| `michael.kibet@eaglehr.demo` | Operations | 1-day approved this month |
| `faith.mutua@eaglehr.demo` | Director | Reports to admin |

Re-seed anytime (idempotent):

```bash
npm run db:seed-demo
```

---

## 5-minute walkthrough

### 1. Approver — team view (2 min)

1. Log in as **`wanjiku.mwangi@eaglehr.co.ke`**
2. Go to **Staff leave** → lands on **Team overview**
3. Scan KPIs: active staff, pending approvals (**1**), days taken YTD, on leave today, low balance
4. Search the staff table; expand **Peter Ndungu** or **Sarah Wanjiru** to see all leave-type balances
5. Check sidebar: **Upcoming approved leave** (Sarah) + **Recent activity**

### 2. Approver — act on pending (1 min)

1. Open **Approvals** tab (badge **1**)
2. Approve or reject **James Otieno**’s pending request
3. Return to **Team overview** — pending count and balances update (`usedDays` syncs from approved only)

### 3. Staff — submit leave (1 min)

1. Log out → log in as **`james.otieno@eaglehr.co.ke`**
2. **My leave** → **Request leave** (fill coverage + handover fields)
3. Submit a short request → appears in own history as pending

### 4. Admin — full org (1 min)

1. Log in as **`admin@eaglehr.co.ke`**
2. **Team overview** shows all active staff
3. Optional: **Types & setup** → leave types + “Ensure balances for all users”

---

## What is seeded

- 9 internal `User` rows (`@eaglehr.demo`)
- `leaveApproverId` chain (reportees → approver / admin)
- Leave types via `seed-staff-leave.js` (Annual 21, Sick 7, etc.)
- Balances for current year
- Application stories: partial usage, **1 pending**, **1 this-month approved**, **cancelled** (no balance impact), **rejected**, **upcoming approved**
- `usedDays` reconciled from **approved applications only**

**Not seeded:** outsourcing clients, ESS accounts, work sites, geofencing, payroll, accounts.

---

## Vercel deployment (`demo` branch)

1. Create a **separate Vercel project** + **Neon branch** from production
2. Connect Git branch `demo`
3. Set env vars: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `DEMO_MODE=true`, `NEXT_PUBLIC_DEMO_MODE=true`, staff session secret
4. Build command: `npm run build` (runs migrations on production builds when configured)
5. After first deploy, run locally against demo DB:

   ```bash
   npm run db:seed-demo
   ```

6. UI uses professional staff emails (no “demo” banner or login hints by default). Run `npm run db:patch-emails` after older reseeds if needed.

---

## APIs (staff leave)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/staff/leave/balances?year=` | My balances (syncs `usedDays`) |
| `GET/POST /api/staff/leave/applications` | List / submit |
| `PATCH /api/staff/leave/applications/[id]` | approve \| reject \| cancel |
| `GET /api/staff/leave/overview?year=` | Team overview (approver / admin) |
| `GET /api/staff/leave/types` | Active leave types |

Balance rule: `usedDays` = sum of **approved** applications only. See `src/lib/staff-leave-balance.ts`.

Further detail: [STAFF-LEAVE.md](./STAFF-LEAVE.md).
