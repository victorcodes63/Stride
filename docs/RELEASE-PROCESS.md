# Release process

How to ship code updates to **multiple dedicated client deployments** safely.

---

## Principles

1. **One codebase** — all clients run the same `Stride` repository
2. **Separate deploys** — each client has its own Vercel project and database
3. **Additive migrations** — never drop columns or tables without client sign-off
4. **Test before fleet** — staging deploy + smoke test before production clients

---

## Branching and tags

| Branch / tag | Purpose |
|--------------|---------|
| `main` | Integration branch; auto-deploys internal demo only |
| `release/vX.Y.Z` | Stabilisation branch before client promotion |
| `vX.Y.Z` git tag | Immutable release marker for fleet registry |

Create a release:

```bash
git checkout main
git pull
npm run test:run
npm run build
git tag -a v0.4.0 -m "Release 0.4.0 — Phase 0 platform foundation"
git push origin v0.4.0
```

---

## Release checklist

### Before tagging

- [ ] All migrations committed under `prisma/migrations/`
- [ ] `npm run test:run` passes
- [ ] `npm run build` passes locally
- [ ] Changelog / release notes drafted (client-facing if breaking)
- [ ] New env vars documented in `.env.example`

### Staging deploy

1. Deploy tag to **staging** Vercel project (shared internal instance)
2. Run migrations (automatic on build if `RUN_MIGRATIONS_ON_BUILD` default)
3. Run smoke test:

```bash
SMOKE_BASE_URL=https://staging.hris.example.com \
SMOKE_LOGIN_EMAIL=… \
SMOKE_LOGIN_PASSWORD=… \
npm run smoke:platform
```

4. Manual QA on critical paths: login, employee CRUD, payroll draft, ESS login

### Client promotion

For each client in [`FLEET-REGISTRY.md`](./FLEET-REGISTRY.md) with status **Live** or **Pilot**:

1. Confirm no client-specific env changes needed
2. Promote deploy in Vercel (or merge to client-connected branch)
3. Watch build logs for migration success
4. Run `smoke:platform` against client URL
5. Update fleet registry **Last deploy** and **Git tag** columns
6. Notify client if user-visible changes or downtime expected

**Order:** Pilot clients first → Live clients in low-traffic window (evening EAT).

---

## Migration rules

| Allowed | Not allowed without approval |
|---------|------------------------------|
| Add tables, columns, indexes | Drop columns / tables |
| Backfill with defaults | Destructive data transforms |
| Add nullable fields | Rename columns in place |

If a breaking migration is unavoidable:

1. Schedule maintenance window with client
2. Take Neon branch snapshot / backup
3. Run migrate deploy
4. Verify smoke test

### Rollback

- **Application:** Vercel → Deployments → Promote previous deployment
- **Database:** Neon point-in-time restore or branch reset (migrations are not auto-reversed)

---

## Environment variable changes

When a release introduces new env vars:

1. Add to `.env.example` with comments
2. Update [`CLIENT-PROVISIONING.md`](./CLIENT-PROVISIONING.md) if required for new clients
3. Set vars in each Vercel project **before** deploy if the app fails without them
4. Module flags (`MODULE_*`) can be changed without redeploying code — but always redeploy to refresh edge middleware cache after env change

---

## CI recommendations (future)

```yaml
# .github/workflows/release.yml (sketch)
# on push tag v*:
#   - npm ci && npm run test:run && npm run build
#   - optional: smoke against staging URL from secrets
```

---

## Communication template (client email)

> Subject: HRIS update — {date}
>
> We deployed version **vX.Y.Z** to your dedicated HRIS instance at {url}.
>
> **What's new:** {bullet points}
>
> **Action required:** {none / new env / training}
>
> No other clients share your environment — this update applies only to your instance.

---

## Related docs

- [`CLIENT-PROVISIONING.md`](./CLIENT-PROVISIONING.md)
- [`FLEET-REGISTRY.md`](./FLEET-REGISTRY.md)
