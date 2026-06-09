-- ============================================================================
-- Add Reasoning Model configuration to AI Providers
-- ============================================================================

ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS model_reasoning TEXT;

COMMENT ON COLUMN public.ai_providers.model_reasoning IS 'Model for complex reasoning/thinking tasks (e.g. deepseek-reasoner, o3-mini). Fallback is model_chat.';
