-- ============================================================================
-- Vision Processing Limitation System
-- ============================================================================

-- Add columns to track vision image processing usage
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS vision_monthly_limit INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS vision_queries_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vision_extra_queries INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vision_usage_month TEXT;

COMMENT ON COLUMN public.users.vision_monthly_limit IS 'Base number of vision (image) queries allowed per month';
COMMENT ON COLUMN public.users.vision_queries_used IS 'Vision queries consumed in the current calendar month';
COMMENT ON COLUMN public.users.vision_extra_queries IS 'Pool of extra vision queries manually granted or purchased';
COMMENT ON COLUMN public.users.vision_usage_month IS 'YYYY-MM string to track which month the vision usage belongs to for auto-resetting';
