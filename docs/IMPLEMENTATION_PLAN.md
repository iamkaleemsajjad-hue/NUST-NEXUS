# NUST NEXUS — implementation & handoff plan

This document is for developers continuing the work: security constraints, Supabase setup, and what was changed in the codebase.

## Critical: secrets and rotation

- **Never commit** `.env` or Supabase **service role** keys to git. The Vite client only ever uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key is public by design but still protect your repo).

## Architecture (storage)

| Layer | Role |
|--------|------|
| Supabase Auth | Users, sessions, JWT |
| Supabase Postgres | Profiles, uploads metadata, feedback, ideas, login history, RLS |
| Supabase Storage | Binary files via `uploads` bucket (public read, authenticated upload) |
| Vite SPA | Uses `@supabase/supabase-js` client for storage operations; auth is automatic via session |

## What you must do in Supabase (dashboard)

1. **SQL**: Run `supabase/migrations/20260404120000_core_tables_rls.sql` (or merge its contents) in **SQL Editor** if `supabase db push` is not used. This creates/fixes `login_history`, `project_ideas`, `feedback` RLS, and indexes.
2. **Storage**: Ensure the `uploads` bucket exists (public) with RLS policies:
   - **INSERT**: Authenticated users can upload files
   - **SELECT**: Anyone can read uploads
   - **DELETE**: Authenticated users can delete own files (or admin can delete)
3. **Auth email / OTP**: If confirmation emails are not received:
   - Enable **custom SMTP** (Authentication → SMTP) for production; Supabase's default mail has strict limits.
   - Under **Email Templates**, ensure the **Confirm signup** template includes the OTP token placeholder.
   - Check **spam** and institutional email filters for `@nust.edu.pk` addresses.
4. **Rate limits**: True **IP-based** limits require a gateway (Cloudflare, API Gateway) or Supabase Pro features. The app adds **client-side** rate limits (localStorage) plus stricter validation.

## Application behavior (recent code changes)

| Area | Behavior |
|------|-----------| 
| Login history | `recordLogin()` runs on `SIGNED_IN` in `main.js` (not on `INITIAL_SESSION`). Rows live in `login_history`; `signOut()` sets `logout_at` on the latest row. |
| Uploads | SHA-256 file hash computed client-side. File uploaded to Supabase Storage `uploads` bucket → DB row inserted with `status: 'pending'` → admin reviews and approves/rejects. |
| Ideas | `idea_hash` + combined word/bigram similarity; stricter duplicate detection. |
| Feedback | Schema-style validation + rate limits; `pickAllowedFields` on inserts. |
| Security helpers | `pickAllowedFields`, `rejectExtraFields` in `sanitize.js` for OWASP-style input shaping. |

## Files to know

- `src/utils/storage.js` — Supabase Storage upload/download/delete via JS client.
- `src/pages/upload.js` — hash + storage upload + DB row.
- `src/utils/idea-similarity.js` — similarity logic.
- `docs/IMPLEMENTATION_PLAN.md` — this file.

## `VITE_ADMIN_EMAIL`

Set this in `.env` so `email-parser.js` can recognise the admin account. Leaving it empty disables the hard-coded admin email shortcut.

## Verification checklist

- [ ] No secrets in `git status` tracked files.
- [ ] `.env` in `.gitignore` (already).
- [ ] Supabase Storage `uploads` bucket exists with proper RLS policies.
- [ ] SQL migration applied; login history shows rows after sign-in.
- [ ] `project_ideas` insert works for students; admin sees feedback.
- [ ] `npm run build` passes locally before deploy.

## Repo layout (reference)

| Path | Purpose |
|------|---------| 
| `README.md` | Local dev + scripts |
| `supabase/config.toml` | Supabase CLI config |
| `supabase/migrations/*.sql` | Postgres + RLS |
| `src/utils/storage.js` | Supabase Storage client |

## Follow-ups (optional)

- Server-side rate limiting (Cloudflare WAF / Supabase + Edge middleware).
- Periodic job to mark stale `pending` uploads if any legacy rows remain.
