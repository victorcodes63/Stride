# Reset database for go-live and deploy to Vercel

Use this when you want to clear all applications, jobs, candidates, interviews, and clients so the site is clean for real traffic. Staff accounts (Users) and Insights are kept.

## 1. Reset the database

### Option A: Reset production (Vercel Postgres / hosted DB)

Set your **production** `DATABASE_URL` and run the script:

```bash
# From project root. Replace with your production connection string.
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require" npm run db:reset-for-go-live
```

- In Vercel: Project → Storage → your Postgres → **.env.local** or **Connect** tab shows the URL. Copy it into `.env` temporarily or pass inline as above.
- Or add `DATABASE_URL` to your shell environment and run: `npm run db:reset-for-go-live`

### Option B: Reset local first, then deploy (production DB reset later)

```bash
# Local
npm run db:reset-for-go-live
```

Then for production you still need to run the script once against the production `DATABASE_URL` (see Option A).

## 2. Push to Vercel

```bash
git add .
git commit -m "Add db reset script and reset data for go-live"
git push origin main
```

If your Vercel project is connected to this repo, it will deploy from `main`. The reset script does **not** run on deploy; it only runs when you execute it manually with the target `DATABASE_URL`.

## 3. Reset production DB after deploy (if you didn’t in step 1)

After the first deploy, run the reset **once** against production so the live site has no test data:

```bash
DATABASE_URL="<your-vercel-postgres-url>" npm run db:reset-for-go-live
```

Use the production `DATABASE_URL` from Vercel (Project → Storage → Postgres → connection string).

## What gets cleared


| Cleared     | Kept                 |
| ----------- | -------------------- |
| Interview   | User (staff logins)  |
| Application | Insight (blog)       |
| Job         | Schema (tables stay) |
| Candidate   |                      |
| Client      |                      |


## Safety

- The script only **deletes rows**; it does not drop tables or migrations.
- Run it only when you intend to wipe the above data (e.g. before go-live or for a one-off cleanup).

