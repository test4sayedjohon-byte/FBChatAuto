-- ============================================================================
-- AutometaBot — Supabase Schema (Chat Keyword Rules Engine & Match Logs)
-- Author: AI Architect
-- Date: June 12, 2026
-- ============================================================================

-- 1. CREATE TABLES

-- A. Chat Keyword Rules Table
CREATE TABLE IF NOT EXISTS public.chat_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    page_connection_id TEXT NOT NULL REFERENCES public.page_connections(page_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    keywords TEXT[] NOT NULL,
    match_type VARCHAR(50) DEFAULT 'contains',
    case_sensitive BOOLEAN DEFAULT false,
    action_type VARCHAR(50) NOT NULL, -- 'text', 'flow', 'media'
    reply_templates TEXT[], -- Rotating responses
    dm_flow_id UUID REFERENCES public.dm_flows(id) ON DELETE SET NULL,
    media_id UUID REFERENCES public.media(id) ON DELETE SET NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    match_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- B. Chat Keyword Rule Match Logs Table
CREATE TABLE IF NOT EXISTS public.chat_rule_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES public.chat_rules(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    matched_keyword TEXT NOT NULL,
    incoming_message TEXT,
    action_taken TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.chat_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rule_logs ENABLE ROW LEVEL SECURITY;

-- 3. CREATE POLICIES

-- Chat Rules Policies
CREATE POLICY chat_rules_select ON public.chat_rules 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY chat_rules_insert ON public.chat_rules 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_rules_update ON public.chat_rules 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY chat_rules_delete ON public.chat_rules 
    FOR DELETE USING (auth.uid() = user_id);

-- Chat Rule Logs Policies
CREATE POLICY chat_rule_logs_select ON public.chat_rule_logs 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_rules r 
            WHERE r.id = rule_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY chat_rule_logs_insert ON public.chat_rule_logs 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_rules r 
            WHERE r.id = rule_id AND r.user_id = auth.uid()
        )
    );

CREATE POLICY chat_rule_logs_delete ON public.chat_rule_logs 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.chat_rules r 
            WHERE r.id = rule_id AND r.user_id = auth.uid()
        )
    );
