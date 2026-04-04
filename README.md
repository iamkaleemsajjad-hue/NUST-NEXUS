# NUST NEXUS

Vite + Supabase student resource platform. File binaries are stored on **Storj** (S3 API) via **Supabase Edge Functions**; metadata lives in Postgres.

## Quick start (local)

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STORJ_ENDPOINT`, `VITE_STORJ_BUCKET`, and `VITE_ADMIN_EMAIL`.
2. `npm install` then `npm run dev`.
3. Apply database SQL and deploy Edge Functions as described in **`docs/IMPLEMENTATION_PLAN.md`**.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run deploy:functions` | Deploy `storj-upload` and `storj-delete` (requires Supabase CLI linked) |
| `npm run test:login` | Smoke-test auth (`TEST_EMAIL` / `TEST_PASSWORD` in `.env`) |

**Do not** put Storj secret keys in Vite env vars; set `STORJ_ACCESS_KEY` / `STORJ_SECRET_KEY` as **Supabase Edge Function secrets** only.
