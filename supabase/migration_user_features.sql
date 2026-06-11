-- Migration: Add Feature Controls (allow_chat, allow_image_gen, allow_embeddings, allow_agent, allow_summarization)
-- Path: supabase/migration_user_features.sql

-- Add new columns if they don't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allow_chat BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allow_image_gen BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allow_embeddings BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allow_agent BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allow_summarization BOOLEAN DEFAULT true;

-- Set default values for new and existing columns to true
ALTER TABLE public.users ALTER COLUMN allow_chat SET DEFAULT true;
ALTER TABLE public.users ALTER COLUMN allow_image_gen SET DEFAULT true;
ALTER TABLE public.users ALTER COLUMN allow_embeddings SET DEFAULT true;
ALTER TABLE public.users ALTER COLUMN allow_agent SET DEFAULT true;
ALTER TABLE public.users ALTER COLUMN allow_summarization SET DEFAULT true;
ALTER TABLE public.users ALTER COLUMN allow_vision SET DEFAULT true;
ALTER TABLE public.users ALTER COLUMN allow_comment_analysis SET DEFAULT true;

-- Update existing users to true for any null fields
UPDATE public.users SET
  allow_chat = COALESCE(allow_chat, true),
  allow_image_gen = COALESCE(allow_image_gen, true),
  allow_embeddings = COALESCE(allow_embeddings, true),
  allow_agent = COALESCE(allow_agent, true),
  allow_summarization = COALESCE(allow_summarization, true),
  allow_vision = COALESCE(allow_vision, true),
  allow_comment_analysis = COALESCE(allow_comment_analysis, true);

-- Update trigger function
CREATE OR REPLACE FUNCTION public.preserve_user_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

    NEW.allow_chat = OLD.allow_chat;
    NEW.allow_image_gen = OLD.allow_image_gen;
    NEW.allow_embeddings = OLD.allow_embeddings;
    NEW.allow_agent = OLD.allow_agent;
    NEW.allow_summarization = OLD.allow_summarization;
    NEW.allow_comment_analysis = OLD.allow_comment_analysis;

    -- Reset provider overrides
    NEW.assigned_chat_provider_id = OLD.assigned_chat_provider_id;
    NEW.assigned_fallback_chat_provider_id = OLD.assigned_fallback_chat_provider_id;
    NEW.assigned_embedding_provider_id = OLD.assigned_embedding_provider_id;
    NEW.assigned_summarization_provider_id = OLD.assigned_summarization_provider_id;
    NEW.assigned_agent_provider_id = OLD.assigned_agent_provider_id;
    NEW.assigned_vision_provider_id = OLD.assigned_vision_provider_id;
    NEW.assigned_comment_analysis_provider_id = OLD.assigned_comment_analysis_provider_id;
    NEW.assigned_image_provider_id = OLD.assigned_image_provider_id;
  END IF;

  RETURN NEW;
END;
$function$;
