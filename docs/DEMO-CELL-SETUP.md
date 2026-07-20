# Demo cell — `demo.getstride.co.ke`

Isolated **production-like** sandbox for the **multi-vertical industry tour**. Uses its own Neon project — never shares data with `app.getstride.co.ke`.

| Cell | URL | Neon | Purpose |
|------|-----|------|---------|
| Customer | app.getstride.co.ke | stride-platform DB | Paying tenants (Raven, etc.) |
| Demo | demo.getstride.co.ke | **stride-demo** | Sales sandbox — six companies, top-bar switcher |

**Local/dev** stays on Savannah Freight single-company (`deployments/cargo-logistics.env` / `.env.local`). Do not point day-to-day feature work at the multi-vertical live cell unless you intend to.

## One-time setup

### 1. Neon credentials

Copy `.env.demo-cell.example` → `.env.demo-cell.local` and paste owner URLs from [Neon console](https://console.neon.tech) (project **stride-demo**, id `restless-darkness-81256455`).

### 2. Provision database (multi-vertical)

```bash
npm run demo:cell:provision
# or full prep + smoke checklist:
npm run demo:prep:live
```

Runs: schema push → stride_app role → all showcase packs + enrichment (sector data, fleet, sales) → verified email domains.

**Companies in the switcher**

| Pack | Company |
|------|---------|
| imara-sacco | Heritage Members SACCO |
| petroleum-retail | Northline Petroleum |
| cargo-logistics | Savannah Freight |
| hospital-healthcare | Amani Medical Centre |
| travel-agency | Horizon Travels |
| construction | Kilimani Builders |

**Demo login:** `admin@imara.co.ke` / `Demo@2026!` (one login for every company)

**Note:** Demo Neon uses `prisma db push` (not `migrate deploy`) because fresh DBs hit migration-order deps. Vercel demo builds set `RUN_MIGRATIONS_ON_BUILD=false`.

### 3. Deploy Vercel project

```bash
npm run demo:cell:deploy
```

Creates/links **stride-demo** Vercel project, pushes env from `deployments/demo-getstride.env` (multi-context + switcher), deploys production.

### 4. DNS

Point `demo.getstride.co.ke` CNAME → Vercel (or use Vercel domain UI on stride-demo).

## Local development

**Feature work (recommended):** keep `.env.local` on Savannah single-pack:

```bash
npm run demo:reseed:cargo-logistics   # or your existing local DB
npm run dev
```

**Against demo Neon (optional):**

```bash
npm run demo:cell:local   # .env.local → demo Neon + profile merge
npm run dev
```

Keep a backup of your production `.env.local` before switching.

## Reseed demo only (safe — separate Neon)

```bash
npm run demo:prep:live
# or:
npm run demo:cell:provision
npm run demo:reseed:production   # pulls Vercel production DB URLs, multi-vertical reseed
```

## Client demo tips

- Lead with people ops + payroll + ATS on any company.
- Switch to **Savannah Freight** for the full platform (fleet, sales, outsourcing).
- Other companies hide irrelevant modules in the sidebar (industry packs).
- SACCO / healthcare / energy domain screens are light illustrations (modules still planned) — use for narrative, not deep workflows.
- ESS: `moses.okello@savannahfreight.co.ke` / `Demo@2026!` when on logistics context.

See also: `docs/DEMO-LIVE-CHEATSHEET.md`.

## Control plane

Register the demo cell as customer **`stride-demo`** pointing at `https://demo.getstride.co.ke`.

1. Ensure `STRIDE_CELL_PROVISION_KEY` is set on **stride-demo** Vercel (same value as control plane) — `npm run demo:cell:deploy` copies it from `.env.local` when present.
2. After `npm run demo:cell:provision`, link the tenant org:

```bash
cd ../control-plane
npm run demo:cell:link-control-plane
```

Uses org slug `demo-multi-vertical` (shared tenant for the industry tour). Opens **Customers → stride-demo → Users** for operator user management on the sandbox.

`DEMO_MODE=true` still licenses all modules on the instance; the control-plane row is for Raven operator tooling (Users tab, entitlement sync tests).

## Related

- ISO-01 split: `docs/VICTOR-TODO-ISO-01-DEMO-SPLIT.md`
- Customer cell: `deployments/app-getstride.env`
- Local multi-vertical (optional): `deployments/all-verticals.env` + `npm run demo:reseed:all-verticals`
