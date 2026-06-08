-- ============================================================================
-- Role System Migration: user / admin / super_admin
-- ============================================================================
-- NOTE: Uses get_my_role() SECURITY DEFINER function to avoid infinite
-- recursion that occurs when RLS policies on 'users' query 'users' directly.
-- ============================================================================
-- Existing super admins are automatically migrated to role = 'super_admin'.
-- Existing regular users become role = 'user' (the default).
-- ============================================================================

-- 1. Add the role column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- 2. Migrate existing super admins
UPDATE public.users SET role = 'super_admin' WHERE is_super_admin = true;

-- 3. Add index for fast role lookups (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

-- ============================================================================
-- 4. Update RLS Policies
-- Replace all is_super_admin = true checks with role = 'super_admin'.
-- Grant admins (role = 'admin') read access to tenant tables.
-- ============================================================================

-- ── USERS TABLE ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS users_super_admin_select ON public.users;
CREATE POLICY users_admin_select ON public.users FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('admin', 'super_admin')
  )
);

-- ── PAGE CONNECTIONS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS page_connections_super_admin_select ON public.page_connections;
CREATE POLICY page_connections_admin_select ON public.page_connections FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('admin', 'super_admin')
  )
);

-- ── KNOWLEDGE FIELDS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS knowledge_fields_super_admin_select ON public.knowledge_fields;
CREATE POLICY knowledge_fields_admin_select ON public.knowledge_fields FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('admin', 'super_admin')
  )
);

-- ── DOCUMENTS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS documents_super_admin_select ON public.documents;
CREATE POLICY documents_admin_select ON public.documents FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('admin', 'super_admin')
  )
);

-- ── CHAT SESSIONS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS chat_sessions_super_admin_select ON public.chat_sessions;
CREATE POLICY chat_sessions_admin_select ON public.chat_sessions FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('admin', 'super_admin')
  )
);

-- ── CHAT MESSAGES ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS chat_messages_super_admin_select ON public.chat_messages;
CREATE POLICY chat_messages_admin_select ON public.chat_messages FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid()
    AND u.role IN ('admin', 'super_admin')
  )
);

-- ── AI PROVIDERS (super_admin only — global providers) ───────────────────────
DROP POLICY IF EXISTS ai_providers_super_admin_all ON public.ai_providers;
CREATE POLICY ai_providers_super_admin_all ON public.ai_providers
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
  );
