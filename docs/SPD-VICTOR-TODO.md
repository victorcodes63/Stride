# VICTOR TODO — Stride performance (SPD-02 / SPD-03)

These require Vercel / Neon dashboard access. Do **not** change in code without updating production env.

## SPD-02 (RAV-275) — Neon pooled runtime URL

**Local `.env.local` already uses a pooler host** (`*-pooler.*.neon.tech`) for `DATABASE_URL` ✓

**Verify on Vercel (stride-platform / app.getstride.co.ke):**

| Variable | Expected |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string (`host` contains `-pooler`) |
| `DIRECT_DATABASE_URL` | Neon **direct** host (no `-pooler`) for `prisma migrate deploy` only |

If production `DATABASE_URL` is direct (no `-pooler`), update in Vercel → Settings → Environment Variables for **Production** and **Preview**, then redeploy.

## SPD-03 (RAV-276) — Function region vs Neon

Demo DB branches in `.env.local` mix **eu-central-1** and **us-east-1** Neon endpoints. Cross-region adds ~100–200ms+ per query round-trip.

**Action:**

1. Confirm primary Neon project region (target: **London / eu-west-2** or closest to users).
2. In Vercel project **stride-platform** → Settings → Functions → **Region**, set to match Neon (e.g. `lhr1` if Neon is `eu-west-2`).
3. Align `DATABASE_URL` Neon branch to the same region as Vercel functions.

Until aligned, expect elevated latency on all SPD-00 hot routes regardless of indexes.
