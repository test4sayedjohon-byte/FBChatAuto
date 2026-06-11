-- ============================================================================
-- FB Chat Auto — Unified Media Vault Migration
-- ============================================================================

-- Rename chat_assets table to media if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_assets') THEN
    ALTER TABLE public.chat_assets RENAME TO media;
  END IF;
END $$;

-- Ensure media table columns are present
ALTER TABLE public.media 
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS use_in_chat BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS use_in_comments BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_in_scheduler BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT true;

-- Rename constraint if it exists (originally uq_user_asset_name on chat_assets)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_asset_name') THEN
    ALTER TABLE public.media RENAME CONSTRAINT uq_user_asset_name TO uq_user_media_name;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Recreate policies for the media table
DROP POLICY IF EXISTS "Users can manage their own chat assets" ON public.media;
DROP POLICY IF EXISTS "Users can manage their own media" ON public.media;

CREATE POLICY "Users can manage their own media"
  ON public.media FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for auto-update updated_at timestamp
DROP TRIGGER IF EXISTS set_updated_at ON public.media;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.media
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
