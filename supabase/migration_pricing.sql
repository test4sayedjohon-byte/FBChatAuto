-- ============================================================================
-- FB Chat Auto — Pricing Migration
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS allowed_channels INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_message_limit INTEGER;
