-- ═══════════════════════════════════════════════════════
-- FIX: Repair award_upload_points and deduct_download_points RPCs
-- Root cause: both functions were missing SET search_path = public
-- so their internal UPDATEs silently failed (wrong schema lookup).
-- ═══════════════════════════════════════════════════════

-- 1. Fix award_upload_points
--    Called when a user uploads a file. Awards points and logs to point_rewards.
CREATE OR REPLACE FUNCTION public.award_upload_points(point_amount int, target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_points int;
BEGIN
  -- Update points atomically
  UPDATE profiles
  SET points = COALESCE(points, 0) + point_amount
  WHERE id = target_user_id
  RETURNING points INTO v_new_points;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Log the reward so user can see it in notifications
  INSERT INTO point_rewards (user_id, amount, reason, seen)
  VALUES (
    target_user_id,
    point_amount,
    CASE
      WHEN point_amount >= 50 THEN 'Upload approved: Semester Project! 🚀'
      ELSE 'Upload approved! Keep sharing 📚'
    END,
    false
  );

  RETURN json_build_object('success', true, 'points_new', v_new_points);
END;
$$;

-- 2. Fix deduct_download_points
--    Called when a user downloads a file. Deducts points atomically.
CREATE OR REPLACE FUNCTION public.deduct_download_points(point_cost int, upload_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_points int;
  v_new_points int;
BEGIN
  -- Get current user from session
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Lock row and read current balance atomically
  SELECT points INTO v_current_points
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF COALESCE(v_current_points, 0) < point_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  v_new_points := v_current_points - point_cost;

  UPDATE profiles
  SET points = v_new_points
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Point deduction failed — possible race condition');
  END IF;

  -- Log the download
  INSERT INTO downloads (upload_id, user_id)
  VALUES (upload_id, v_user_id)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('success', true, 'points_remaining', v_new_points);
END;
$$;
