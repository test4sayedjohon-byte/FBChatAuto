-- ============================================================================
-- Dashboard AI Agent Limitation System
-- ============================================================================

-- Add columns to track dashboard agent usage
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS agent_monthly_limit INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS agent_queries_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_extra_queries INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_usage_month TEXT;

COMMENT ON COLUMN public.users.agent_monthly_limit IS 'Base number of queries allowed per month for the dashboard agent';
COMMENT ON COLUMN public.users.agent_queries_used IS 'Queries consumed in the current calendar month';
COMMENT ON COLUMN public.users.agent_extra_queries IS 'Pool of extra queries manually granted by admin. Expires at the end of the month.';
COMMENT ON COLUMN public.users.agent_usage_month IS 'YYYY-MM string to track which month the usage belongs to for auto-resetting';
