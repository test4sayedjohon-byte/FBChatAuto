-- ============================================================================
-- AutometaBot — Supabase Schema (RLS Hardening Migration)
-- Description: Adds missing WITH CHECK clauses to UPDATE and ALL policies to
-- prevent users from re-assigning their rows to other tenants (privilege escalation).
-- ============================================================================

-- 1. users
DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. page_connections
DROP POLICY IF EXISTS page_connections_update ON public.page_connections;
CREATE POLICY page_connections_update ON public.page_connections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. knowledge_fields
DROP POLICY IF EXISTS knowledge_fields_update ON public.knowledge_fields;
CREATE POLICY knowledge_fields_update ON public.knowledge_fields FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. documents
DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. customer_profiles
DROP POLICY IF EXISTS customer_profiles_update ON public.customer_profiles;
CREATE POLICY customer_profiles_update ON public.customer_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. dm_flows
DROP POLICY IF EXISTS dm_flows_update ON public.dm_flows;
CREATE POLICY dm_flows_update ON public.dm_flows FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. dm_flow_nodes
DROP POLICY IF EXISTS dm_flow_nodes_update ON public.dm_flow_nodes;
CREATE POLICY dm_flow_nodes_update ON public.dm_flow_nodes FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));

-- 8. dm_flow_edges
DROP POLICY IF EXISTS dm_flow_edges_update ON public.dm_flow_edges;
CREATE POLICY dm_flow_edges_update ON public.dm_flow_edges FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.dm_flows WHERE id = flow_id AND user_id = auth.uid()));

-- 9. chat_session_flows
DROP POLICY IF EXISTS chat_session_flows_update ON public.chat_session_flows;
CREATE POLICY chat_session_flows_update ON public.chat_session_flows FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid()));

-- 10. chat_rules
DROP POLICY IF EXISTS chat_rules_update ON public.chat_rules;
CREATE POLICY chat_rules_update ON public.chat_rules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. products
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
CREATE POLICY "Users can update their own products" ON public.products FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 12. leads
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
CREATE POLICY "Users can update their own leads" ON public.leads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 13. broadcast_campaigns
DROP POLICY IF EXISTS broadcasts_update ON public.broadcast_campaigns;
CREATE POLICY broadcasts_update ON public.broadcast_campaigns FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 14. broadcast_queue
DROP POLICY IF EXISTS queue_update ON public.broadcast_queue;
CREATE POLICY queue_update ON public.broadcast_queue FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 15. scheduled_posts
DROP POLICY IF EXISTS scheduled_posts_update ON public.scheduled_posts;
CREATE POLICY scheduled_posts_update ON public.scheduled_posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 16. comment_rules
DROP POLICY IF EXISTS comment_rules_update ON public.comment_rules;
CREATE POLICY comment_rules_update ON public.comment_rules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 17. post_contexts
DROP POLICY IF EXISTS post_contexts_update ON public.post_contexts;
CREATE POLICY post_contexts_update ON public.post_contexts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 18. integrations
DROP POLICY IF EXISTS integrations_update ON public.integrations;
CREATE POLICY integrations_update ON public.integrations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 19. document_folders
DROP POLICY IF EXISTS document_folders_update ON public.document_folders;
CREATE POLICY document_folders_update ON public.document_folders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20. ai_providers
DROP POLICY IF EXISTS ai_providers_update ON public.ai_providers;
CREATE POLICY ai_providers_update ON public.ai_providers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 21. media (formerly chat_assets)
DROP POLICY IF EXISTS "Users can manage their own chat assets" ON public.media;
DROP POLICY IF EXISTS "Users can manage their own media" ON public.media;
CREATE POLICY "Users can manage their own media" ON public.media FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
