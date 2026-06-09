-- ============================================================================
-- FB Chat Auto — Chat Assets Migration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL, -- The unique alias used by AI to trigger this file (e.g. 'price_list')
  friendly_name VARCHAR NOT NULL, -- Display name for the dashboard
  description TEXT, -- Help instructions for AI (e.g. 'Catalog detailing service plans')
  file_url VARCHAR NOT NULL, -- Publicly accessible URL (from Supabase storage or external)
  file_type VARCHAR NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'file')),
  facebook_media_id VARCHAR, -- Cached attachment ID returned from Meta
  ai_auto_send BOOLEAN NOT NULL DEFAULT true, -- If true, the AI can trigger this file automatically
  times_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_user_asset_name UNIQUE (user_id, name)
);

-- Enable RLS
ALTER TABLE public.chat_assets ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage their own chat assets" ON public.chat_assets;
CREATE POLICY "Users can manage their own chat assets"
  ON public.chat_assets FOR ALL
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS set_updated_at ON public.chat_assets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.chat_assets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
