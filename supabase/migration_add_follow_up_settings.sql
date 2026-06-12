-- ============================================================================
-- Add AI Follow-Up Automation settings and session-level counter columns
-- ============================================================================

-- Add follow-up settings to page_connections
ALTER TABLE public.page_connections 
ADD COLUMN IF NOT EXISTS follow_up_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_delay_minutes integer NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS follow_up_prompt text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS follow_up_max_count integer NOT NULL DEFAULT 1;

-- Add tracking fields to chat_sessions
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS follow_up_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz DEFAULT NULL;
