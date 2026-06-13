-- migration_broadcasts.sql
-- Create broadcast_campaigns and broadcast_queue tables for bulk campaigns

CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'completed', 'stopped')),
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    sending_order TEXT NOT NULL DEFAULT 'random' CHECK (sending_order IN ('random', 'latest_first', 'oldest_first')),
    mode TEXT NOT NULL DEFAULT 'single' CHECK (mode IN ('single', 'multiple_random', 'ai_personalized')),
    static_templates TEXT[] DEFAULT '{}'::TEXT[],
    ai_prompt_goal TEXT,
    delay_seconds INTEGER NOT NULL DEFAULT 30 CHECK (delay_seconds >= 5),
    randomize_delay BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.broadcast_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    customer_name TEXT,
    message_content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'queued', 'sending', 'sent', 'failed')),
    batch_number INTEGER NOT NULL DEFAULT 1,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_user_id ON public.broadcast_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_campaign_id ON public.broadcast_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_user_status ON public.broadcast_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_scheduled ON public.broadcast_queue(status, scheduled_at) WHERE status = 'queued';

-- Enable RLS
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_queue ENABLE ROW LEVEL SECURITY;

-- Campaign policies
DROP POLICY IF EXISTS broadcasts_select ON public.broadcast_campaigns;
DROP POLICY IF EXISTS broadcasts_insert ON public.broadcast_campaigns;
DROP POLICY IF EXISTS broadcasts_update ON public.broadcast_campaigns;
DROP POLICY IF EXISTS broadcasts_delete ON public.broadcast_campaigns;

CREATE POLICY broadcasts_select ON public.broadcast_campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY broadcasts_insert ON public.broadcast_campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY broadcasts_update ON public.broadcast_campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY broadcasts_delete ON public.broadcast_campaigns FOR DELETE USING (auth.uid() = user_id);

-- Queue policies
DROP POLICY IF EXISTS queue_select ON public.broadcast_queue;
DROP POLICY IF EXISTS queue_insert ON public.broadcast_queue;
DROP POLICY IF EXISTS queue_update ON public.broadcast_queue;
DROP POLICY IF EXISTS queue_delete ON public.broadcast_queue;

CREATE POLICY queue_select ON public.broadcast_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY queue_insert ON public.broadcast_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY queue_update ON public.broadcast_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY queue_delete ON public.broadcast_queue FOR DELETE USING (auth.uid() = user_id);

-- Update triggers
DROP TRIGGER IF EXISTS tr_set_updated_at_campaigns ON public.broadcast_campaigns;
CREATE TRIGGER tr_set_updated_at_campaigns BEFORE UPDATE ON public.broadcast_campaigns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS tr_set_updated_at_queue ON public.broadcast_queue;
CREATE TRIGGER tr_set_updated_at_queue BEFORE UPDATE ON public.broadcast_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
