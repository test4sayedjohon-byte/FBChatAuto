-- ============================================================================
-- FB Chat Auto — Message Gifting Migration
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS extra_message_limit INTEGER NOT NULL DEFAULT 0;
