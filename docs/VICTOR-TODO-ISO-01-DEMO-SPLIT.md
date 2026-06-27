# VICTOR TODO — ISO-01 Demo / customer cell split

**Do not apply from CI/agent.** Manual Vercel + DNS changes after reviewing branch `iso/tenant-hardening`.

## Goal

- **Demo cell:** `demo.getstride.co.ke` — SwiftFreight vertical showcase, demo login hints, seeded data.
- **Customer cell:** `app.getstride.co.ke` — paying tenants only, no demo env, no SwiftFreight fallbacks in code.

Code on this branch already ignores `NEXT_PUBLIC_ORG_NAME` on customer cells (`isDemoSandboxCell()` requires `DEMO_MODE` **and** `DEMO_PACK` or `NEXT_PUBLIC_DEMO_MODE`). You still need the env split so production customer cell does not ship demo vars.

---

## 1. New Vercel project (or duplicate deploy): `stride-demo`

| Variable | Value |
|----------|--------|
| `SITE_MODE` | `app` |
| `NEXT_PUBLIC_SITE_URL` | `https://demo.getstride.co.ke` |
| `NEXT_PUBLIC_APP_ORIGIN` | `https://demo.getstride.co.ke` |
| `DEMO_MODE` | `true` |
| `DEMO_PACK` | `cargo-logistics` |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_ORG_NAME` | `SwiftFreight East Africa Ltd` |
| `NEXT_PUBLIC_RECRUITMENT_EMPLOYER_NAME` | `SwiftFreight East Africa Ltd` |
| `NEXT_PUBLIC_SHOW_DEMO_LOGIN_HINT` | `true` (optional) |
| `DATABASE_URL` | Same Neon as today **or** separate demo Neon (recommended long-term) |
| `DIRECT_DATABASE_URL` | Owner URL for migrations |

DNS: `demo.getstride.co.ke` → this Vercel project.

---

## 2. Strip from `stride-platform` production (`app.getstride.co.ke`)

**Remove** (or set empty / false):

```
DEMO_MODE
DEMO_PACK
NEXT_PUBLIC_DEMO_MODE
NEXT_PUBLIC_ORG_NAME
NEXT_PUBLIC_RECRUITMENT_EMPLOYER_NAME
NEXT_PUBLIC_SHOW_DEMO_LOGIN_HINT
NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX
```

**Keep:**

```
SITE_MODE=app
NEXT_PUBLIC_SITE_URL=https://app.getstride.co.ke
NEXT_PUBLIC_APP_ORIGIN=https://app.getstride.co.ke
DATABASE_URL=… (unchanged until ISO-06)
DIRECT_DATABASE_URL=…
STRIDE_CELL_PROVISION_KEY=…
RESEND_API_KEY=…
MS_CLIENT_* / STRIDE_GOOGLE_* (as configured)
```

Reference file to update after deploy: `app/deployments/app-getstride.env` (remove lines 14–22 demo block).

---

## 3. Verify after env split

1. Sign in on `app.getstride.co.ke` as Raven admin → header shows **Raven Tech Group**, empty dashboard.
2. Open `demo.getstride.co.ke` → SwiftFreight demo, login hints, seeded employees.
3. No SwiftFreight string on customer cell (search page source / network bootstrap payload).

---

## 4. Optional: separate Neon for demo

Reduces blast radius: demo seed/migrations cannot touch customer data. Provision via control plane as a second **cell** when ready.
