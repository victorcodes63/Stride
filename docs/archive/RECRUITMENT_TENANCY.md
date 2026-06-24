# Recruitment: single-organization tenancy

Recruitment is modeled as **one employer** (your org) posting jobs and receiving applications. Multi-employer “recruitment agency clients” were removed from the product surface.

## Database

- `**RecruitmentSettings`** (single row, `id = "default"`): `employerName`, optional contacts, optional `linkedClientId` → legacy `Client` row used for Accounts (`type: recruitment`) and optional `Job.clientId`.
- `**Client**` (recruitment): kept for Accounts linkage and Prisma relations; **do not** add multiple employers for ATS workflows.
- **Migration**: `prisma/migrations/20260428140000_recruitment_settings_single_tenant/migration.sql` creates the table, inserts the default row, links the earliest existing `Client` if any, and backfills `Job.clientId` where null.

## API


| Route                                                             | Role                                                                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GET` / `PATCH` `/api/recruitment-settings`                       | Staff: read/update org name and contacts; syncs linked `Client.name`/contacts when `linkedClientId` is set.            |
| `GET` `/api/clients`                                              | Returns `[]` (legacy).                                                                                                 |
| `POST` `/api/clients`, `GET`/`PATCH`/`DELETE` `/api/clients/[id]` | `410` — use recruitment settings instead.                                                                              |
| `POST` `/api/recruitment-client-portal-users`                     | `410` — external employer portal logins deprecated. `GET` / `PATCH` / `DELETE` on `[id]` still work for existing rows. |


## Dashboard routes touched

- `**/dashboard/recruitment/organization`** — edit employer name and contacts.
- `**/dashboard/clients`, `/dashboard/clients/new`, `/dashboard/clients/[id]/edit**` — redirect to Organization.
- Nav: **Organization** replaces **Clients** under Recruitment.
- **Applications**, **Interview management**, **Schedule interviews**: client filters removed; job search only.
- **Job create/edit**: no client picker; default name from `/api/recruitment-settings`.
- `**/dashboard/users/recruitment-clients`**: legacy portal user list only; no `GET /api/clients`; banner points to Staff + Organization; create disabled (`POST` → `410`); edit does not change `clientId`.
- **Accounts → New billing client → Recruitment**: options come from `linkedClientId` on recruitment settings.

## Env vars

- `NEXT_PUBLIC_RECRUITMENT_EMPLOYER_NAME` — optional; public default employer label when DB unavailable (dev).
- `RECRUITMENT_EMPLOYER_NAME` — same, server-side fallback in `recruitment-workspace.ts`.

## Out of scope (unchanged)

- **Outsourcing** (`OutsourcingClient`, payroll, rota, `lib/payroll-calc`).
- **Accounts** billing model beyond recruitment sync now targeting the linked org client only (`src/lib/sync-accounts-clients.ts` + `prisma/lib/sync-linked-billing-clients.js`).

