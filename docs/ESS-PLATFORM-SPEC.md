# ESS Platform Specification — Mobile-First PWA

**Status:** v1 implemented (Phase A–D core); see §12 for remaining gaps  
**Audience:** Product, design, engineering  
**Related:** `STRIDE-MASTER-PLAN.md`, `src/app/ess/`, `MODULE_ESS`, `ESS_NAV_MODULES`

---

## 1. Purpose

The Employee Self-Service (ESS) portal is the **primary daily interface** for employees and line managers. It must match the breadth of enabled HR modules on the staff dashboard, but with **employee-appropriate depth** — view, request, approve — never full HR administration.

**Strategic choice:** Ship as a **Progressive Web App (PWA)** first (installable, offline-tolerant shell, push where supported). Native iOS/Android apps are optional later (Capacitor wrapper or React Native shell around the same routes).

**Current baseline (v0):** Seven bottom-nav items (horizontal scroll), read-heavy attendance, working leave/payslips/cases, manager leave approvals at `/ess/leave-approvals` **not in nav**, manifest `start_url: '/'` (not ESS-scoped), no service worker.

This document defines the **target v1 ESS platform**: information architecture, mobile UI system, PWA requirements, feature catalog, APIs, and phased delivery.

---

## 2. Product principles

| Principle | Meaning |
|-----------|---------|
| **Mobile-first** | Design at 390×844 (iPhone 14 class); desktop is a centered column (max ~480px content) with optional side panel for managers only. |
| **Thumb zone** | Primary actions in bottom 40% of screen; destructive actions require confirm sheet. |
| **Module parity** | Every licensed module with an employee/manager touchpoint gets an ESS surface (hidden when `MODULE_*` off). |
| **Role-aware** | Same app; UI adapts for `employee` \| `manager` \| `hr` (ESS portal roles on `EssPortalUser`). |
| **Actionable home** | Home is a task inbox, not a static summary. |
| **Offline honest** | Cache shell + last-viewed data; show stale badges; never fake successful submits offline. |
| **One auth domain** | ESS session (`ess_session`) separate from staff dashboard; no privilege bleed. |
| **Accessible** | WCAG 2.1 AA targets: 44×44px touch targets, focus order, reduced motion respect. |

---

## 3. Personas & roles

### 3.1 Personas

- **Individual contributor** — apply leave, clock in, view payslip, update profile, complete onboarding tasks.
- **Line manager** — everything above + approve leave, attendance corrections, shift swaps, performance inputs for direct reports.
- **ESS HR viewer** (optional `hr` role) — read-only team visibility, no payroll run or employee master edit (staff dashboard only).

### 3.2 Capability matrix

| Capability | Employee | Manager | HR (ESS) |
|------------|:--------:|:-------:|:--------:|
| View own HR data | ✓ | ✓ | ✓ |
| Submit requests (leave, bank change, cases) | ✓ | ✓ | ✓ |
| Approve team requests | — | ✓ | ✓ (if configured) |
| View team calendars / attendance | — | ✓ | ✓ |
| Edit other employees’ master data | — | — | — |
| Payroll runs / statutory filing | — | — | — |
| Recruitment ATS admin | — | — | — |

Managers discover **Team** tab only when `role === 'manager' \| 'hr'` or `directReports.length > 0`.

---

## 4. Information architecture

### 4.1 Navigation model (v1 target)

**Problem:** Seven+ bottom tabs overflow on small screens and hide manager workflows.

**Solution:** **Five primary tabs** + **More hub** (full-screen sheet or `/ess/more` route).

```
┌─────────────────────────────────────────────────────────┐
│  [Header: greeting · notif · avatar]                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    (page content)                       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Home │ Work │ Pay │ Team* │ More                        │
└─────────────────────────────────────────────────────────┘
  * Team tab hidden for individual contributors
```

| Tab | Route | Contains |
|-----|-------|----------|
| **Home** | `/ess` | Inbox, quick actions, widgets (balances, next shift, expiries) |
| **Work** | `/ess/work` | Hub tiles → Leave, Time, Rota, Onboarding |
| **Pay** | `/ess/pay` | Hub tiles → Payslips, YTD, Tax certs, Bank change request |
| **Team** | `/ess/team` | Manager hub → Leave approvals, Team calendar, Exceptions (manager only) |
| **More** | `/ess/more` | Profile, Documents, Credentials, Cases, Assets, Performance, HSE, Settings |

**Deep links** preserve existing URLs where possible (`/ess/leave` → under Work hub; redirects OK).

### 4.2 Module → ESS mapping

| Dashboard module | ESS surfaces | Employee | Manager |
|------------------|--------------|:--------:|:-------:|
| **core** | Profile, Documents, Onboarding tasks, Contract summary | ✓ | ✓ |
| **leave** | Leave apply/balances/calendar; Team leave approvals | ✓ | ✓ |
| **time** | Attendance, My rota, Clock in/out (geo), Exception request | ✓ | ✓ approve |
| **payroll** | Payslips, YTD, tax documents, bank change request | ✓ | — |
| **disciplinary** | My cases, letters; Grievances | ✓ | — |
| **performance** | My goals, self-assessment, published review | ✓ | ✓ rate reports |
| **hse** | Report incident / near-miss; My reported items | ✓ | — |
| **assets** | My assigned assets, acknowledge handover | ✓ | — |
| **ats** | Internal jobs, refer a candidate (optional) | ✓ | — |
| **reports** | Personal exports only (leave PDF, attendance month) | ✓ | — |
| **accounts** | — (staff only) | — | — |
| **ess** | Portal shell, auth, notifications | ✓ | ✓ |

### 4.3 Route catalog (target)

#### Shell & auth
| Route | Description |
|-------|-------------|
| `/ess/login` | Email/password + Google/Microsoft OAuth |
| `/ess/account-security` | Password reset, MFA (when enabled) |
| `/ess/offline` | Offline fallback page |
| `/ess/install` | Add to Home Screen coaching (iOS/Android) |

#### Home
| Route | Description |
|-------|-------------|
| `/ess` | Task inbox + widgets |
| `/ess/notifications` | Full notification list (optional; header sheet OK for v1) |

#### Work
| Route | Description |
|-------|-------------|
| `/ess/work` | Module hub |
| `/ess/leave` | Balances, apply, history, cancel pending |
| `/ess/leave/calendar` | Team/public holiday overlay |
| `/ess/attendance` | Month grid, summary cards |
| `/ess/attendance/clock` | Geo clock in/out (feature-flagged) |
| `/ess/attendance/exceptions/[id]` | Dispute / note thread |
| `/ess/rota` | Upcoming shifts (2–4 weeks) |
| `/ess/rota/swap/[id]` | Request shift swap |
| `/ess/onboarding` | My onboarding checklist |
| `/ess/onboarding/tasks/[id]` | Task detail + upload |

#### Pay
| Route | Description |
|-------|-------------|
| `/ess/pay` | Pay hub |
| `/ess/payslips` | List (existing) |
| `/ess/payslips/[id]` | Detail + PDF share |
| `/ess/pay/ytd` | Year-to-date earnings/deductions |
| `/ess/pay/tax-certificates` | P9 / annual tax cert when available |
| `/ess/pay/bank-details` | View masked + request change workflow |

#### Team (manager)
| Route | Description |
|-------|-------------|
| `/ess/team` | Manager dashboard |
| `/ess/leave-approvals` | Existing; linked from Team |
| `/ess/team/attendance` | Pending exception reviews |
| `/ess/team/calendar` | Who is on leave this week |
| `/ess/team/rota` | Team shift view (read-only v1) |

#### More — Me & compliance
| Route | Description |
|-------|-------------|
| `/ess/more` | Settings hub |
| `/ess/profile` | Personal info (existing) |
| `/ess/profile/emergency` | Emergency contacts |
| `/ess/documents` | HR letters, contracts, uploads |
| `/ess/documents/[id]` | Viewer / download |
| `/ess/credentials` | Licences/certs + expiry |
| `/ess/credentials/[id]` | Upload renewal |
| `/ess/disciplinary` | Cases (existing) |
| `/ess/disciplinary/cases/[id]` | Case detail (existing) |
| `/ess/grievances` | Grievances (existing) |
| `/ess/hse` | Report + my incidents |
| `/ess/hse/report` | New incident form |
| `/ess/assets` | My assigned assets |
| `/ess/performance` | Goals & review cycle |
| `/ess/performance/reviews/[id]` | Self-assessment wizard |

#### Legacy redirects
| Old | New |
|-----|-----|
| `/ess` (overview only) | `/ess` (rich home) |
| `/ess/leave-approvals` | `/ess/team/leave` or keep alias |

Update `ESS_NAV_MODULES` in `src/lib/module-routes.ts` for every gated href.

---

## 5. Screen specifications (mobile UI)

### 5.1 Global layout

```
┌──────────────────────────────┐
│ Sticky top bar (56px)        │  ← back chevron on child routes
│  Title · actions             │
├──────────────────────────────┤
│ Scroll region                │  ← pb-safe + bottom nav height
│  padding: 16px horizontal    │
├──────────────────────────────┤
│ Bottom tab bar (64px + safe) │  ← fixed, blur backdrop optional
└──────────────────────────────┘
```

**Top bar (child routes):** Back returns to parent hub; never browser back-only on iOS PWA.

**Content max-width:** `max-w-lg mx-auto` (512px) for phone; `max-w-2xl` only on `/ess/team` desktop manager view.

### 5.2 Home (`/ess`)

**Sections (vertical stack, 16px gap):**

1. **Greeting strip** — “Good morning, {firstName}” + employee number + job title (from `/api/ess/auth/me`).
2. **Action required** — Horizontal scroll chips OR stacked cards (max 5 visible):
   - Pending leave approval (manager)
   - Onboarding tasks overdue
   - Credential expiring in ≤30 days
   - Attendance pending review
   - Must reset password
   - Unread disciplinary letter
3. **Quick actions** — 2×2 grid (min 88px cells): Apply leave, Clock in, Payslips, Report issue.
4. **Widgets row** — Swipeable carousel:
   - Leave balance (primary type)
   - Next shift
   - Latest payslip net
   - Days worked this month
5. **Recent activity** — Unified timeline (leave status change, payslip published, case update) from notifications API enriched.

**Empty states:** Illustration-free; one line + CTA button.

### 5.3 Work hub (`/ess/work`)

Large **list tiles** (72px min height): icon, title, subtitle, chevron, optional badge count.

| Tile | Subtitle example | Badge |
|------|------------------|-------|
| Leave | “12 days annual remaining” | pending requests |
| Time & attendance | “18 days worked in May” | exceptions |
| My rota | “Next: Mon 08:00 – 17:00” | — |
| Onboarding | “3 tasks due” | overdue count |

### 5.4 Leave (`/ess/leave`)

- **Sticky summary card** at top: balances per type (horizontal scroll pills).
- **FAB** “Request leave” → bottom sheet form (not separate page on mobile).
- **List:** Cards with status pill (draft/submitted/approved/rejected/cancelled), date range, type; tap → detail sheet with audit trail link.
- **Actions:** Cancel (if pending), attach document (camera/gallery via file input `capture`).

### 5.5 Attendance (`/ess/attendance`)

- **Month picker** — native `<input type="month">` styled.
- **Summary chips** — days worked, late, absent, OT hours (existing API).
- **Day rows** — swipe optional v2; tap opens day detail bottom sheet.
- **Clock** (`/ess/attendance/clock`) — full-screen:
  - Large clock button (pulse when within geofence)
  - Map preview (static) + site name
  - Last punch time
  - Offline queue indicator

### 5.6 Pay hub & payslips

- **Payslip list** — grouped by year; download PDF uses Web Share API when available.
- **YTD** — simple bar/segment chart (CSS only, no heavy chart lib on mobile).
- **Bank change** — form → status tracker (submitted / HR approved / applied).

### 5.7 Team (`/ess/team`) — managers

- **Segmented control:** Approvals | Calendar | Attendance
- **Approvals:** Reuse leave-approvals UX; batch approve v2.
- **Calendar:** Week strip + list of names on leave.
- **Attendance:** Cards for `pending_review` on direct reports.

### 5.8 More hub (`/ess/more`)

Grouped list (iOS Settings style):

- **Account** — Profile, Security, Notification preferences
- **My records** — Documents, Credentials, Assets
- **Workplace** — Performance, HSE, Disciplinary, Grievances
- **Support** — Help link, contact HR email
- **Sign out** — destructive, bottom

### 5.9 Patterns library

| Pattern | Use |
|---------|-----|
| **Bottom sheet** | Forms, filters, confirm delete |
| **Pull-to-refresh** | Lists (home, leave, notifications) |
| **Skeleton loaders** | All list-first pages |
| **Toast** | Success/error (3s, top safe area) |
| **Status pills** | `approved` green, `pending` amber, `rejected` red |
| **Infinite scroll** | Notifications, long leave history |
| **Sticky CTA** | Single primary button above tab bar on forms |

### 5.6 Design tokens (ESS)

Reuse dashboard brand (`primary`, `warning`) but tighten for mobile:

| Token | Value |
|-------|-------|
| `--ess-touch-min` | 44px |
| `--ess-tab-height` | 64px + `env(safe-area-inset-bottom)` |
| `--ess-radius-card` | 12px |
| `--ess-radius-sheet` | 16px top corners |
| Base font | 16px (never 14px body on mobile) |
| Page title | 20px semibold |
| Section label | 12px uppercase tracking-wide neutral-500 |

**Dark mode:** Phase 2; respect `prefers-color-scheme` when added.

---

## 6. PWA technical specification

### 6.1 Manifest (ESS-scoped)

Add `src/app/ess/manifest.ts` OR dynamic segment manifest:

```ts
{
  name: `${brand.appName} — Employee`,
  short_name: 'My HR',
  description: 'Leave, pay, time, and HR requests',
  start_url: '/ess',
  scope: '/ess',
  display: 'standalone',
  orientation: 'portrait-primary',
  theme_color: brand.primaryColor,
  background_color: '#f5f5f5',
  categories: ['business', 'productivity'],
  icons: [
    { src: '/icons/ess-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/ess-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/ess-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'Request leave', url: '/ess/leave', icons: [...] },
    { name: 'Clock in', url: '/ess/attendance/clock', icons: [...] },
    { name: 'Payslips', url: '/ess/payslips', icons: [...] },
  ],
}
```

Link manifest only on ESS layout via `metadata` in `src/app/ess/layout.tsx`.

### 6.2 Service worker strategy

| Cache | Strategy |
|-------|----------|
| App shell (`/ess/*` layout JS/CSS) | Precache on install |
| API `GET` | Network-first, fallback stale (show badge) |
| API `POST/PATCH` | Network-only; queue in IndexedDB for clock-in + draft leave (v2) |
| Payslip PDF | CacheStorage on successful download (user-initiated) |

**Libraries:** `serwist` or `@serwist/next` (Next.js 15 compatible) — evaluate at implementation.

**Update flow:** Toast “New version available” → `skipWaiting` on user tap.

### 6.3 Install experience

- **Android:** `beforeinstallprompt` → custom banner on Home after 2nd visit.
- **iOS:** Non-blocking coach mark (“Share → Add to Home Screen”) on `/ess/install`; detect `display-mode: standalone`.
- **Login:** After auth, redirect to `/ess` not `/`.

### 6.4 Push notifications (Phase 2)

- Web Push via VAPID keys (env `ESS_PUSH_*`)
- Subscribe post-login; store `EssPushSubscription` on portal user
- Events: leave approved/rejected, payslip ready, case letter, onboarding task assigned, credential expiry

Fallback: email + in-app poll (existing 60s interval → WebSocket or push later).

### 6.5 Offline & performance budgets

| Metric | Target |
|--------|--------|
| LCP (Home, 4G) | < 2.5s |
| TTI | < 3.5s |
| JS bundle (ESS route group) | < 200kb gzip initial |
| Lighthouse PWA | Installable + SW |

**Offline pages:** `/ess/offline` when navigator.onLine false and no cache.

### 6.6 Device capabilities

| API | Feature |
|-----|---------|
| Geolocation | Clock in/out |
| Camera / file | Document upload, credential renewal |
| Web Share | Share payslip PDF |
| Vibration | Optional haptic on successful clock (flag) |
| Badge API | App icon unread count (where supported) |

### 6.7 Security (PWA)

- `ess_session` httpOnly, secure, sameSite lax
- CSP allows only own origin + Blob for PDF
- No sensitive data in localStorage (session in cookie only)
- Clear caches on logout
- Biometric unlock: Phase 3 (WebAuthn passkey optional)

---

## 7. API conventions

### 7.1 Namespace

All ESS APIs under `/api/ess/*` (existing). New resources:

```
/api/ess/home-summary          GET  — inbox + widgets aggregated
/api/ess/documents             GET/POST
/api/ess/documents/[id]        GET
/api/ess/credentials           GET
/api/ess/credentials/[id]      PATCH + upload
/api/ess/onboarding/tasks      GET
/api/ess/onboarding/tasks/[id] PATCH
/api/ess/rota                  GET  — upcoming shifts
/api/ess/rota/swap             POST
/api/ess/attendance/clock      POST — geo punch
/api/ess/attendance/exceptions POST
/api/ess/pay/ytd               GET
/api/ess/pay/bank-change       GET/POST
/api/ess/hse/reports           GET/POST
/api/ess/assets                GET
/api/ess/assets/[id]/ack       POST
/api/ess/performance/...       GET/PATCH (cycle-aware)
/api/ess/team/summary          GET  — manager counts
/api/ess/push/subscribe        POST (phase 2)
```

### 7.2 Response shape

```ts
// List
{ items: T[], nextCursor?: string }

// Action errors
{ error: string, code?: 'MODULE_DISABLED' | 'VALIDATION' | 'FORBIDDEN' }

// Home summary
{
  actions: Array<{ id, type, title, subtitle, href, priority }>,
  widgets: { leave?, shift?, payslip?, attendance? },
  activity: Array<{ id, kind, title, at, href? }>,
}
```

### 7.3 Module gating

Mirror staff dashboard: middleware + handler checks `MODULE_*` and `ESS_NAV_MODULES` for routes. Return **403** with `{ code: 'MODULE_DISABLED' }` — UI hides tile, never dead links.

---

## 8. Notifications

### 8.1 Categories

| Category | Trigger | Deep link |
|----------|---------|-----------|
| `leave` | Status change, approval needed | `/ess/leave` or `/ess/team/leave` |
| `pay` | Payslip published | `/ess/payslips/[id]` |
| `time` | Exception outcome, rota change | `/ess/attendance` |
| `onboarding` | Task assigned / overdue | `/ess/onboarding` |
| `credential` | Expiry 30/7/1 days | `/ess/credentials` |
| `disciplinary` | New letter / action | `/ess/disciplinary/cases/[id]` |
| `performance` | Cycle opened / review ready | `/ess/performance` |
| `hse` | Investigation update | `/ess/hse` |

### 8.2 UI

- Header bell (existing) → full-screen sheet on mobile (not dropdown)
- `/ess/notifications` for history + filters
- Mark read / mark all (existing PATCH)

---

## 9. Component architecture (frontend)

### 9.1 New shared package (suggested paths)

```
src/components/ess/
  EssShell.tsx           — top bar + tab bar + safe areas
  EssTabBar.tsx          — 5 tabs, role-aware
  EssBottomSheet.tsx     — radix/shadcn sheet, mobile height 90vh
  EssPageHeader.tsx      — back + title + action slot
  EssHubTile.tsx         — work/pay/more tiles
  EssStatusPill.tsx
  EssFab.tsx
  EssPullRefresh.tsx
  EssOfflineBanner.tsx
  EssInstallPrompt.tsx
  EssSkeleton.tsx
```

### 9.2 Layout refactor

Replace monolithic `src/app/ess/(app)/layout.tsx` with:

- `EssShell` wrapping children
- Tab config driven by `ess-nav-catalog.ts` (parallel to `dashboard-nav-catalog.ts`)
- `filterEssNavItems` extended for hub routes

### 9.3 Data fetching

- Prefer **React Server Components** for static hubs where session can be read server-side (faster first paint)
- Client components for forms, geolocation, sheets
- `useEssMe()` hook — SWR/React Query for `/api/ess/auth/me` cache

---

## 10. Implementation phases

### Phase A — Foundation (2–3 sprints)

**Goal:** Nav + PWA shell + manager visibility; no new backend modules.

- [ ] `ess-nav-catalog.ts` + 5-tab shell
- [ ] `/ess/work`, `/ess/pay`, `/ess/more` hubs
- [ ] Rich `/ess` home (widgets from existing APIs)
- [ ] Move leave-approvals under `/ess/team`; show Team tab for managers
- [ ] ESS manifest (`start_url: /ess`, maskable icons 192/512)
- [ ] Service worker app shell + offline page
- [ ] iOS install coach + `display-mode` detection
- [ ] Pull-to-refresh on leave/payslips lists
- [ ] Bottom sheet leave request form
- [ ] `safe-area-inset` on header/tab bar
- [ ] Redirect map for old bookmarks

**Exit:** Employee installs PWA; manager approves leave from Team tab; Lighthouse “Installable”.

### Phase B — Time & pay depth (2–3 sprints)

- [ ] `/ess/rota` + API
- [ ] `/ess/attendance/clock` geo punch + admin geofence config (dashboard)
- [ ] Attendance exception request
- [ ] `/ess/pay/ytd`, bank change request workflow
- [ ] Payslip detail page + Web Share
- [ ] `/api/ess/home-summary` aggregated endpoint

**Exit:** Field worker clocks in on phone; payslip share works on Android/iOS.

### Phase C — Core HR employee lane (2 sprints)

- [ ] `/ess/documents`, `/ess/credentials`
- [ ] `/ess/onboarding` tasks
- [ ] Contract summary (read-only)
- [ ] Emergency contacts on profile
- [ ] Notification categories + deep links

**Exit:** New hire completes onboarding entirely in ESS.

### Phase D — Compliance & assets (1–2 sprints)

- [ ] `/ess/hse/report`
- [ ] `/ess/assets` + acknowledge
- [ ] Disciplinary/grievance UX polish (mobile sheets)

### Phase E — Performance & push (2 sprints)

- [ ] `/ess/performance` tied to real PM module (replace dashboard mock first)
- [ ] Web Push subscriptions + server send on key events
- [ ] Badge API for unread

### Phase F — Nice-to-have

- [ ] Internal jobs (`MODULE_ATS`)
- [ ] Dark mode
- [ ] WebAuthn passkey
- [ ] Shift swap approvals
- [ ] Offline draft queue for leave

---

## 11. Acceptance criteria (v1 complete)

1. **Coverage:** With all modules enabled, ESS exposes ≥1 employee surface per module in §4.2 (except accounts).
2. **Manager:** Line manager completes leave approval without staff dashboard.
3. **PWA:** Installable from Chrome Android + Safari iOS; `start_url` opens `/ess` authenticated or login.
4. **Mobile UX:** All primary flows completable one-handed; no horizontal tab scroll on 390px width.
5. **Performance:** Home LCP < 2.5s on Fast 3G throttled (lab).
6. **Security:** Module disabled → route 403 and nav hidden; logout clears SW caches.
7. **Docs:** Operator section in HR Admin guide + 1-page ESS user PDF with screenshots.

---

## 12. Current codebase mapping

| Spec item | Today | Action |
|-----------|-------|--------|
| 5-tab nav | Done (`EssTabBar`) | — |
| `/ess/work`, `/ess/pay`, `/ess/team`, `/ess/more` | Done | — |
| Leave approvals in nav | Done (`/ess/team/leave`) | — |
| Home inbox | Done (`/api/ess/home-summary`) | — |
| Geo clock-in | Done (`/ess/attendance/clock`, manual source + geo metadata) | Geofence admin Phase B |
| Rota in ESS | Done (`/api/ess/rota`) | — |
| Documents/credentials/onboarding | Done (read APIs + UI) | Upload flows Phase C |
| HSE/assets/performance ESS | UI + assets API; HSE report placeholder | HSE backend Phase D |
| ESS PWA manifest | Done (`/api/ess/manifest`) | Dedicated PNG icons optional |
| Service worker | Done (`public/ess-sw.js`) | Push Phase E |
| `EssPortalUser.role` | Team tab for manager/hr | — |

---

## 13. Competitive positioning

ESS v1 should answer: *“Can my employee run their work life from their phone without emailing HR?”*

| Scenario | ESS v1 |
|----------|--------|
| Request annual leave | ✓ |
| Manager approves on beach | ✓ Team tab |
| Download latest payslip | ✓ Share PDF |
| Clock in at site | ✓ Phase B |
| See next week shifts | ✓ Phase B |
| Renew driving licence on file | ✓ Phase C |
| Report warehouse near-miss | ✓ Phase D |
| Complete Q1 self-assessment | ✓ Phase E |

Staff dashboard remains the **system of record** for configuration, bulk import, payroll runs, and recruitment pipeline management.

---

## 14. Open decisions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Separate subdomain `ess.client.com`? | Same origin `/ess` for cookie simplicity unless enterprise SSO demands split |
| 2 | HR role in ESS | Read-only team views only; no extra tab |
| 3 | Outsourced employees vs internal | Same ESS; data scoped by `employeeId` on portal user |
| 4 | Language/i18n | English v1; Swahili Phase F |
| 5 | Branding | Inherit `brand` + optional `NEXT_PUBLIC_ESS_APP_NAME` |

---

## 15. Document maintenance

- Update §12 table as routes ship.
- Link phase checkboxes to GitHub issues / milestones.
- When a module reaches “market-ready” in `STRIDE-MASTER-PLAN.md`, verify §4.2 row is ✓ in ESS.

**Next engineering step:** Phase A — `ess-nav-catalog.ts`, `EssShell`, ESS scoped manifest, and `/ess/team` hub wiring for existing leave-approvals.
