# Demo contexts — bare shell + seed packs

One codebase, many demo deployments. Runtime branding comes from env vars; workforce and careers data come from **demo packs** selected by `DEMO_PACK`.

## Branding

All organisation branding (name, logo, colours, contact details, careers copy, public footer) is configured in **Dashboard → Admin → Company setup**. Demo reseed writes pack-specific values into the database; admins can change them anytime without touching env files.

`deployments/*.env` profiles only set `DEMO_PACK` and demo login hints for sales instances. `NEXT_PUBLIC_ORG_NAME` and similar vars are optional fallbacks before the first seed.

## Live switching (one database)

Seed every demo pack at once, then use the **top-bar entity switcher** to jump between company contexts — each with its own employees, payroll, branding, and legal entity:

```bash
npm run demo:reseed:all-contexts
```

The switcher lists entries like **Demo Corp Kenya Ltd** (`generic__ke`) and **Stabex Kenya Ltd** (`petroleum-retail__ke`). Selecting one scopes dashboard data to that context and loads its Company setup branding.

## Available contexts

| Context | Pack | Branding profile | Use when |
|---------|------|------------------|----------|
| `generic` | `prisma/demo-packs/generic/` | Demo Corporation | Default sales demo — neutral HRIS shell |
| `petroleum-retail` | `prisma/demo-packs/petroleum-retail/` | Stabex International | Petroleum retail vertical (legacy Stabex dataset) |

Profiles live in `deployments/<context>.env`. They set `DEMO_PACK`, `NEXT_PUBLIC_ORG_NAME`, demo login emails, and allowed staff domains.

## Switch context locally

```bash
# Apply branding/env only (no DB change)
npm run demo:context -- generic
npm run demo:context -- petroleum-retail

# Apply env + full re-seed (recommended before a demo)
npm run demo:reseed:generic
npm run demo:reseed:petroleum-retail
```

Under the hood:

```bash
node scripts/apply-demo-context.mjs <context> [--reseed]
```

After re-seeding, restart the dev server so Next.js picks up new `NEXT_PUBLIC_*` values.

## Generic demo logins

Password for all roles: value of `NEXT_PUBLIC_DEMO_PASSWORD` (default `Demo@2026!`).

| Role | Email |
|------|-------|
| Admin | `demo@demo.example.com` |
| HR | `hr.demo@demo.example.com` |
| Finance | `finance.demo@demo.example.com` |
| ESS | `employee@demo.example.com` |

## Petroleum retail logins

| Role | Email |
|------|-------|
| Admin | `demo@stabexintl.com` |
| HR | `diana.namutebi@stabexintl.com` |
| Finance | `james.mwangi@stabexintl.com` |
| ESS | `moses.okello@stabexintl.com` |

## Add a new lead context

1. Copy `prisma/demo-packs/generic/pack.ts` → `prisma/demo-packs/<vertical>/pack.ts` and tailor entities, jobs, employees, credentials.
2. Register the pack id in `prisma/demo-packs/load-pack.ts`.
3. Copy `deployments/generic.env` → `deployments/<vertical>.env` and set branding + `DEMO_PACK`.
4. Add npm script: `"demo:reseed:<vertical>": "node scripts/apply-demo-context.mjs <vertical> --reseed"`.
5. Run `npm run demo:reseed:<vertical>` and smoke-test careers + dashboard login.

## Dedicated deployment (sales URL)

For a shareable instance:

1. Create Neon DB + Vercel project for the lead.
2. Set env from `deployments/<context>.env` in Vercel (plus `DATABASE_URL`, auth secrets).
3. Deploy; run migrations; trigger seed with `DEMO_PACK=<context>` on build or via one-off command.
4. `npm run provision:check:demo` and `npm run smoke:platform` against the preview URL.

See also [`CLIENT-PROVISIONING.md`](./CLIENT-PROVISIONING.md).
