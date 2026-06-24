# Staff dashboard auth – reference & wiring

This document describes how staff dashboard authentication works: email/password, Microsoft OAuth, Google OAuth, and session handling.

---

## Overview

- **Purpose:** Protect `/dashboard` and dashboard routes so only staff can access them.
- **Method:** Cookie-based `staff_session` with optional Prisma `User` allowlist for production.
- **Public routes:** `/dashboard/login` and `/dashboard/forgot-password` are not protected.

---

## Environment variables

### Core (staff)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Production:** yes (for allowlist + password hashes) | PostgreSQL connection. Without it, a dev-only legacy path may apply. |
| `STAFF_ALLOWED_DOMAIN` | No (default `example.com`) | Only emails in this domain may sign in (password and OAuth). |
| `STAFF_PASSWORD` | **Production:** yes if using password login | Shared password is not the primary path when `User` rows exist; see `api/auth/login`. |
| `STAFF_EMAIL` | No | If set, only this email may use password login (optional extra lock). |
| `STAFF_SESSION_DAYS` | No (default `7`) | Session cookie max age in days. |
| `NEXT_PUBLIC_SITE_URL` | **Recommended in production** | Canonical site URL; used for OAuth redirect URI construction and should match the URL registered with IdPs. |

### Microsoft OAuth (optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `MS_TENANT_ID` | No (default `common`) | Entra / Azure AD tenant. |
| `MS_CLIENT_ID` | Yes, to enable Microsoft SSO | App registration client ID. |
| `MS_CLIENT_SECRET` | Yes, to enable Microsoft SSO | App registration secret. |
| `MS_REDIRECT_URI` | No | Override callback URL; default is `{NEXT_PUBLIC_SITE_URL or origin}/api/auth/microsoft/callback`. |
| `MS_OAUTH_DEBUG` | No | Set `true` for verbose server logs (troubleshooting only). |

### Google OAuth (optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes, to enable Google SSO | OAuth 2.0 client ID (Google Cloud Console). |
| `GOOGLE_CLIENT_SECRET` | Yes, to enable Google SSO | OAuth 2.0 client secret. |
| `GOOGLE_REDIRECT_URI` | No | Override callback URL; default is `{NEXT_PUBLIC_SITE_URL or origin}/api/auth/google/callback`. |
| `GOOGLE_OAUTH_DEBUG` | No | Set `true` for verbose server logs (troubleshooting only). |

Copy-paste placeholders: see `.env.example`.

**Google Cloud setup:** Create an OAuth 2.0 Client ID (Web application) and add authorized redirect URIs, e.g. `http://localhost:3000/api/auth/google/callback` and `https://your-domain/api/auth/google/callback`. Scopes used in code: `openid email profile`.

---

## Dev bypass (development only)

When `NODE_ENV !== 'production'`, `DATABASE_URL` is unset, and `STAFF_PASSWORD` is unset, password login can use a dev fallback (see `api/auth/login`). OAuth still requires client credentials and a database for the staff allowlist.

---

## Files and routes

| Path / file | Purpose |
|-------------|--------|
| `src/app/dashboard/(auth)/login/page.tsx` | Login UI: Microsoft, Google, then email/password. |
| `src/app/api/auth/login/route.ts` | `POST` – password login, sets `staff_session`. |
| `src/app/api/auth/logout/route.ts` | `POST` – clears session cookie. |
| `src/app/api/auth/me/route.ts` | `GET` – current user (from session + DB). |
| `src/app/api/auth/microsoft/start/route.ts` | `GET` – redirects to Microsoft authorize URL; sets `staff_oauth_state`. |
| `src/app/api/auth/microsoft/callback/route.ts` | `GET` – code exchange, Graph `/me`, sets `staff_session` (`ms:…`). |
| `src/app/api/auth/google/start/route.ts` | `GET` – redirects to Google authorize URL; sets `staff_oauth_state_google`. |
| `src/app/api/auth/google/callback/route.ts` | `GET` – code exchange, userinfo, sets `staff_session` (`google:…`). |
| `src/lib/auth-session.ts` | Parses `staff_session` (`local`, `ms`, `google`, `legacy`). |
| `src/middleware.ts` | Redirects unauthenticated users to `/dashboard/login?from=…`. |

**Session cookie:** `staff_session`  
- **Password (DB user):** `local:{userId}:{role}`  
- **Microsoft:** `ms:{userId}:{role}:{email}`  
- **Google:** `google:{userId}:{role}:{email}`  
- **Legacy dev:** `legacy:{email}`  
- Options: httpOnly, `secure` in production, sameSite `lax`, path `/`.

---

## OAuth flow (Microsoft / Google)

1. User clicks **Sign in with Microsoft** or **Sign in with Google** → `GET` start route sets a CSRF `state` cookie and redirects to the provider.
2. User signs in at the provider; provider redirects to the callback with `code` and `state`.
3. Callback validates `state`, exchanges `code` for tokens, loads email (Microsoft Graph or Google userinfo).
4. Email must match `STAFF_ALLOWED_DOMAIN` and exist as an active row in `User` (same rules for both providers).
5. On success, `staff_session` is set and the user is redirected to `/dashboard`.

---

## Flow (email/password)

1. `POST /api/auth/login` with `{ email, password }` (and `rememberMe` for future use).
2. On success, redirect to `/dashboard`.

---

## Wiring for later

### Forgot-password API

- **Current:** UI exists; wire `POST /api/auth/forgot-password` and reset token flow when needed.

### Remember me

- **Current:** `rememberMe` is sent but not used to vary cookie duration; can extend `api/auth/login` to set a longer `maxAge` when true.

---

## Quick reference

| What | Where |
|------|--------|
| Login page | `/dashboard/login` |
| Microsoft OAuth | `/api/auth/microsoft/start` → `/api/auth/microsoft/callback` |
| Google OAuth | `/api/auth/google/start` → `/api/auth/google/callback` |
| Cookie name | `staff_session` |
| Allow new public dashboard route | `src/middleware.ts` – add to the auth page allow list if needed. |

---

*Last updated: Microsoft + Google OAuth, Prisma user allowlist, and env reference above.*
