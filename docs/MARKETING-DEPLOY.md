# Stride deploy — getstride.co.ke + app.getstride.co.ke

Two Vercel projects, same GitHub repo (`victorcodes63/stride.app`):

| Vercel project | Domain | Role |
|----------------|--------|------|
| `stride-app` | `getstride.co.ke` | Marketing site |
| `stride-platform` | `app.getstride.co.ke` | Product (login, dashboard, ESS) |

Env profiles: `deployments/marketing-getstride.env`, `deployments/app-getstride.env`

## Marketing — getstride.co.ke

See checklist below (stride-app).

## Platform — app.getstride.co.ke

1. **Project** — `stride-platform` on Vercel (not `hcm`).
2. **Env** — run `node scripts/setup-app-vercel-env.mjs`, then in Vercel add **DATABASE_URL** + **DIRECT_DATABASE_URL** from Neon (Settings → stride-platform → Environment Variables). Copy module/demo vars from `deployments/all-verticals.env` or your Neon-linked project if needed.
3. **Domain** — `app.getstride.co.ke` on `stride-platform`.
4. **DNS** — at host-ww.net: `CNAME app → cname.vercel-dns.com` (or target shown in Vercel).
5. **Redeploy** production after env + DNS.
6. **Marketing** — keep `NEXT_PUBLIC_APP_ORIGIN=https://app.getstride.co.ke` on `stride-app` so Sign in links hit the app subdomain.

---

## Marketing checklist (stride-app)

1. **Link project** — `cd Stride && vercel link` (or use existing Stride project).
2. **Env vars** — run:
   ```bash
   cd Stride
   node scripts/setup-marketing-vercel-env.mjs
   ```
   Or copy `deployments/marketing-getstride.env` into Vercel Production + Preview.
3. **Custom domain** — Vercel → Settings → Domains → add `getstride.co.ke` (and `www.getstride.co.ke` if needed).
4. **DNS** — point apex/`www` CNAME/A records per Vercel instructions.
5. **Redeploy** production after env + domain changes.
6. **OAuth** (if dashboard on same host) — update Microsoft/Google redirect URIs to use `NEXT_PUBLIC_SITE_URL`.

## Local preview

```bash
cd Stride
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run dev
```

Home (`/`) renders the studio-craft v3 homepage. `/v3` redirects to `/`.

## Smoke test (RAV-46)

- `/`, `/platform`, `/industries`, `/pricing`, `/about`, `/contact`
- Footer: `/privacy`, `/terms`, `/careers`
- Book demo form on `/contact`
- Mobile nav (studio-craft drawer)

## Reference

- Content config: `src/lib/marketing-config.ts`
- Env profile: `deployments/marketing-getstride.env`
