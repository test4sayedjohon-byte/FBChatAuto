-- migration_customer_profiling_v2.sql
-- Add intent_level and metadata columns to customer_profiles

ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS intent_level TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

COMMENT ON COLUMN public.customer_profiles.intent_level IS 'The intent level of the customer (e.g. high, medium, low, unknown).';
COMMENT ON COLUMN public.customer_profiles.metadata IS 'Structured JSON metadata containing tags, short description, lead value, etc.';
