# NUST NEXUS

Vite + Supabase student resource platform. File binaries are stored in **Supabase Storage** (`uploads` bucket); metadata lives in Postgres.

## Quick start (local)

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ADMIN_EMAIL`.
2. `npm install` then `npm run dev`.
3. Apply database SQL as described in **`docs/IMPLEMENTATION_PLAN.md`**.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run test:login` | Smoke-test auth (`TEST_EMAIL` / `TEST_PASSWORD` in `.env`) |

File uploads use **Supabase Storage** directly via the JS client — no Edge Functions required.
