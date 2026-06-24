# Deploy checklist – main site

## Done (fixed in this session)

1. **Payslips page** – `useSearchParams` wrapped in Suspense (was blocking build).
2. **Interview schedule PDF** – Removed unused variable (lint).

## Before pushing

### 1. Database migration (required)

Migration `20260302000000_add_application_views` has failed on the production DB.

**Option A: Mark as rolled back and re-apply**

```bash
npx prisma migrate resolve --rolled-back 20260302000000_add_application_views
npx prisma migrate deploy
```

**Option B: If the `ApplicationView` table was partially created**

1. Inspect the database – see if `ApplicationView` exists.
2. If it exists and is fine, mark as applied:
   ```bash
   npx prisma migrate resolve --applied 20260302000000_add_application_views
   ```
3. Then run:
   ```bash
   npx prisma migrate deploy
   ```

### 2. Build command

If your host runs migrations in the build, ensure they succeed. Otherwise use:

```bash
prisma generate && next build
```

(Some platforms run `prisma migrate deploy` separately in a release step.)

### 3. Lint (optional)

There are 36 lint errors and 139 warnings. The build skips lint, so they do not block deployment. To fix later:

```bash
npm run lint -- --fix
```

---

## Summary

| Item                    | Status     |
|-------------------------|------------|
| Next.js build           | ✓ Passes   |
| Payslips page Suspense  | ✓ Fixed    |
| Interview PDF lint      | ✓ Fixed    |
| Prisma migration        | ⚠ Must resolve before deploy |
| Lint errors             | Non-blocking (139 warnings, 36 errors) |
