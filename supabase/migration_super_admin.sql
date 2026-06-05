-- ============================================================================
-- Super Admin & Global AI Provider Migration
-- ============================================================================

-- 1. Add is_super_admin to users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Modify ai_providers for global support
-- Drop the NOT NULL constraint on user_id so we can have system-level providers without a specific tenant
ALTER TABLE public.ai_providers 
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.ai_providers 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- Remove old unique constraints that force user_id, and add new ones
ALTER TABLE public.ai_providers DROP CONSTRAINT IF EXISTS uq_user_provider_name;
-- A provider display name should be unique per user OR unique globally (if user_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_provider_name_idx ON public.ai_providers (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), display_name);

-- Update active chat index to allow one active global chat provider
DROP INDEX IF EXISTS idx_active_chat_provider;
CREATE UNIQUE INDEX idx_active_chat_provider
    ON public.ai_providers (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE is_active_chat = true;

-- Update active embedding index to allow one active global embedding provider
DROP INDEX IF EXISTS idx_active_embedding_provider;
CREATE UNIQUE INDEX idx_active_embedding_provider
    ON public.ai_providers (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE is_active_embedding = true;


-- 3. Update RLS Policies
-- Drop old tenant-scoped policies
DROP POLICY IF EXISTS ai_providers_select ON public.ai_providers;
DROP POLICY IF EXISTS ai_providers_insert ON public.ai_providers;
DROP POLICY IF EXISTS ai_providers_update ON public.ai_providers;
DROP POLICY IF EXISTS ai_providers_delete ON public.ai_providers;

-- Create new policies
-- Super admins have full access to everything
CREATE POLICY ai_providers_super_admin_all ON public.ai_providers
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = true)
    );

-- Regular users can only read their own specific providers or the global ones (in case the frontend needs to show them what's active)
-- But they cannot insert/update/delete.
CREATE POLICY ai_providers_read_only ON public.ai_providers
    FOR SELECT
    USING (
        user_id = auth.uid() OR is_global = true
    );

