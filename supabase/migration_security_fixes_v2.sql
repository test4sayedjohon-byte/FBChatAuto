-- ============================================================================
-- Security Hardening & Administrative Role Segregation (Phase 2)
-- ============================================================================
-- 1. Hardened Column Protection Trigger (Prevents Privilege Escalation)
-- Only 'super_admin' or 'service_role' can modify roles, plans, or limits.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preserve_user_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
BEGIN
  -- If this is an administrative override from the service role, bypass protection
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Get the caller's role (before the update takes effect)
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();

  -- If the caller is NOT a super_admin, revert changes to all administrative/sensitive columns
  IF COALESCE(caller_role, '') != 'super_admin' THEN
    NEW.role = OLD.role;
    NEW.is_super_admin = OLD.is_super_admin;
    NEW.plan = OLD.plan;
    NEW.is_suspended = OLD.is_suspended;
    NEW.monthly_token_limit = OLD.monthly_token_limit;
    NEW.strict_token_enforcement = OLD.strict_token_enforcement;
    NEW.monthly_message_limit = OLD.monthly_message_limit;
    NEW.extra_message_limit = OLD.extra_message_limit;
    NEW.allowed_channels = OLD.allowed_channels;
    
    NEW.agent_monthly_limit = OLD.agent_monthly_limit;
    NEW.agent_queries_used = OLD.agent_queries_used;
    NEW.agent_extra_queries = OLD.agent_extra_queries;
    
    NEW.allow_vision = OLD.allow_vision;
    NEW.vision_monthly_limit = OLD.vision_monthly_limit;
    NEW.vision_queries_used = OLD.vision_queries_used;
    NEW.vision_extra_queries = OLD.vision_extra_queries;

    -- Reset provider overrides
    NEW.assigned_chat_provider_id = OLD.assigned_chat_provider_id;
    NEW.assigned_fallback_chat_provider_id = OLD.assigned_fallback_chat_provider_id;
    NEW.assigned_embedding_provider_id = OLD.assigned_embedding_provider_id;
    NEW.assigned_summarization_provider_id = OLD.assigned_summarization_provider_id;
    NEW.assigned_agent_provider_id = OLD.assigned_agent_provider_id;
    NEW.assigned_vision_provider_id = OLD.assigned_vision_provider_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is active
DROP TRIGGER IF EXISTS tr_preserve_user_columns ON public.users;
CREATE TRIGGER tr_preserve_user_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_user_columns();

-- ============================================================================
-- 2. Purchases Table RLS Hardening (Enforce status = 'pending' on insert)
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own purchases" ON public.purchases;
CREATE POLICY "Users can insert their own purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- ============================================================================
-- 3. Administrative Role Segregation (Remove 'admin' from global view policies)
-- Only 'super_admin' can query other users' data.
-- ============================================================================

-- users
DROP POLICY IF EXISTS users_admin_select ON public.users;
CREATE POLICY users_super_admin_select ON public.users FOR SELECT USING (
  get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS users_admin_update ON public.users;
CREATE POLICY users_super_admin_update ON public.users FOR UPDATE USING (
  get_my_role() = 'super_admin'
);

-- page_connections
DROP POLICY IF EXISTS page_connections_admin_select ON public.page_connections;
CREATE POLICY page_connections_super_admin_select ON public.page_connections FOR SELECT USING (
  get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS page_connections_admin_insert ON public.page_connections;
DROP POLICY IF EXISTS page_connections_admin_update ON public.page_connections;
DROP POLICY IF EXISTS page_connections_admin_delete ON public.page_connections;

CREATE POLICY page_connections_super_admin_insert ON public.page_connections FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY page_connections_super_admin_update ON public.page_connections FOR UPDATE USING (get_my_role() = 'super_admin');
CREATE POLICY page_connections_super_admin_delete ON public.page_connections FOR DELETE USING (get_my_role() = 'super_admin');

-- knowledge_fields
DROP POLICY IF EXISTS knowledge_fields_admin_select ON public.knowledge_fields;
CREATE POLICY knowledge_fields_super_admin_select ON public.knowledge_fields FOR SELECT USING (
  get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS knowledge_fields_admin_insert ON public.knowledge_fields;
DROP POLICY IF EXISTS knowledge_fields_admin_update ON public.knowledge_fields;
DROP POLICY IF EXISTS knowledge_fields_admin_delete ON public.knowledge_fields;

CREATE POLICY knowledge_fields_super_admin_insert ON public.knowledge_fields FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY knowledge_fields_super_admin_update ON public.knowledge_fields FOR UPDATE USING (get_my_role() = 'super_admin');
CREATE POLICY knowledge_fields_super_admin_delete ON public.knowledge_fields FOR DELETE USING (get_my_role() = 'super_admin');

-- documents
DROP POLICY IF EXISTS documents_admin_select ON public.documents;
CREATE POLICY documents_super_admin_select ON public.documents FOR SELECT USING (
  get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS documents_admin_insert ON public.documents;
DROP POLICY IF EXISTS documents_admin_update ON public.documents;
DROP POLICY IF EXISTS documents_admin_delete ON public.documents;

CREATE POLICY documents_super_admin_insert ON public.documents FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY documents_super_admin_update ON public.documents FOR UPDATE USING (get_my_role() = 'super_admin');
CREATE POLICY documents_super_admin_delete ON public.documents FOR DELETE USING (get_my_role() = 'super_admin');

-- chat_sessions
DROP POLICY IF EXISTS chat_sessions_admin_select ON public.chat_sessions;
CREATE POLICY chat_sessions_super_admin_select ON public.chat_sessions FOR SELECT USING (
  get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS chat_sessions_admin_update ON public.chat_sessions;
CREATE POLICY chat_sessions_super_admin_update ON public.chat_sessions FOR UPDATE USING (
  get_my_role() = 'super_admin'
);

-- chat_messages
DROP POLICY IF EXISTS chat_messages_admin_select ON public.chat_messages;
CREATE POLICY chat_messages_super_admin_select ON public.chat_messages FOR SELECT USING (
  get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS chat_messages_admin_insert ON public.chat_messages;
CREATE POLICY chat_messages_super_admin_insert ON public.chat_messages FOR INSERT WITH CHECK (
  get_my_role() = 'super_admin'
);

-- ============================================================================
-- 4. Enable Super Admin reads on Folders & Flows
-- ============================================================================

-- dm_flows
DROP POLICY IF EXISTS dm_flows_super_admin_select ON public.dm_flows;
CREATE POLICY dm_flows_super_admin_select ON public.dm_flows 
  FOR SELECT USING (get_my_role() = 'super_admin');

-- dm_flow_nodes
DROP POLICY IF EXISTS dm_flow_nodes_super_admin_select ON public.dm_flow_nodes;
CREATE POLICY dm_flow_nodes_super_admin_select ON public.dm_flow_nodes 
  FOR SELECT USING (get_my_role() = 'super_admin');

-- dm_flow_edges
DROP POLICY IF EXISTS dm_flow_edges_super_admin_select ON public.dm_flow_edges;
CREATE POLICY dm_flow_edges_super_admin_select ON public.dm_flow_edges 
  FOR SELECT USING (get_my_role() = 'super_admin');

-- chat_session_flows
DROP POLICY IF EXISTS chat_session_flows_super_admin_select ON public.chat_session_flows;
CREATE POLICY chat_session_flows_super_admin_select ON public.chat_session_flows 
  FOR SELECT USING (get_my_role() = 'super_admin');

-- document_folders
DROP POLICY IF EXISTS document_folders_super_admin_select ON public.document_folders;
CREATE POLICY document_folders_super_admin_select ON public.document_folders 
  FOR SELECT USING (get_my_role() = 'super_admin');

-- folder_page_assignments
DROP POLICY IF EXISTS folder_page_assignments_super_admin_select ON public.folder_page_assignments;
CREATE POLICY folder_page_assignments_super_admin_select ON public.folder_page_assignments 
  FOR SELECT USING (get_my_role() = 'super_admin');
