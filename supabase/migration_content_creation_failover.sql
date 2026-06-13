-- ============================================================================
-- AutometaBot — Supabase Schema (Content Creation Failover & Routing)
-- Description: Adds fallback_content_order, is_active_content to ai_providers,
-- and assigned_content_provider_id, assigned_fallback_content_provider_id, allow_content to users,
-- and updates the preserve_user_columns security trigger.
-- ============================================================================

-- 1. ADD COLUMNS TO public.ai_providers
ALTER TABLE public.ai_providers
ADD COLUMN IF NOT EXISTS is_active_content BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS fallback_content_order INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.ai_providers.is_active_content IS 'Is this the active provider for content creation?';

-- Create partial unique indices
CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_active_content_idx
ON public.ai_providers (user_id)
WHERE is_active_content = true AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_global_content_idx
ON public.ai_providers (is_global)
WHERE is_active_content = true AND is_global = true;

-- 2. ADD COLUMNS TO public.users FOR SUPER ADMIN OVERRIDES
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS assigned_content_provider_id UUID REFERENCES public.ai_providers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_fallback_content_provider_id UUID REFERENCES public.ai_providers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS allow_content BOOLEAN DEFAULT true;

ALTER TABLE public.users ALTER COLUMN allow_content SET DEFAULT true;

UPDATE public.users SET allow_content = COALESCE(allow_content, true);

COMMENT ON COLUMN public.users.assigned_content_provider_id IS 'Super Admin assigned primary content creation provider';
COMMENT ON COLUMN public.users.assigned_fallback_content_provider_id IS 'Super Admin assigned fallback content creation provider';
COMMENT ON COLUMN public.users.allow_content IS 'Is content creation allowed for this user?';

-- 3. UPDATE TRIGGER FUNCTION TO PROTECT NEW OVERRIDE FIELDS
CREATE OR REPLACE FUNCTION public.preserve_user_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
BEGIN
  -- If this is an administrative override from the service role, bypass protection
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Get the caller's role (before the update takes effect)
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();

  -- If the caller is NOT a super_admin, revert changes to all administrative/sensitive columns
  IF COALESCE(caller_role, '') != 'super_admin' THEN
    NEW.role = OLD.role;
    NEW.is_super_admin = OLD.is_super_admin;
    NEW.plan = OLD.plan;
    NEW.is_suspended = OLD.is_suspended;
    NEW.is_paused = OLD.is_paused;
    NEW.monthly_token_limit = OLD.monthly_token_limit;
    NEW.strict_token_enforcement = OLD.strict_token_enforcement;
    NEW.monthly_message_limit = OLD.monthly_message_limit;
    NEW.extra_message_limit = OLD.extra_message_limit;
    NEW.allowed_channels = OLD.allowed_channels;
    
    NEW.agent_monthly_limit = OLD.agent_monthly_limit;
    NEW.agent_queries_used = OLD.agent_queries_used;
    NEW.agent_extra_queries = OLD.agent_extra_queries;
    
    NEW.allow_vision = OLD.allow_vision;
    NEW.vision_monthly_limit = OLD.vision_monthly_limit;
    NEW.vision_queries_used = OLD.vision_queries_used;
    NEW.vision_extra_queries = OLD.vision_extra_queries;

    -- Reset feature allows
    NEW.allow_chat = OLD.allow_chat;
    NEW.allow_image_gen = OLD.allow_image_gen;
    NEW.allow_embeddings = OLD.allow_embeddings;
    NEW.allow_agent = OLD.allow_agent;
    NEW.allow_summarization = OLD.allow_summarization;
    NEW.allow_comment_analysis = OLD.allow_comment_analysis;
    NEW.allow_content = OLD.allow_content;

    -- Reset provider overrides
    NEW.assigned_chat_provider_id = OLD.assigned_chat_provider_id;
    NEW.assigned_fallback_chat_provider_id = OLD.assigned_fallback_chat_provider_id;
    NEW.assigned_embedding_provider_id = OLD.assigned_embedding_provider_id;
    NEW.assigned_summarization_provider_id = OLD.assigned_summarization_provider_id;
    NEW.assigned_agent_provider_id = OLD.assigned_agent_provider_id;
    NEW.assigned_vision_provider_id = OLD.assigned_vision_provider_id;
    NEW.assigned_comment_analysis_provider_id = OLD.assigned_comment_analysis_provider_id;
    NEW.assigned_image_provider_id = OLD.assigned_image_provider_id;
    NEW.assigned_fallback_image_provider_id = OLD.assigned_fallback_image_provider_id;
    NEW.assigned_content_provider_id = OLD.assigned_content_provider_id;
    NEW.assigned_fallback_content_provider_id = OLD.assigned_fallback_content_provider_id;
  END IF;

  RETURN NEW;
END;
$$;
