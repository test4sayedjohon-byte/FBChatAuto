ALTER TABLE public.page_connections 
ADD COLUMN IF NOT EXISTS trigger_words JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS trigger_responses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_trigger_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.page_connections.trigger_words IS 'Array of words that pause the AI and trigger a pre-defined response.';
COMMENT ON COLUMN public.page_connections.trigger_responses IS 'Array of pre-defined responses sent when a trigger word is detected.';
COMMENT ON COLUMN public.page_connections.is_trigger_enabled IS 'Whether the trigger words feature is enabled.';
