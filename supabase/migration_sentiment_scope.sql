-- ============================================================================
-- Migration: Sentiment Analysis Scope (Activity Monitor Panel)
-- Adds scope control for AI comment sentiment: global or specific post IDs.
-- The existing `allow_comment_analysis` boolean is the master on/off switch.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sentiment_analysis_scope TEXT DEFAULT 'global'
    CHECK (sentiment_analysis_scope IN ('global', 'specific_posts')),
  ADD COLUMN IF NOT EXISTS sentiment_watched_post_ids TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.users.sentiment_analysis_scope IS
  'Controls which comments get AI sentiment analysis. "global" = all incoming comments, "specific_posts" = only posts listed in sentiment_watched_post_ids.';

COMMENT ON COLUMN public.users.sentiment_watched_post_ids IS
  'Array of Facebook/Instagram post IDs to watch for sentiment analysis when scope is "specific_posts".';
