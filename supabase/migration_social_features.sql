-- ============================================================================
-- AutometaBot — Supabase Schema (Social Automation, Planner & AI Moderation Additions)
-- Author: AI Architect
-- Date: June 9, 2026
-- ============================================================================

-- 1. EXTEND PUBLIC.USERS FOR THE CREDIT SYSTEM & BUDGET SAFETIES
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS monthly_credits_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS extra_credits_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_reset_day INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS daily_credit_spend_cap INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS burn_rate_alert_sent_at TIMESTAMPTZ;

-- 2. EXTEND PUBLIC.PAGE_CONNECTIONS FOR TOKEN HEALTH MONITORING
ALTER TABLE public.page_connections
ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
ADD COLUMN IF NOT EXISTS token_last_checked_at TIMESTAMPTZ;

-- 3. NEW TABLE: SCHEDULED POSTS
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    page_connection_id TEXT REFERENCES public.page_connections(page_id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'facebook' or 'instagram'
    post_type TEXT NOT NULL, -- 'text', 'photo', 'video', 'carousel'
    message TEXT,
    media_urls TEXT[], -- Publicly accessible hosting URLs (from public.media_assets bucket)
    scheduled_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'uploading', 'ready', 'published', 'failed'
    meta_container_id TEXT, -- For IG container polling
    meta_post_id TEXT, -- Returned post/media ID after publish
    error_message TEXT,
    retry_count INTEGER DEFAULT 0, -- Auto-retry counter
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. NEW TABLE: COMMENT MODERATION RULES
CREATE TABLE IF NOT EXISTS public.comment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    page_connection_id TEXT REFERENCES public.page_connections(page_id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL, -- 'all', 'keywords', 'ai_sentiment'
    keywords TEXT[], -- For keyword matches
    sentiment_target TEXT, -- 'negative', 'positive', 'neutral'
    action_to_take TEXT NOT NULL, -- 'reply', 'hide', 'trash_queue', 'hide_and_reply', 'dm'
    reply_templates TEXT[], -- Rotating reply templates for keyword triggers
    dm_flow_id UUID, -- References a future ManyChat-style flow or prompt
    execution_mode TEXT DEFAULT 'instant', -- 'instant', 'scheduled', 'manual_approval'
    active_hours_start TIME, -- Daily active start window
    active_hours_end TIME, -- Daily active end window
    timezone TEXT DEFAULT 'UTC', -- Rule timezone
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. NEW TABLE: COMMENT ENGAGEMENT LOGS (AUDIT TRAIL & CREDIT USAGE)
CREATE TABLE IF NOT EXISTS public.comment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    page_connection_id TEXT REFERENCES public.page_connections(page_id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'facebook' or 'instagram'
    post_id TEXT NOT NULL,
    comment_id TEXT NOT NULL UNIQUE,
    parent_comment_id TEXT, -- Null if top-level post comment
    sender_id TEXT NOT NULL, -- Page-Scoped ID (PSID) or Instagram ID
    user_name TEXT,
    user_message TEXT,
    ai_sentiment TEXT,
    ai_toxicity_score FLOAT,
    action_taken TEXT, -- 'replied', 'hidden', 'trashed', 'no_action'
    reply_message TEXT,
    dm_sent_id TEXT,
    credits_deducted INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. NEW TABLE: POST CONTEXTS FOR TARGETED AI RESPONSES
CREATE TABLE IF NOT EXISTS public.post_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    page_connection_id TEXT REFERENCES public.page_connections(page_id) ON DELETE CASCADE,
    meta_post_id TEXT UNIQUE NOT NULL, -- The Facebook/Instagram Post ID
    custom_instructions TEXT, -- Per-post system instructions for AI
    post_context_data TEXT, -- Post caption, summary, or extracted image context
    is_automation_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. NEW TABLE: USER BLOCKLIST (OPT-OUT / STOP TRIGGERS)
CREATE TABLE IF NOT EXISTS public.user_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL, -- PSID or IG User ID
    platform TEXT NOT NULL, -- 'facebook' or 'instagram'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, sender_id)
);

-- 8. NEW TABLE: INTEGRATIONS & WEBHOOKS
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL, -- 'google_sheets', 'hubspot', 'shopify', 'custom_webhook'
    credentials JSONB, -- Stored API tokens / OAuth data
    config JSONB, -- e.g. sheet ID or HubSpot list ID
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) & POLICIES FOR NEW TABLES
-- ============================================================================

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Scheduled Posts Policies
CREATE POLICY scheduled_posts_select ON public.scheduled_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY scheduled_posts_insert ON public.scheduled_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY scheduled_posts_update ON public.scheduled_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY scheduled_posts_delete ON public.scheduled_posts FOR DELETE USING (auth.uid() = user_id);

-- Comment Rules Policies
CREATE POLICY comment_rules_select ON public.comment_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY comment_rules_insert ON public.comment_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY comment_rules_update ON public.comment_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY comment_rules_delete ON public.comment_rules FOR DELETE USING (auth.uid() = user_id);

-- Comment Logs Policies
CREATE POLICY comment_logs_select ON public.comment_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY comment_logs_delete ON public.comment_logs FOR DELETE USING (auth.uid() = user_id);

-- Post Contexts Policies
CREATE POLICY post_contexts_select ON public.post_contexts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY post_contexts_insert ON public.post_contexts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY post_contexts_update ON public.post_contexts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY post_contexts_delete ON public.post_contexts FOR DELETE USING (auth.uid() = user_id);

-- User Blocklist Policies
CREATE POLICY user_blocklist_select ON public.user_blocklist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_blocklist_insert ON public.user_blocklist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_blocklist_delete ON public.user_blocklist FOR DELETE USING (auth.uid() = user_id);

-- Integrations Policies
CREATE POLICY integrations_select ON public.integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY integrations_insert ON public.integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY integrations_update ON public.integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY integrations_delete ON public.integrations FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 11. INDEXES FOR PERFORMANCE & SAFEGUARDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_time ON public.scheduled_posts(scheduled_time) WHERE status IN ('scheduled', 'uploading');
CREATE INDEX IF NOT EXISTS idx_comment_logs_user ON public.comment_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_contexts_meta_id ON public.post_contexts(meta_post_id);
CREATE INDEX IF NOT EXISTS idx_user_blocklist_lookup ON public.user_blocklist(user_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_comment_logs_sender_post ON public.comment_logs(sender_id, post_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user ON public.integrations(user_id);

-- ============================================================================
-- 12. TRIGGERS FOR TIMESTAMP SYNCHRONIZATION
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.scheduled_posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.post_contexts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
