-- ============================================================================
-- AutometaBot — Supabase Schema (DM Flow Builder & Sequence Automation Engine)
-- Author: AI Architect
-- Date: June 10, 2026
-- ============================================================================

-- 1. CREATE TABLES

-- A. DM Flows Table (Metadata)
CREATE TABLE IF NOT EXISTS public.dm_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- B. DM Flow Nodes (Graph Blocks)
CREATE TABLE IF NOT EXISTS public.dm_flow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.dm_flows(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'message', 'interactive', 'delay', 'condition', 'action', 'ai_route'
    data JSONB NOT NULL, -- Message text, buttons, attachments, conditions metadata
    position JSONB, -- Coordinates for visual builder {x, y}
    created_at TIMESTAMPTZ DEFAULT now()
);

-- C. DM Flow Edges (Connections)
CREATE TABLE IF NOT EXISTS public.dm_flow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.dm_flows(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES public.dm_flow_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.dm_flow_nodes(id) ON DELETE CASCADE,
    source_handle VARCHAR(100), -- E.g., 'button_1', 'true', 'default'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- D. Active Flow Sessions (Runtime State)
CREATE TABLE IF NOT EXISTS public.chat_session_flows (
    session_id UUID PRIMARY KEY REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES public.dm_flows(id) ON DELETE CASCADE,
    current_node_id UUID REFERENCES public.dm_flow_nodes(id) ON DELETE SET NULL,
    state_data JSONB DEFAULT '{}'::jsonb, -- Custom attributes/variables captured during flow
    is_paused BOOLEAN DEFAULT false,
    last_executed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- E. Add Foreign Key link to comment_rules (safely)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'comment_rules_dm_flow_id_fkey'
    ) THEN
        ALTER TABLE public.comment_rules
        ADD CONSTRAINT comment_rules_dm_flow_id_fkey
        FOREIGN KEY (dm_flow_id) REFERENCES public.dm_flows(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. ROW LEVEL SECURITY (RLS) & POLICIES FOR NEW TABLES

ALTER TABLE public.dm_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_session_flows ENABLE ROW LEVEL SECURITY;

-- DM Flows Policies
CREATE POLICY dm_flows_select ON public.dm_flows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY dm_flows_insert ON public.dm_flows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY dm_flows_update ON public.dm_flows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY dm_flows_delete ON public.dm_flows FOR DELETE USING (auth.uid() = user_id);

-- DM Flow Nodes Policies (tied to flow ownership)
CREATE POLICY dm_flow_nodes_select ON public.dm_flow_nodes FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));
CREATE POLICY dm_flow_nodes_insert ON public.dm_flow_nodes FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));
CREATE POLICY dm_flow_nodes_update ON public.dm_flow_nodes FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));
CREATE POLICY dm_flow_nodes_delete ON public.dm_flow_nodes FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));

-- DM Flow Edges Policies (tied to flow ownership)
CREATE POLICY dm_flow_edges_select ON public.dm_flow_edges FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));
CREATE POLICY dm_flow_edges_insert ON public.dm_flow_edges FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));
CREATE POLICY dm_flow_edges_update ON public.dm_flow_edges FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));
CREATE POLICY dm_flow_edges_delete ON public.dm_flow_edges FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));

-- Chat Session Flows Policies (tied to session ownership)
CREATE POLICY chat_session_flows_select ON public.chat_session_flows FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid()));
CREATE POLICY chat_session_flows_insert ON public.chat_session_flows FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid()));
CREATE POLICY chat_session_flows_update ON public.chat_session_flows FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid()));
CREATE POLICY chat_session_flows_delete ON public.chat_session_flows FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid()));

-- 3. INDEXES FOR PERFORMANCE

CREATE INDEX IF NOT EXISTS idx_dm_flows_user ON public.dm_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_flow_nodes_flow ON public.dm_flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_dm_flow_edges_flow ON public.dm_flow_edges(flow_id);
CREATE INDEX IF NOT EXISTS idx_dm_flow_edges_source ON public.dm_flow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_chat_session_flows_flow ON public.chat_session_flows(flow_id);

-- 4. TIMESTAMPS SYNCHRONIZATION TRIGGERS

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.dm_flows
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
