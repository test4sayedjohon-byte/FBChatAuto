-- ============================================================================
-- FB Chat Auto — Phase 2 Migration
-- AI Provider Configurations + Message Count Trigger
-- ============================================================================
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. AI PROVIDERS (Multi-provider AI configurations per tenant)
-- ============================================================================
-- Each tenant can configure multiple AI providers (OpenAI, OpenRouter, Gemini, etc.).
-- One provider is marked as the "active" provider for chat completions,
-- and one for embeddings. This allows users to mix providers
-- (e.g., OpenRouter for chat, OpenAI for embeddings).
--
-- The key insight: OpenAI, OpenRouter, Gemini, and most others all support
-- the OpenAI-compatible chat completions API format. The only differences are:
--   - Base URL
--   - API key
--   - Model name
--   - Optional extra headers

CREATE TABLE public.ai_providers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider_name   TEXT NOT NULL,            -- 'openai', 'openrouter', 'gemini', 'cloudflare', 'groq', 'anthropic', 'custom'
    display_name    TEXT NOT NULL,            -- User-friendly label, e.g., "My OpenRouter GPT-4o"
    base_url        TEXT NOT NULL,            -- API base URL (e.g., https://api.openai.com/v1)
    api_key         TEXT NOT NULL,            -- Provider API key
    model_chat      TEXT,                     -- Model for chat completions (e.g., "gpt-4o-mini")
    model_embedding TEXT,                     -- Model for embeddings (e.g., "text-embedding-3-small")
    is_active_chat  BOOLEAN NOT NULL DEFAULT false,  -- Is this the active chat provider?
    is_active_embedding BOOLEAN NOT NULL DEFAULT false,  -- Is this the active embedding provider?
    extra_headers   JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Provider-specific headers (e.g., OpenRouter HTTP-Referer)
    max_tokens      INTEGER DEFAULT 1024,     -- Max tokens for AI response
    temperature     FLOAT DEFAULT 0.7,        -- Response creativity (0.0 = deterministic, 1.0 = creative)
    context_window  INTEGER DEFAULT 10,       -- Number of recent messages to include in context
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_user_provider_name UNIQUE (user_id, display_name)
);

-- Only one active chat provider per user at a time
CREATE UNIQUE INDEX idx_active_chat_provider
    ON public.ai_providers (user_id)
    WHERE is_active_chat = true;

-- Only one active embedding provider per user at a time
CREATE UNIQUE INDEX idx_active_embedding_provider
    ON public.ai_providers (user_id)
    WHERE is_active_embedding = true;

CREATE INDEX idx_ai_providers_user_id ON public.ai_providers(user_id);

COMMENT ON TABLE public.ai_providers IS 'Multi-provider AI configurations. Users can add OpenAI, OpenRouter, Gemini, etc. and switch between them.';
COMMENT ON COLUMN public.ai_providers.base_url IS 'OpenAI-compatible API base URL. Most providers support this format.';
COMMENT ON COLUMN public.ai_providers.is_active_chat IS 'Only one provider can be active for chat at a time (enforced by partial unique index).';

-- RLS for ai_providers
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_providers_select ON public.ai_providers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ai_providers_insert ON public.ai_providers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ai_providers_update ON public.ai_providers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ai_providers_delete ON public.ai_providers FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_providers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================================
-- 2. MESSAGE COUNT INCREMENT TRIGGER
-- ============================================================================
-- Automatically increment chat_sessions.message_count when a new message is inserted.

CREATE OR REPLACE FUNCTION public.increment_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.chat_sessions
    SET message_count = message_count + 1,
        last_message_at = now()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.increment_message_count();


-- ============================================================================
-- 3. PROVIDER PRESET HELPER
-- ============================================================================
-- Convenience function to get the well-known base URLs for common providers.

CREATE OR REPLACE FUNCTION public.get_provider_base_url(p_provider TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_provider
        WHEN 'openai'      THEN 'https://api.openai.com/v1'
        WHEN 'openrouter'   THEN 'https://openrouter.ai/api/v1'
        WHEN 'gemini'       THEN 'https://generativelanguage.googleapis.com/v1beta/openai'
        WHEN 'groq'         THEN 'https://api.groq.com/openai/v1'
        WHEN 'anthropic'    THEN 'https://api.anthropic.com/v1'
        WHEN 'together'     THEN 'https://api.together.xyz/v1'
        WHEN 'deepseek'     THEN 'https://api.deepseek.com/v1'
        WHEN 'mistral'      THEN 'https://api.mistral.ai/v1'
        ELSE NULL
    END;
$$;

COMMENT ON FUNCTION public.get_provider_base_url IS 'Returns well-known base URLs for supported AI providers. Used by the dashboard for auto-fill.';
