-- ============================================================================
-- Phase 6: Vision Processing Migration
-- Adds 'is_active_vision' to ai_providers and 'assigned_vision_provider_id' to users
-- ============================================================================

-- Add vision provider toggles to ai_providers
ALTER TABLE public.ai_providers
ADD COLUMN IF NOT EXISTS is_active_vision BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ai_providers.is_active_vision IS 'Is this the active vision provider for processing images?';

-- Create partial unique index to ensure only one active vision provider per user (unless global)
CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_active_vision_idx
ON public.ai_providers (user_id)
WHERE is_active_vision = true AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_global_vision_idx
ON public.ai_providers (is_global)
WHERE is_active_vision = true AND is_global = true;

-- Add assigned vision provider to users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS assigned_vision_provider_id UUID REFERENCES public.ai_providers(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.assigned_vision_provider_id IS 'Super Admin assigned specific vision provider for this user';
