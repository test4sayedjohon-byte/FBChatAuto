-- ============================================================================
-- Admin Audit Log, Per-User AI Provider Overrides & Admin Write Policies
-- ============================================================================
-- Run AFTER migration_roles.sql
--
-- This migration:
--   A. Adds 2 missing per-user AI provider override columns to `users`
--   B. Creates the `admin_audit_log` table for tracking admin actions
--   C. Adds INSERT/UPDATE/DELETE RLS policies for admin/super_admin roles
-- ============================================================================

-- ============================================================================
-- A. Per-User AI Provider Override Columns
-- ============================================================================
-- The following override columns ALREADY EXIST (added via SQL editor):
--   - assigned_chat_provider_id
--   - assigned_fallback_chat_provider_id
--   - assigned_embedding_provider_id
--
-- These 2 are NEW:

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS assigned_summarization_provider_id UUID
    REFERENCES public.ai_providers(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS assigned_agent_provider_id UUID
    REFERENCES public.ai_providers(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.assigned_summarization_provider_id
  IS 'Per-user override: specific AI provider for conversation summarization. NULL = inherit global.';
COMMENT ON COLUMN public.users.assigned_agent_provider_id
  IS 'Per-user override: specific AI provider for the super admin agent. NULL = inherit global.';


-- ============================================================================
-- B. Admin Audit Log
-- ============================================================================
-- Tracks every admin action for accountability and compliance.
-- Actions: plan_change, role_change, suspend, unsuspend, impersonate,
--          provider_override, delete_user, quota_change

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_id ON public.admin_audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.admin_audit_log(action);

COMMENT ON TABLE public.admin_audit_log IS 'Audit trail for all admin/super_admin actions. Used for accountability and compliance.';
COMMENT ON COLUMN public.admin_audit_log.action IS 'Action type: plan_change, role_change, suspend, unsuspend, impersonate, provider_override, delete_user, quota_change';
COMMENT ON COLUMN public.admin_audit_log.details IS 'JSON details: { old_value, new_value, provider_role, reason, ... }';

-- RLS: Only admins/super_admins can read audit logs, only service role can write
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_select ON public.admin_audit_log FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

-- Insert policy: admins can insert their own audit entries
CREATE POLICY audit_log_admin_insert ON public.admin_audit_log FOR INSERT WITH CHECK (
    auth.uid() = admin_id
    AND EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);


-- ============================================================================
-- C. Admin Write Policies (INSERT, UPDATE, DELETE)
-- ============================================================================
-- Currently admins only have SELECT access on tenant tables.
-- These policies grant write access to admin/super_admin roles.

-- ── USERS TABLE (UPDATE only — admins can change plan, role, suspension, quotas, provider overrides) ──
CREATE POLICY users_admin_update ON public.users FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

-- ── PAGE CONNECTIONS (full CRUD for admins) ──
CREATE POLICY page_connections_admin_insert ON public.page_connections FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY page_connections_admin_update ON public.page_connections FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY page_connections_admin_delete ON public.page_connections FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

-- ── KNOWLEDGE FIELDS (full CRUD for admins) ──
CREATE POLICY knowledge_fields_admin_insert ON public.knowledge_fields FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY knowledge_fields_admin_update ON public.knowledge_fields FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY knowledge_fields_admin_delete ON public.knowledge_fields FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

-- ── DOCUMENTS (full CRUD for admins) ──
CREATE POLICY documents_admin_insert ON public.documents FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY documents_admin_update ON public.documents FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY documents_admin_delete ON public.documents FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

-- ── CHAT SESSIONS (UPDATE for admins — toggle bot_paused, change status) ──
CREATE POLICY chat_sessions_admin_update ON public.chat_sessions FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);

-- ── CHAT MESSAGES (INSERT for admins — allows sending messages in inbox mirror) ──
CREATE POLICY chat_messages_admin_insert ON public.chat_messages FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
);
