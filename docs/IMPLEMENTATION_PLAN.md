# NUST NEXUS — implementation & handoff plan

This document is for developers continuing the work: security constraints, Supabase/Storj setup, and what was changed in the codebase (as of 2026-04-04).

## Critical: secrets and rotation

- **Never commit** `.env`, Storj access keys, or Supabase **service role** keys to git. The Vite client only ever uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key is public by design but still protect your repo).
- **Storj keys were pasted in chat**: treat them as compromised. In the Storj / Gateway console, **rotate (revoke and create new access keys)** after deployment, then update **Supabase Edge Function secrets** only (not the Vite `.env`).
- **Cursor MCP**: Storj is **not** wired through MCP for this app. Storage is implemented via **Supabase Edge Functions** + S3-compatible API. MCP servers in this workspace (`user-supabase-mcp-server`, `user-github-mcp-server`, etc.) are separate; verify connectivity in **Cursor Settings → MCP** and test tools (e.g. GitHub `get_me`, Supabase `list_projects`) if needed.

## Architecture (storage)

| Layer | Role |
|--------|------|
| Supabase Auth | Users, sessions, JWT |
| Supabase Postgres | Profiles, uploads metadata, feedback, ideas, login history, RLS |
| Storj (S3 API) | Binary files via Edge Functions `storj-upload` / `storj-delete` |
| Vite SPA | Calls Edge Functions with `Authorization: Bearer <session JWT>`; **no** Storj secrets in the browser |

## What you must do in Supabase (dashboard)

1. **SQL**: Run `supabase/migrations/20260404120000_core_tables_rls.sql` (or merge its contents) in **SQL Editor** if `supabase db push` is not used. This creates/fixes `login_history`, `project_ideas`, `feedback` RLS, and indexes.
2. **Edge Functions**: Deploy `supabase/functions/storj-upload` and `supabase/functions/storj-delete` (CLI: `supabase functions deploy storj-upload` / `storj-delete`).
3. **Edge secrets** (Dashboard → Edge Functions → Secrets): set  
   `STORJ_ACCESS_KEY`, `STORJ_SECRET_KEY`, `STORJ_ENDPOINT` (e.g. `https://gateway.storjshare.io`), `STORJ_BUCKET` (bucket must exist in Storj).  
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` are usually injected automatically; confirm in logs if uploads fail.
4. **Auth email / OTP**: If confirmation emails are not received:
   - Enable **custom SMTP** (Authentication → SMTP) for production; Supabase’s default mail has strict limits.
   - Under **Email Templates**, ensure the **Confirm signup** template includes the OTP token placeholder Supabase documents (e.g. `{{ .Token }}` where applicable) if you use 6-digit verification in the UI.
   - Check **spam** and institutional email filters for `@nust.edu.pk` addresses.
5. **Rate limits**: True **IP-based** limits require a gateway (Cloudflare, API Gateway) or Supabase Pro features. The app adds **client-side** rate limits (localStorage) plus stricter validation; document your chosen edge rate limit for production.

## Storj bucket

- Create a bucket in the Storj console matching `STORJ_BUCKET` (default name in code: `nust-nexus-uploads`).
- Ensure the access key used by Edge Functions can **PutObject** and **DeleteObject** on that bucket.

## Application behavior (recent code changes)

| Area | Behavior |
|------|-----------|
| Login history | `recordLogin()` runs on `SIGNED_IN` in `main.js` (not on `INITIAL_SESSION`). Rows live in `login_history`; `signOut()` sets `logout_at` on the latest row. |
| Uploads | SHA-256 file hash; duplicate hash → `rejected`, no Storj upload. Unique file → upload to Storj → **`approved`** + points so **Browse** (which filters `approved`) shows the resource. |
| Ideas | `idea_hash` + combined word/bigram similarity; stricter duplicate detection. |
| Feedback | Schema-style validation + rate limits; `pickAllowedFields` on inserts. |
| Security helpers | `pickAllowedFields`, `rejectExtraFields` in `sanitize.js` for OWASP-style input shaping. |

## Files to know

- `src/utils/storj.js` — browser calls Edge Functions only.
- `supabase/functions/storj-upload/index.ts` — S3 PutObject, path locked to `uploads/<user_id>/...`.
- `supabase/functions/storj-delete/index.ts` — S3 DeleteObject with same path rules.
- `src/pages/upload.js` — hash + Storj + DB row.
- `src/utils/idea-similarity.js` — similarity logic.
- `docs/IMPLEMENTATION_PLAN.md` — this file.

## `VITE_ADMIN_EMAIL`

Set this in `.env` so `email-parser.js` can recognise the admin account. Leaving it empty disables the hard-coded admin email shortcut.

## Verification checklist

- [ ] No secrets in `git status` tracked files (run `git grep -i secret`; `eyJ` may appear in `package-lock.json` integrity strings — that is normal).
- [ ] `.env` in `.gitignore` (already).
- [ ] Edge Functions deployed (`npm run deploy:functions` after `supabase link`); test upload from the app; verify object in Storj bucket.
- [ ] SQL migration applied (`supabase/migrations/20260404120000_core_tables_rls.sql`); login history shows rows after sign-in; logout updates `logout_at`.
- [ ] `project_ideas` insert works for students; admin sees feedback.
- [ ] Storj keys rotated after any exposure.
- [ ] `npm run build` passes locally before deploy.

## Repo layout (reference)

| Path | Purpose |
|------|---------|
| `README.md` | Local dev + scripts |
| `supabase/config.toml` | Edge function JWT verification flags |
| `supabase/migrations/*.sql` | Postgres + RLS |
| `supabase/functions/storj-*/` | Storj S3 upload/delete |

## Follow-ups (optional)

- Server-side rate limiting (Cloudflare WAF / Supabase + Edge middleware).
- Move avatar upload from Supabase Storage to Storj if you need to stay under Supabase 1 GB.
- Periodic job to mark stale `pending` uploads if any legacy rows remain.
