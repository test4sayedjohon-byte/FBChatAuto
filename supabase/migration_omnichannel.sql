-- ============================================================================
-- FB Chat Auto — Omnichannel Update
-- Adds support for Instagram and WhatsApp channels to the existing
-- Facebook Page connections.
-- ============================================================================

ALTER TABLE public.page_connections
ADD COLUMN IF NOT EXISTS instagram_account_id TEXT,
ADD COLUMN IF NOT EXISTS is_instagram_active BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_business_account_id TEXT,
ADD COLUMN IF NOT EXISTS is_whatsapp_active BOOLEAN NOT NULL DEFAULT false;

-- Add a unique constraint so multiple tenants can't claim the same Instagram or WhatsApp account
ALTER TABLE public.page_connections
ADD CONSTRAINT uq_instagram_account_id UNIQUE (instagram_account_id);

ALTER TABLE public.page_connections
ADD CONSTRAINT uq_whatsapp_phone_number_id UNIQUE (whatsapp_phone_number_id);

-- Add indexes for faster webhook lookups by Instagram or WhatsApp ID
CREATE INDEX IF NOT EXISTS idx_page_connections_ig_id ON public.page_connections(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_page_connections_wa_id ON public.page_connections(whatsapp_phone_number_id);

COMMENT ON COLUMN public.page_connections.instagram_account_id IS 'Instagram Business Account ID (IGSID target) linked to the Facebook Page.';
COMMENT ON COLUMN public.page_connections.is_instagram_active IS 'Whether Instagram automation is currently enabled for this connection.';
COMMENT ON COLUMN public.page_connections.whatsapp_phone_number_id IS 'WhatsApp Phone Number ID linked to the WABA.';
COMMENT ON COLUMN public.page_connections.whatsapp_business_account_id IS 'WhatsApp Business Account (WABA) ID.';
COMMENT ON COLUMN public.page_connections.is_whatsapp_active IS 'Whether WhatsApp automation is currently enabled for this connection.';
