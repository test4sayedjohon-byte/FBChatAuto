-- ============================================================================
-- AutometaBot — Supabase Schema (Content Automation PRD Phase 1)
-- Description: Adds Token Economics, Agentic Scheduled Posts options, 
-- dynamic comment replies, audit logging, and billing ledger.
-- ============================================================================

-- 1. EXTEND PUBLIC.USERS FOR TOKEN ECONOMICS & BRAND VOICE
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS brand_voice_profile TEXT,
ADD COLUMN IF NOT EXISTS image_model TEXT DEFAULT 'flux',
ADD COLUMN IF NOT EXISTS text_token_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vision_token_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_gen_credits INTEGER DEFAULT 0;

-- 2. EXTEND PUBLIC.SCHEDULED_POSTS FOR APPROVAL WORKFLOWS & MEDIA
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft', -- 'draft', 'pending_internal_review', 'pending_final_approval', 'approved'
ADD COLUMN IF NOT EXISTS ai_generated_options JSONB, -- Stores the AI variations
ADD COLUMN IF NOT EXISTS media_source_type TEXT DEFAULT 'manual'; -- 'ai_generated', 'folder_upload', 'direct_link', 'manual'

-- 3. EXTEND PUBLIC.COMMENT_RULES FOR DYNAMIC REPLIES
ALTER TABLE public.comment_rules
ADD COLUMN IF NOT EXISTS use_dynamic_ai_reply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 4. EXTEND PUBLIC.AI_PROVIDERS FOR IMAGE MODELS
ALTER TABLE public.ai_providers
ADD COLUMN IF NOT EXISTS is_active_image BOOLEAN DEFAULT false;

-- Create partial unique index to ensure only one image provider is active per user
CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_active_image_idx
ON public.ai_providers (user_id)
WHERE is_active_image = true AND user_id IS NOT NULL;

-- 5. NEW TABLE: AUDIT LOGS (Immutable Ledger for Agent Actions & Token Burns)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- e.g., 'generate_ideas', 'vision_analysis', 'dynamic_reply'
    description TEXT,
    tokens_burned INTEGER DEFAULT 0,
    token_type TEXT, -- 'text', 'vision', 'image_gen'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
-- Insert allowed only by authenticated edge workers (enforced via service_role typically, but allowing users for now)
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. NEW TABLE: BILLING LEDGER (Tracks Top-Ups and Gifts)
CREATE TABLE IF NOT EXISTS public.billing_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- 'top_up', 'gift', 'deduction'
    amount INTEGER NOT NULL,
    token_type TEXT NOT NULL, -- 'text', 'vision', 'image_gen'
    stripe_payment_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for billing_ledger
ALTER TABLE public.billing_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_ledger_select ON public.billing_ledger FOR SELECT USING (auth.uid() = user_id);
-- Only service_role or super admins should insert into billing ledger natively, 
-- but we add a strict select policy to ensure tenant isolation.
