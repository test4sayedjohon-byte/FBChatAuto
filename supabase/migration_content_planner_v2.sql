-- ============================================================================
-- AutometaBot — Supabase Schema (Content Planner Upgrades V2)
-- Description: Adds first_comments to scheduled_posts and creates the
-- ai_content_memory table to prevent AI topic duplication.
-- ============================================================================

-- 1. Add first comments array to scheduled posts
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS first_comments TEXT[] DEFAULT '{}'::TEXT[];

-- 2. Create AI Content Memory table
CREATE TABLE IF NOT EXISTS public.ai_content_memory (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    batch_id    UUID,
    post_id     UUID REFERENCES public.scheduled_posts(id) ON DELETE SET NULL,
    theme       TEXT NOT NULL,         -- e.g., 'React hooks performance'
    summary     TEXT NOT NULL,         -- 1-sentence post summary
    keywords    TEXT[] NOT NULL,       -- primary tags / keywords
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for fast retrieval
CREATE INDEX IF NOT EXISTS idx_ai_content_memory_user ON public.ai_content_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_memory_keywords ON public.ai_content_memory USING gin(keywords);

-- Enable Row Level Security
ALTER TABLE public.ai_content_memory ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists and recreate
DROP POLICY IF EXISTS "Users can manage their own content memory" ON public.ai_content_memory;
CREATE POLICY "Users can manage their own content memory" 
    ON public.ai_content_memory
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
