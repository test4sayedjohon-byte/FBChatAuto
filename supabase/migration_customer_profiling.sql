-- migration_customer_profiling.sql
-- Add customer_profiles table and update page_connections

ALTER TABLE public.page_connections
ADD COLUMN enable_customer_profiling BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN profiling_model TEXT DEFAULT 'gemini-1.5-flash';

CREATE TABLE public.customer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_customer_profile UNIQUE (page_id, sender_id)
);

CREATE INDEX idx_customer_profiles_user_id ON public.customer_profiles(user_id);
CREATE INDEX idx_customer_profiles_page_sender ON public.customer_profiles(page_id, sender_id);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_profiles_select ON public.customer_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY customer_profiles_insert ON public.customer_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY customer_profiles_update ON public.customer_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY customer_profiles_delete ON public.customer_profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customer_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.customer_profiles IS 'Long-term memory extracted from chats using sliding window summarization.';
