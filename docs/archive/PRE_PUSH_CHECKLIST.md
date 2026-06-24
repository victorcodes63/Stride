# Pre-Push Checklist: Live Site Safety

## Summary: Your Push is Safe

Pushing this version will **not** interfere with the live site's functionality, as long as you follow the steps below. The two Neon instances remain completely separate — deployment uses whatever `DATABASE_URL` is set in each environment.

---

## 1. Environment & Database Isolation

| Item | Status |
|------|--------|
| `.env` is in `.gitignore` | Yes — credentials are never committed |
| `DATABASE_URL` comes from environment | Yes — each deployment uses its own env vars |
| Dev Neon vs Prod Neon | Separate — Vercel production uses the `DATABASE_URL` you configured for production |

**Result:** Pushing code does not change which database the live site uses. Production keeps using its own Neon instance.

---

## 2. Schema & Migrations

### New migrations (will run on first deploy after push)

| Migration | Changes | Risk |
|-----------|---------|------|
| `20260219044835_add_interview_confirmation` | Adds `ConfirmationStatus` enum; adds `confirmationStatus`, `confirmationNotes`, `confirmationAt` to `Interview`; adds `Insight_slug_idx`, `Job_slug_idx` | Low — additive only |
| `20260219114350_add_withdrawn_confirmation_status` | Adds `withdrawn` to `ConfirmationStatus` enum | Low — additive only |

**All changes are additive:**
- New enum and new columns with defaults
- No drops, renames, or data migrations
- Existing rows get default values
- No destructive changes to existing tables

---

## 3. Recommended Steps Before Pushing

### A. Run migrations on production DB first (safest)

If you can connect to the production Neon DB directly:

```bash
# Temporarily use production DATABASE_URL
DATABASE_URL="<your-production-neon-url>" npx prisma migrate deploy
```

This runs only pending migrations. If all 17 migrations are already applied (including the 2 new ones), it will do nothing.

### B. Or let Vercel run migrations on deploy

If your Vercel project runs migrations on build, update the build script to:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

Then migrations run during deployment, against the production `DATABASE_URL` in Vercel.

### C. Verify production env vars in Vercel

In Vercel → Project → Settings → Environment Variables, ensure:

- `DATABASE_URL` → Production Neon URL (live site DB)
- `SMTP_*` / `MS_*` → Email config
- `INTERVIEW_CONFIRM_SECRET` → Set for interview links
- Other required vars (see `.env.example`)

---

## 4. Code Changes That Touch the Database

| Change | Impact |
|--------|--------|
| `confirmationStatus`, `confirmationNotes`, `confirmationAt` | New columns; app expects them after migration |
| `locationOrLink` required on new interviews | Validation only; existing NULL rows remain valid |
| `isActive` on Job (PATCH) | New optional field; backward compatible |
| Contact form API | No DB; sends email only |

---

## 5. Test Endpoints (Dev-Only)

These routes return 404 in production and are for local testing only:

- `/api/test/send-rejection`
- `/api/test/send-invite`
- `/api/test/send-invites-for-interviews`

---

## 6. Final Checklist

- [ ] `.env` is **not** staged for commit
- [ ] Production `DATABASE_URL` in Vercel points to the live Neon instance
- [ ] Migrations have been run on production (or will run on deploy)
- [ ] You have tested the new features locally

---

## Guarantee

**Pushing this code will not:**
- Overwrite or mix dev and production databases
- Drop tables or columns
- Break existing functionality (as long as migrations are applied)

**The live site will:**
- Continue using its own Neon instance
- Receive the new features after a successful deploy
- Work normally once migrations are applied
