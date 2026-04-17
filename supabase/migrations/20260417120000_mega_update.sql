-- ═══════════════════════════════════════════════════════
-- MEGA UPDATE PHASE A: Point Rewards, Upload Ratings, Welcome Tour
-- ═══════════════════════════════════════════════════════

-- 1. Point Rewards table (for admin-given rewards + welcome bonuses)
CREATE TABLE IF NOT EXISTS public.point_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT,
  seen BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.point_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own rewards" ON public.point_rewards
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own rewards" ON public.point_rewards
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin can insert rewards" ON public.point_rewards
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users insert own rewards" ON public.point_rewards
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Upload Ratings table (star ratings on browse resources)
CREATE TABLE IF NOT EXISTS public.upload_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(upload_id, user_id)
);
ALTER TABLE public.upload_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can rate" ON public.upload_ratings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can see ratings" ON public.upload_ratings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own rating" ON public.upload_ratings
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 3. Welcome tour flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_tour_seen BOOLEAN DEFAULT false;

-- 4. Secure RPC: Complete welcome tour (awards bonus points server-side)
CREATE OR REPLACE FUNCTION public.complete_welcome_tour(p_user_id UUID, p_bonus INT DEFAULT 15)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND welcome_tour_seen = true) THEN
    RETURN;
  END IF;
  UPDATE profiles SET welcome_tour_seen = true WHERE id = p_user_id;
  UPDATE profiles SET points = COALESCE(points, 0) + p_bonus WHERE id = p_user_id;
  INSERT INTO point_rewards (user_id, amount, reason, seen)
  VALUES (p_user_id, p_bonus, 'Welcome bonus for completing the tour! 🎉', false);
END;
$$;
