# Stride — Authentication & SSO (multi-tenant)

How sign-in works across many companies on the shared pooled deployment. Pairs with
`ENTITLEMENT-SYNC.md` (tier gating) and `STRIDE-PACKAGING.md` (what each tier unlocks).

## The model (decided 27 Jun 2026)
**Shared multi-tenant OAuth apps + per-tenant config in the DB. No per-company secrets, no per-company
Vercel env vars.**

- **One Stride-owned Microsoft Entra app**, registered **multi-tenant** (`common` endpoint,
  work/school accounts). One Stride-owned **Google OAuth** app (Workspace). Their client ID/secret are
  **Stride's, stored once** — NOT per customer. The legacy `MS_CLIENT_ID/SECRET` + `STAFF_ALLOWED_DOMAIN`
  per-deployment env pattern is **retired** (it was single-tenant only).
- **Per-company auth config lives in the database** (Company Setup + control plane), resolved at runtime:
  - `enabledProviders`: any of `microsoft` | `google` | `credentials`
  - `allowedEmailDomains`: e.g. `["acme.co.ke"]` (verified — see below)
  - `lockedMsTenantId` (optional): restrict to that company's Microsoft tenant
  - `ssoEnforced` (optional): disable password login for that org
  - `jitProvisioning` (optional): auto-create users on first SSO login vs invite-only
- **Org resolution by email domain.** An OAuth token gives email + domain → match domain to the Stride
  org → verify the org has that provider enabled + domain allow-listed → sign in / provision.
- Onboarding company #101 = **a DB row in the control plane**, not a Vercel change.

## Sign-in UX — email-first
Everyone hits `app.getstride.co.ke`. Flow: user enters email → Stride resolves their org by domain →
renders only that org's enabled method(s) (Microsoft only, Google only, or password). Most companies
pick one. Credentials remain a fallback unless `ssoEnforced`.

## Tier gating (entitlements)
- **Credentials** — all tiers.
- **Microsoft / Google OAuth** — Growth and above.
- **Enterprise SAML / bring-your-own-IdP, enforced SSO, custom domain** — Enterprise only.
Company Setup shows Enterprise-only sections in a locked/upgrade state for Starter/Growth.

## Security must-haves
1. **Domain verification (DNS TXT)** before any domain-based auto-join — otherwise someone could claim
   `@safaricom.co.ke`. No JIT provisioning on an unverified domain.
2. **Credentials fallback** unless the org enforces SSO.
3. Restrict Microsoft to work/school accounts; Google to Workspace `hd` matching the allow-list (no
   consumer Gmail auto-join). Match `tid`/domain to the right org; never cross-provision.

## Enterprise SAML (later, Enterprise add-on)
True SAML / customer-owned IdP (Okta, Azure AD SAML) is heavier and per-tenant. Do NOT hand-roll —
use a connector service (WorkOS / Auth0 Enterprise Connections) as an Enterprise add-on. OAuth covers
~95% of the EA market; SAML is the few large regulated deals.

## Control plane
Per-tenant auth config is set/managed in the control plane per customer and pushed to the instance via
entitlement sync (same channel as modules) — so auth setup is part of provisioning, not a code/env task.

**Responsibility split:** in-app **Company Setup (AUTH-06) is the PRIMARY, self-serve surface** — the
client's own admin picks provider(s) and verifies domains there; this is the path that scales to 100+
clients. The **control plane (AUTH-07) is SECONDARY** — it sets the *entitlement* (whether SSO is
available for that tier) and provides an operator override for white-glove onboarding/support. Control
plane decides *if*; the client admin decides *how*. Raven (customer zero) configures SSO in Company
Setup to dogfood the real client flow.
</content>
