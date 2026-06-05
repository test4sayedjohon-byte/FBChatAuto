-- ============================================================================
-- Super Admin Global Read Access Migration
-- ============================================================================
-- Grants the super admin the ability to SELECT from all tenant tables for statistics and management.

-- 1. USERS
DROP POLICY IF EXISTS users_super_admin_select ON public.users;
CREATE POLICY users_super_admin_select ON public.users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = auth.uid() AND u.is_super_admin = true)
);

-- 2. PAGE CONNECTIONS
DROP POLICY IF EXISTS page_connections_super_admin_select ON public.page_connections;
CREATE POLICY page_connections_super_admin_select ON public.page_connections FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = auth.uid() AND u.is_super_admin = true)
);

-- 3. KNOWLEDGE FIELDS
DROP POLICY IF EXISTS knowledge_fields_super_admin_select ON public.knowledge_fields;
CREATE POLICY knowledge_fields_super_admin_select ON public.knowledge_fields FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = auth.uid() AND u.is_super_admin = true)
);

-- 4. DOCUMENTS
DROP POLICY IF EXISTS documents_super_admin_select ON public.documents;
CREATE POLICY documents_super_admin_select ON public.documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = auth.uid() AND u.is_super_admin = true)
);

-- 5. CHAT SESSIONS
DROP POLICY IF EXISTS chat_sessions_super_admin_select ON public.chat_sessions;
CREATE POLICY chat_sessions_super_admin_select ON public.chat_sessions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = auth.uid() AND u.is_super_admin = true)
);

-- 6. CHAT MESSAGES
DROP POLICY IF EXISTS chat_messages_super_admin_select ON public.chat_messages;
CREATE POLICY chat_messages_super_admin_select ON public.chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = auth.uid() AND u.is_super_admin = true)
);
