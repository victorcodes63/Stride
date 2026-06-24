# Database setup – reliable, cheap, low maintenance

## Recommendation

Use **managed PostgreSQL** with a **free tier** for dev/preview and a **low-cost paid tier** for production. This keeps the ATS reliable and maintenance minimal (no servers to patch, backups handled for you).

| Provider | Best for | Free tier | Production cost (approx) | Maintenance |
|----------|----------|-----------|---------------------------|-------------|
| **Neon** | Best balance | 0.5 GB, scale-to-zero | ~$19/mo (Pro) or pay-per-use | Very low |
| **Vercel Postgres** | If you deploy on Vercel | Same as Neon, 1-click link | Same as Neon | Very low |
| **Supabase** | If you want dashboard + auth later | 500 MB | ~$25/mo | Low |
| **AWS (RDS)** | Already on AWS, compliance, full control | 12 months free (db.t3.micro) | ~$15–30/mo after free tier | Medium |

**Suggested choice:** **Neon** (or **Vercel Postgres** if you deploy on Vercel). Both give you:

- PostgreSQL compatible with your Prisma schema (no code changes).
- Scale-to-zero so you don’t pay when the app is idle (Neon free tier).
- Automatic backups and point-in-time recovery (on paid plans).
- No server maintenance; you only manage `DATABASE_URL` and migrations.

---

## Setup: Neon (or Vercel Postgres)

This project uses **Prisma with the standard PostgreSQL protocol**. No extra Neon npm packages are required: set `DATABASE_URL` to your Neon connection string and Prisma will connect. (If you later upgrade to Prisma 6+ and deploy to serverless, you can add `@prisma/adapter-neon` for the serverless driver.)

### 1. Create the database

**Neon**

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub is fine).
2. Create a new project (e.g. `eagle-hr-ats`). When asked for **PostgreSQL version**, choose **15** or **16** (both work with Prisma; this project doesn’t require a specific version).
3. Copy the **connection string** (Postgres URL). It looks like:
   ```txt
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

**Vercel Postgres** (if you use Vercel)

1. In the Vercel project → **Storage** → **Create Database** → **Postgres** (powered by Neon).
2. Connect it to the project; Vercel will add `POSTGRES_URL` (or `DATABASE_URL`) to env.

### 2. Set `DATABASE_URL` locally

Add to `.env` (create from `.env.example` if needed):

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
```

Use the URL from Neon or Vercel. For Neon, **enable SSL** (`?sslmode=require` is usually in the URL they give you).

### 3. Run migrations

From the project root:

```bash
npx prisma migrate dev --name init
```

This creates tables for Client, Job, Candidate, Application, etc. For an existing DB you may use:

```bash
npx prisma db push
```

if you prefer to sync the schema without migration history (e.g. early prototyping).

### 4. Branches: main (production) and dev

Use two Neon branches so development doesn’t touch production data:

- **main** (or **production**) – used by your live app and production env.
- **dev** – used by your local app and day-to-day development.

**In Neon:**

1. In the left sidebar go to **Branches**.
2. Click **Create branch**.
3. Name it e.g. **dev**, and create it from your current branch (e.g. **main** or **production**). Neon will create a new branch with the same schema (and optionally copy data).
4. Open the **dev** branch → **Connection details** (or **Dashboard**) and copy that branch’s **connection string**.

**Locally:**

- In `.env` set `DATABASE_URL` to the **dev** branch connection string. Your local app and `prisma migrate dev` will then use the dev database.
- Run migrations on dev first: `npx prisma migrate dev`. When you’re ready to update production, run `npx prisma migrate deploy` against the **main** branch (e.g. by temporarily pointing `DATABASE_URL` at main, or in your production deploy step).

**Production (e.g. Vercel):**

- Set `DATABASE_URL` in production to the **main** (production) branch connection string. Production never uses the dev branch.

Summary: **dev** in `.env` for local work, **main** in production env for live traffic.

### 5. Previews (Vercel / other hosts)

- **Vercel:** Add `DATABASE_URL` in **Project → Settings → Environment Variables** for **Preview** (and Production).
- You can use the **same Neon project** and create a **branch** (e.g. `preview`) so preview deployments use a separate DB branch and don’t touch production data.
- Run migrations for preview: either in a build step (`prisma migrate deploy`) or once per branch in the Neon dashboard.

### 6. Production

- Set `DATABASE_URL` in production env to your **production** Postgres URL (Neon main branch or a dedicated production DB).
- Run migrations before/after deploy: `npx prisma migrate deploy`.
- Enable **branching** and **backups** in Neon (included on paid plans) for reliability.

### 7. Neon Auth (optional)

Neon also offers **Neon Auth**: users, roles, and sessions live in your Neon database (built on Better Auth), so you don’t need a separate auth provider. It works with **branching** – auth data clones with each DB branch, so you can test real login flows in preview without touching production.

- **Docs:** [Neon Auth overview](https://neon.tech/docs/neon-auth/overview) and [TypeScript SDK](https://neon.tech/docs/reference/javascript-sdk).
- **This ATS:** The staff dashboard currently uses a simple custom login (email + password via `/api/auth/login`). You can keep that for now and add Neon Auth later for staff (or candidate) login if you want everything in one place and branchable auth.

---

## Cost (ballpark)

- **$0:** Dev + preview on Neon free tier (0.5 GB, scale-to-zero).
- **~$19/mo (Neon Pro):** Production with more storage and no cold starts if you need it.
- **Pay-per-use:** Neon also has usage-based pricing so you only pay for what you use if traffic is low.

No VPS, no manual backups, no DB server maintenance – that keeps ongoing cost and maintenance minimal while staying reliable.

---

## What about AWS?

**AWS RDS (PostgreSQL)** is very reliable and fits well if you’re already on AWS or need everything in one cloud (compliance, VPC, IAM). For “cheap + minimal maintenance” it’s usually **not** the best first choice:

| | Neon / Vercel Postgres | AWS RDS |
|--|------------------------|---------|
| **Cost at low scale** | Free tier + scale-to-zero; paid only when you need it | Instance runs 24/7; minimum ~$15–30/mo (db.t3.micro or similar) after 12‑month free tier |
| **Maintenance** | Set `DATABASE_URL`, run migrations | VPC, security groups, parameter groups, backup retention, (optional) minor version upgrades |
| **When it shines** | Lowest cost and ops for a small/medium ATS | Already on AWS, need DB in your VPC, or strict “all in one account” requirements |

**AWS options:**

- **RDS for PostgreSQL** – Classic managed Postgres. Pick instance size (e.g. db.t3.micro for dev, db.t3.small for production). You pay for the instance and storage; no scale-to-zero. Automated backups and Multi-AZ available.
- **Aurora PostgreSQL (Serverless v2)** – Scales with load but has a minimum capacity (and minimum cost). Suits variable production traffic, not “as cheap as possible” at low usage.

**If you choose AWS RDS:**

1. In **AWS Console** → RDS → **Create database** → **PostgreSQL**, engine 15 or 16.
2. Template: **Free tier** (12 months) or **Dev/Test**.
3. Set master username/password, instance size (e.g. db.t3.micro), storage (e.g. 20 GB GP3).
4. **Public access:** Yes if your app (e.g. Vercel) is outside AWS; No if the app runs in the same VPC. Adjust **VPC security group** so the app can reach the DB (inbound rule for Postgres port 5432 from the app’s IP or security group).
5. Create the DB; copy the **endpoint** and build the URL:
   ```txt
   postgresql://masteruser:yourpassword@endpoint.region.rds.amazonaws.com:5432/postgres?schema=public
   ```
6. Set `DATABASE_URL` in `.env` and in your deployment (Vercel, etc.). Use SSL in production: add `?sslmode=require` (or configure RDS to require SSL).
7. Run migrations: `npx prisma migrate dev` (local) and `npx prisma migrate deploy` in production.

**Summary:** AWS is a solid, reliable option and makes sense if you’re standardising on AWS or have compliance/network needs. For “as cheap as possible with minimum maintenance,” Neon or Vercel Postgres usually wins; for “everything in AWS with full control,” RDS is the right fit.
