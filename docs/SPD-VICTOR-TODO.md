# SPD-02 / SPD-03 — Completed 2026-07-06 ✓

**Status:** Production live at `app.getstride.co.ke` with `stride_app` pooled runtime URL (redeploy 2026-07-06).

## SPD-02 (RAV-275) — Neon pooled runtime URL ✓

**stride-platform production** (`app.getstride.co.ke`):

| Variable | Status |
| --- | --- |
| `DATABASE_URL` | **stride_app** on Neon **pooler** host (`*-pooler.*.neon.tech`) — updated via `push-stride-app-db-role-env.mjs` |
| `DIRECT_DATABASE_URL` | **neondb_owner** direct host (no `-pooler`) — migrations only |
| `POSTGRES_PRISMA_URL` | Same pooled URL as `DATABASE_URL` |

Previously production pulled empty strings for these keys (Vercel marks sensitive vars as `""` on `vercel env pull` — values are set server-side).

**Preview:** production push succeeded; preview wildcard push failed (Vercel CLI). Re-run preview manually if needed:

```bash
node scripts/setup-stride-app-db-env.mjs   # if .stride-app-env.json missing
node scripts/push-stride-app-db-role-env.mjs
```

## SPD-03 (RAV-276) — Function region vs Neon ✓

| Layer | Region |
| --- | --- |
| Neon (`noisy-fire-82362088`) | **us-east-1** (`ep-rough-term-at0ta23b`) |
| Vercel functions | **iad1** (Washington DC) — matches Neon US East |

`vercel.json` now sets `"regions": ["iad1"]` explicitly.

**Note:** `STRIDE-PLATFORM-OVERVIEW.md` mentions eu-central for stride-platform; live Neon endpoint is **us-east-1**. Moving to London (`lhr1`) would require migrating the Neon project/branch to `eu-west-2` first — not done here.

## Redeploy

Production picks up new `DATABASE_URL` on the next deploy. This Neon project has **no `_prisma_migrations` table** (schema maintained via `db push`), so **`RUN_MIGRATIONS_ON_BUILD=false`** is set on Vercel production — same pattern as the demo cell.

Redeploy the last good production build (does not ship unmerged perf branch code):

```bash
vercel redeploy https://stride-platform-kmj60orpk-rtgprojects.vercel.app --scope rtgprojects
```

`scripts/prisma-migrate-deploy.js` also treats P3005 as non-fatal for future builds that opt into migrate deploy.

## Preview env

Preview has no explicit `DATABASE_URL` in Vercel env (Neon integration / dashboard may supply at deploy time). CLI `vercel env add … preview --sensitive` currently fails from this machine — set preview DB URLs in the Vercel dashboard if preview builds need the `stride_app` role explicitly.
