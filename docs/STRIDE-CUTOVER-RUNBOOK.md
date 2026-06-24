# Stride — Repo & Deployment Cutover Runbook

One-time migration to a clean **Stride** repo feeding the **existing** Vercel projects, plus a
**separate control-plane** deployment. **Fresh git history** (clean root commit). Tracked in Linear
under the **"Phase 00 — Repo & Deployment Cutover"** project (these steps map 1:1 to those issues).

> The codebase is already rebranded (package name `stride`, paths point at `Stride/`). This is purely
> the repo + hosting move. Order matters — do phases top to bottom.

## Current Vercel state (verified 23 Jun 2026, team `rtgprojects`)
| Project | Domain | Status | Becomes |
|---|---|---|---|
| `stride-app` | getstride.co.ke | live | Marketing site (from new repo) |
| `stride-platform` | app.getstride.co.ke | live | **KE cell** — the pooled multi-tenant product (from new repo) |
| `hris-demo` | none | empty, no deploys | **Delete** |
| *(new)* `stride-control-plane` | admin.getstride.co.ke | — | Internal control plane (separate repo + DB) |

Both `stride-app` and `stride-platform` deploy from the **same** Stride codebase (marketing + app in
one Next.js app); we point **both** at the new repo. The control plane is the only genuinely separate app.

---

## Phase 1 — Rename the workspace (you, in Finder)
> Revised 24 Jun: `HRIS DEMO` is the **workspace** holding several projects (the Stride app,
> `control-plane`, `platform` reference, docs). It is NOT an empty wrapper — do not delete it; rename it.
1. **Quit any dev servers.**
2. Rename the workspace folder `HRIS DEMO` → **`Stride`**.
3. Inside it, rename the app folder `hris-demo` → **`app`** (clearer; its git repo still becomes the
   GitHub repo `stride`). Keep `control-plane/`. Keep `platform/` for now (RAV-62 reference) — delete
   it only after `npm run test:rls` passes on the Stride app.
4. **Re-select the `Stride` folder in Cowork** so the assistant reconnects.

Target workspace layout:
```
Raven Tech Group/Stride/
├── app/                  (the Stride product → GitHub repo "stride")
├── control-plane/        (→ GitHub repo "stride-control-plane")
├── platform/             (multi-tenant REFERENCE — delete after RAV-62)
├── docs/  scripts/  brand files
```

## Phase 2 — Fresh git history (terminal, inside `Stride/`)
```bash
cd "…/Raven Tech Group/Stride"
rm -rf .git
git init -b main
git add -A
git commit -m "Initial commit — Stride platform (pooled multi-tenant direction)"
```
Before committing, `git status` must NOT list `.env.local` or `.env.production.local` (gitignored).
**Optional:** scrub the demo passwords (`Demo@2026!`) from `deployments/*.env` or gitignore them.

## Phase 3 — New GitHub repo (you, on GitHub)
1. Create a new **empty** repo `stride` (no README/license/.gitignore).
2. Push:
```bash
git remote add origin git@github.com:<your-account>/stride.git
git push -u origin main
```
This one repo feeds **both** `stride-app` and `stride-platform`.

## Phase 4 — Repoint the two existing Vercel projects (you, in Vercel)
For **`stride-app`** (marketing) and **`stride-platform`** (the app), each:
1. Settings → Git → **disconnect** the old `hris-demo` repo, **connect** the new `stride` repo (branch `main`).
2. Confirm **Root Directory** = `./` (repo root is now Stride, not a subfolder). ⚠️ critical.
3. Confirm env vars are intact (they persist on the project). `stride-platform` needs the full
   product set (DB, NEXTAUTH_SECRET, SMTP, BLOB, CRON_SECRET, MODULE_*); `stride-app` needs the
   marketing/brand vars. Use `deployments/app-getstride.env` + `deployments/marketing-getstride.env` as checklists.
4. Trigger a redeploy from `main`.
5. **Reuse the same Neon database** on `stride-platform` — re-host, not data migration. Migrations run on build.

## Phase 5 — Smoke test
```bash
SMOKE_BASE_URL=https://app.getstride.co.ke \
SMOKE_LOGIN_EMAIL=<admin> SMOKE_LOGIN_PASSWORD='<pw>' \
npm run smoke:platform
```
Confirm getstride.co.ke (marketing) and app.getstride.co.ke (product) both serve the new build.

## Phase 6 — Retire the old (you, in Vercel + GitHub)
1. **Delete** the empty `hris-demo` Vercel project.
2. Archive (or delete) the old `hris-demo` GitHub repo so nothing deploys from it by mistake.
3. Rename the Linear label `hris-demo` → `stride` (Settings → Labels — relabels all issues).
4. Update `docs/FLEET-REGISTRY.md` with the new project/URLs.

## Phase 7 — Control plane (separate app — set up alongside)
The control plane is **not** part of the Stride app. It is Raven-internal, governs entitlements/
billing/provisioning across all cells, and has its own database and restricted access.
1. **Separate GitHub repo** `stride-control-plane` (its own Next.js admin app; see Linear projects
   "Stride Commercial Control Plane" + "Control Plane UI Polish").
2. **New Vercel project** `stride-control-plane`, domain `admin.getstride.co.ke` (or a private domain).
3. **Its own database** (customers, subscriptions, billing) — separate from any tenant/cell DB.
4. Wire to cells via the `ENTITLEMENT-SYNC.md` contract: cells call the control plane for entitlements;
   control plane pushes updates. Set `CONTROL_PLANE_URL` + `CONTROL_PLANE_INSTANCE_API_KEY` on `stride-platform`.
5. Lock down access (internal auth / IP allowlist) — it must never be reachable as a tenant app.

## Target topology (after cutover)
- `stride-app` → marketing (`getstride.co.ke`) — Stride repo
- `stride-platform` → KE cell, pooled multi-tenant product (`app.getstride.co.ke`) — Stride repo
- `stride-control-plane` → internal control plane (`admin.getstride.co.ke`) — separate repo + DB
- future: `stride-platform-ug`, `stride-platform-tz` (cells); per-client projects (enterprise dedicated)

> This re-homes the **current** build. The multi-tenant re-foundation (Linear Phase 0, RAV-62–67)
> happens *after* the cutover, in the new repo, per `STRIDE-MASTER-PLAN.md`.
</content>
