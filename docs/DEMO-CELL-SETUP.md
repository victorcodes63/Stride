# Demo cell — `demo.getstride.co.ke`

Isolated **production-like** sandbox for SwiftFreight showcase. Uses its own Neon project — never shares data with `app.getstride.co.ke`.

| Cell | URL | Neon | Purpose |
|------|-----|------|---------|
| Customer | app.getstride.co.ke | stride-platform DB | Paying tenants (Raven, etc.) |
| Demo | demo.getstride.co.ke | **stride-demo** | Sales sandbox, local dev against demo data |

## One-time setup

### 1. Neon credentials

Copy `.env.demo-cell.example` → `.env.demo-cell.local` and paste owner URLs from [Neon console](https://console.neon.tech) (project **stride-demo**, id `restless-darkness-81256455`).

### 2. Provision database

```bash
npm run demo:cell:provision
```

Runs: schema push → stride_app role → SwiftFreight (`cargo-logistics`) seed → verified email domains for login.

**Demo login:** `admin@imara.co.ke` / `Demo@2026!`

**Note:** Demo Neon uses `prisma db push` (not `migrate deploy`) because fresh DBs hit migration-order deps. Vercel demo builds set `RUN_MIGRATIONS_ON_BUILD=false`.

### 3. Deploy Vercel project

```bash
npm run demo:cell:deploy
```

Creates/links **stride-demo** Vercel project, pushes env from `deployments/demo-getstride.env`, deploys production.

### 4. DNS

Point `demo.getstride.co.ke` CNAME → Vercel (or use Vercel domain UI on stride-demo).

## Local development against demo DB

```bash
npm run demo:cell:local   # .env.local → demo Neon + SwiftFreight profile
npm run dev
```

Keep a backup of your production `.env.local` before switching.

## Reseed demo only (safe — separate Neon)

```bash
npm run demo:cell:provision
```

## Multi-vertical demo (optional)

To seed all sectors instead of SwiftFreight-only, edit `scripts/provision-demo-neon-cell.mjs` to run `demo:reseed:all-verticals` and set `deployments/demo-getstride.env` to `deployments/all-verticals.env` profile.

## Control plane

Register the demo cell as customer **`stride-demo`** (`SwiftFreight East Africa Ltd`) pointing at `https://demo.getstride.co.ke`.

1. Ensure `STRIDE_CELL_PROVISION_KEY` is set on **stride-demo** Vercel (same value as control plane) — `npm run demo:cell:deploy` copies it from `.env.local` when present.
2. After `npm run demo:cell:provision`, link the tenant org:

```bash
cd ../control-plane
npm run demo:cell:link-control-plane
```

Uses org slug `demo-cargo-logistics` from the SwiftFreight seed. Opens **Customers → stride-demo → Users** for operator user management on the sandbox.

`DEMO_MODE=true` still licenses all modules on the instance; the control-plane row is for Raven operator tooling (Users tab, entitlement sync tests).

## Related

- ISO-01 split: `docs/VICTOR-TODO-ISO-01-DEMO-SPLIT.md`
- Customer cell: `deployments/app-getstride.env`
