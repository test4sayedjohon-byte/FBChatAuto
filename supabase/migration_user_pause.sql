-- Add is_paused to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;

-- Update tr_preserve_user_columns trigger function to preserve is_paused column
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

    -- Reset provider overrides
    NEW.assigned_chat_provider_id = OLD.assigned_chat_provider_id;
    NEW.assigned_fallback_chat_provider_id = OLD.assigned_fallback_chat_provider_id;
    NEW.assigned_embedding_provider_id = OLD.assigned_embedding_provider_id;
    NEW.assigned_summarization_provider_id = OLD.assigned_summarization_provider_id;
    NEW.assigned_agent_provider_id = OLD.assigned_agent_provider_id;
    NEW.assigned_vision_provider_id = OLD.assigned_vision_provider_id;
  END IF;

  RETURN NEW;
END;
$$;
