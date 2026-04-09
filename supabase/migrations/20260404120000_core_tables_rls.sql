-- NUST NEXUS — core tables + RLS (run via Supabase SQL editor or `supabase db push`)
-- Adjust if tables already exist in your project.

-- Safe column adds when upgrading an older schema
ALTER TABLE IF EXISTS public.project_ideas ADD COLUMN IF NOT EXISTS idea_hash text;
ALTER TABLE IF EXISTS public.feedback ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE IF EXISTS public.feedback ADD COLUMN IF NOT EXISTS replied_at timestamptz;

-- ── Login history (dashboard: login / logout times) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  user_agent text,
  ip_address text
);

CREATE INDEX IF NOT EXISTS login_history_user_login_idx
  ON public.login_history (user_id, login_at DESC);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_history_select_own" ON public.login_history;
CREATE POLICY "login_history_select_own"
  ON public.login_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "login_history_insert_own" ON public.login_history;
CREATE POLICY "login_history_insert_own"
  ON public.login_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "login_history_update_own" ON public.login_history;
CREATE POLICY "login_history_update_own"
  ON public.login_history FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Project ideas (title, description, semantic hash) ─────────────────────
CREATE TABLE IF NOT EXISTS public.project_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text,
  difficulty text,
  idea_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_ideas_hash_idx ON public.project_ideas (idea_hash);
CREATE INDEX IF NOT EXISTS project_ideas_created_idx ON public.project_ideas (created_at DESC);

ALTER TABLE public.project_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_ideas_select_authenticated" ON public.project_ideas;
CREATE POLICY "project_ideas_select_authenticated"
  ON public.project_ideas FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "project_ideas_insert_own" ON public.project_ideas;
CREATE POLICY "project_ideas_insert_own"
  ON public.project_ideas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── Feedback (student + public) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'student',
  name text,
  email text,
  message text NOT NULL,
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_type_created_idx ON public.feedback (type, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_select_own_or_admin" ON public.feedback;
-- Students see own rows; admins need service role or a separate admin policy via profiles.role (simplified below)
CREATE POLICY "feedback_select_own_or_admin"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "feedback_insert_student" ON public.feedback;
CREATE POLICY "feedback_insert_student"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'student' AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "feedback_insert_public" ON public.feedback;
CREATE POLICY "feedback_insert_public"
  ON public.feedback FOR INSERT
  TO anon
  WITH CHECK (type = 'public');

DROP POLICY IF EXISTS "feedback_update_admin" ON public.feedback;
CREATE POLICY "feedback_update_admin"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── Uploads: dedupe index + nullable file URL (rejected duplicates have no object in Storj) ──
ALTER TABLE IF EXISTS public.uploads ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE IF EXISTS public.uploads ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX IF NOT EXISTS uploads_file_hash_idx ON public.uploads (file_hash);
