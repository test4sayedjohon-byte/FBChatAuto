-- ============================================================================
-- FB Chat Auto — Supabase Schema (Phase 1)
-- Multi-tenant AI Chatbot Automation for Facebook Pages
-- ============================================================================
-- Prerequisites:
--   1. Enable pgvector extension in Supabase Dashboard → Database → Extensions
--   2. Run this file in the Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS (extends Supabase Auth)
-- ============================================================================
-- Supabase Auth already creates `auth.users`. This is a public profile table
-- that mirrors essential user data and holds tenant-specific settings.

CREATE TABLE public.users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    display_name    TEXT,
    avatar_url      TEXT,
    plan            TEXT NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'pro', 'enterprise')),
    settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'Public user profiles extending Supabase Auth. One row per tenant.';
COMMENT ON COLUMN public.users.plan IS 'Subscription tier — controls rate limits and feature access.';
COMMENT ON COLUMN public.users.settings IS 'Tenant-level settings (e.g., AI model preference, session timeout).';

-- Auto-create a user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 2. PAGE CONNECTIONS (Facebook Pages linked to a tenant)
-- ============================================================================
-- Each row represents a Facebook Page that a user has connected.
-- The `page_id` is the Facebook Page ID used to route incoming webhooks
-- to the correct tenant.

CREATE TABLE public.page_connections (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    page_id         TEXT NOT NULL,           -- Facebook Page ID (numeric string)
    page_name       TEXT,                    -- Human-readable page name
    access_token    TEXT NOT NULL,           -- Page-scoped access token (encrypted at rest via Supabase Vault in production)
    is_active       BOOLEAN NOT NULL DEFAULT true,
    webhook_secret  TEXT,                    -- Per-page webhook verification token
    bot_name        TEXT,                    -- AI Bot Persona Name (e.g., 'Sarah from Support')
    custom_system_prompt TEXT,               -- The massive markdown file context
    ai_model        TEXT,                    -- Preferred AI model (e.g., 'gemini-1.5-flash')
    temperature     FLOAT DEFAULT 0.5,       -- Creativity slider
    connected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_page_id UNIQUE (page_id)  -- A Facebook Page can only be connected once globally
);

CREATE INDEX idx_page_connections_user_id ON public.page_connections(user_id);
CREATE INDEX idx_page_connections_page_id ON public.page_connections(page_id);

COMMENT ON TABLE public.page_connections IS 'Facebook Pages connected by tenants. Used to route webhooks to the correct user. Also stores Bot Profiles.';
COMMENT ON COLUMN public.page_connections.page_id IS 'Facebook Page ID — the key used to identify which tenant owns an incoming message.';
COMMENT ON COLUMN public.page_connections.access_token IS 'Page access token for sending replies via Graph API. Should be encrypted in production.';
COMMENT ON COLUMN public.page_connections.custom_system_prompt IS 'Page-specific custom system prompt (e.g., business guidelines in markdown).';


-- ============================================================================
-- 3. KNOWLEDGE FIELDS (Simple key-value business data)
-- ============================================================================
-- These are simple text fields the user defines in their dashboard
-- (e.g., "Business Hours: 9am-5pm", "Return Policy: 30 days").
-- They are dynamically injected into the AI system prompt on every message.

CREATE TABLE public.knowledge_fields (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    page_id         TEXT REFERENCES public.page_connections(page_id) ON DELETE CASCADE, -- Null = Global, Set = Page-specific
    field_name      TEXT NOT NULL,           -- e.g., "Business Hours"
    field_value     TEXT NOT NULL,           -- e.g., "Mon-Fri, 9am to 5pm EST"
    category        TEXT DEFAULT 'general',  -- Optional grouping: 'pricing', 'products', 'policies', etc.
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_user_page_field_name UNIQUE NULLS NOT DISTINCT (user_id, page_id, field_name)
);

CREATE INDEX idx_knowledge_fields_user_id ON public.knowledge_fields(user_id);
CREATE INDEX idx_knowledge_fields_page_id ON public.knowledge_fields(page_id);

COMMENT ON TABLE public.knowledge_fields IS 'Simple key-value facts injected into the AI system prompt. Editable from the dashboard. Can be global or page-specific.';


-- ============================================================================
-- 4. DOCUMENTS & EMBEDDINGS (RAG via pgvector)
-- ============================================================================
-- Users upload text/documents which are chunked and embedded.
-- Each chunk becomes a row with a vector embedding for similarity search.

-- 4a. Parent document metadata
CREATE TABLE public.documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    page_id         TEXT REFERENCES public.page_connections(page_id) ON DELETE CASCADE, -- Null = Global, Set = Page-specific
    title           TEXT NOT NULL,
    source_type     TEXT NOT NULL DEFAULT 'text'
                    CHECK (source_type IN ('text', 'pdf', 'url', 'file')),
    original_content TEXT,                   -- Raw content before chunking
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_page_id ON public.documents(page_id);

COMMENT ON TABLE public.documents IS 'Parent records for uploaded documents. Can be global or page-specific. Each document is split into chunks for RAG.';

-- 4b. Document chunks with vector embeddings
CREATE TABLE public.document_chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,        -- Order within the parent document
    content         TEXT NOT NULL,            -- The actual text chunk
    token_count     INTEGER,                 -- Approximate token count for budget tracking
    embedding       vector(1536),            -- OpenAI text-embedding-3-small dimensions
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_document_chunk UNIQUE (document_id, chunk_index)
);

-- HNSW index for fast approximate nearest-neighbor search
-- cosine distance is standard for OpenAI embeddings
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX idx_document_chunks_document_id ON public.document_chunks(document_id);

COMMENT ON TABLE public.document_chunks IS 'Chunked document text with vector embeddings for RAG similarity search.';
COMMENT ON COLUMN public.document_chunks.embedding IS '1536-dim vector from text-embedding-3-small. Searched via cosine similarity.';


-- ============================================================================
-- 5. CHAT SESSIONS (Conversation thread management)
-- ============================================================================
-- Each Facebook Messenger conversation maps to a session.
-- Sessions expire after a configurable idle period, creating a new session
-- for returning customers so the AI starts fresh.

CREATE TABLE public.chat_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    page_id         TEXT NOT NULL,            -- Facebook Page ID
    sender_id       TEXT NOT NULL,            -- Facebook PSID (Page-Scoped User ID)
    sender_name     TEXT,                     -- Cached sender display name
    sender_avatar   TEXT,                     -- Cached sender profile picture
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'archived', 'escalated')),
    bot_paused      BOOLEAN NOT NULL DEFAULT false, -- Human takeover flag
    unread_count    INTEGER NOT NULL DEFAULT 0,     -- Unread messages for inbox
    message_count   INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_timeout INTEGER NOT NULL DEFAULT 1800,  -- Seconds of inactivity before session expires (default 30 min)
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

    -- The unique constraint for active sessions is handled by the partial index below
);

-- Partial unique index: only one active session per sender per page at a time
DROP INDEX IF EXISTS idx_unique_active_session;
CREATE UNIQUE INDEX idx_unique_active_session
    ON public.chat_sessions (page_id, sender_id)
    WHERE status = 'active';

CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_page_sender ON public.chat_sessions(page_id, sender_id);
CREATE INDEX idx_chat_sessions_last_message ON public.chat_sessions(last_message_at);

COMMENT ON TABLE public.chat_sessions IS 'Conversation threads between a Facebook user and a Page. Used for context windowing.';
COMMENT ON COLUMN public.chat_sessions.session_timeout IS 'Idle seconds before a session auto-expires. Configurable per tenant.';
COMMENT ON COLUMN public.chat_sessions.sender_id IS 'Facebook Page-Scoped User ID (PSID). Unique per user per page.';


-- ============================================================================
-- 6. CHAT MESSAGES (Individual messages within a session)
-- ============================================================================
-- Stores every message in a conversation for context retrieval.
-- The Worker retrieves the last N messages from the active session
-- to construct the AI conversation context.

CREATE TABLE public.chat_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'human_agent', 'internal_note')),
    content         TEXT NOT NULL,
    token_count     INTEGER,                 -- Approximate tokens used by this message
    fb_message_id   TEXT,                    -- Facebook's message ID for deduplication
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(session_id, created_at DESC);
CREATE INDEX idx_chat_messages_fb_id ON public.chat_messages(fb_message_id) WHERE fb_message_id IS NOT NULL;

COMMENT ON TABLE public.chat_messages IS 'Individual messages within a chat session. Retrieved with LIMIT for context windowing.';
COMMENT ON COLUMN public.chat_messages.role IS 'Message author: user (Facebook customer), assistant (AI bot), system (injected context).';
COMMENT ON COLUMN public.chat_messages.fb_message_id IS 'Facebook message ID used for deduplication of webhook retries.';


-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- 7a. Get or create an active session for an incoming message
CREATE OR REPLACE FUNCTION public.get_or_create_session(
    p_page_id TEXT,
    p_sender_id TEXT,
    p_user_id UUID,
    p_session_timeout INTEGER DEFAULT 1800,
    OUT o_session_id UUID,
    OUT o_bot_paused BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
    v_last_message TIMESTAMPTZ;
    v_timeout INTEGER;
BEGIN
    -- Look for an existing active session
    SELECT id, last_message_at, session_timeout, bot_paused
    INTO v_session_id, v_last_message, v_timeout, o_bot_paused
    FROM public.chat_sessions
    WHERE page_id = p_page_id
      AND sender_id = p_sender_id
      AND status = 'active';

    -- If session exists, check if it's expired
    IF v_session_id IS NOT NULL THEN
        IF (now() - v_last_message) > (v_timeout * INTERVAL '1 second') THEN
            -- Expire the old session
            UPDATE public.chat_sessions
            SET status = 'expired'
            WHERE id = v_session_id;

            v_session_id := NULL;  -- Force creation of a new session
        END IF;
    END IF;

    -- Create a new session if needed
    IF v_session_id IS NULL THEN
        INSERT INTO public.chat_sessions (user_id, page_id, sender_id, session_timeout)
        VALUES (p_user_id, p_page_id, p_sender_id, p_session_timeout)
        RETURNING id, bot_paused INTO v_session_id, o_bot_paused;
    END IF;

    o_session_id := v_session_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_session IS 'Finds the active session for a sender, expiring stale ones. Creates a new session if needed.';

-- 7b. Retrieve the last N messages from a session (for context window)
CREATE OR REPLACE FUNCTION public.get_session_context(
    p_session_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    role TEXT,
    content TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT cm.role, cm.content, cm.created_at
    FROM public.chat_messages cm
    WHERE cm.session_id = p_session_id
    ORDER BY cm.created_at DESC
    LIMIT p_limit
$$;

COMMENT ON FUNCTION public.get_session_context IS 'Returns the last N messages from a session in reverse-chronological order for context injection.';

-- 7c. Vector similarity search for RAG
CREATE OR REPLACE FUNCTION public.match_documents(
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_page_id TEXT DEFAULT NULL,
    p_match_threshold FLOAT DEFAULT 0.7,
    p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    document_id UUID,
    metadata JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        dc.id,
        dc.content,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        dc.document_id,
        dc.metadata
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    WHERE dc.user_id = p_user_id
      AND d.is_active = true
      AND (d.page_id IS NULL OR d.page_id = p_page_id)
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY dc.embedding <=> p_query_embedding
    LIMIT p_match_count;
$$;

COMMENT ON FUNCTION public.match_documents IS 'Cosine similarity search against document chunks for a given tenant, optionally filtered by page_id. Used by the RAG pipeline.';


-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Every tenant-scoped table gets RLS so the frontend client can safely
-- interact with Supabase without a backend intermediary.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users: can only read/update their own profile
CREATE POLICY users_select ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update ON public.users FOR UPDATE USING (auth.uid() = id);

-- Page connections: tenant-scoped CRUD
CREATE POLICY page_connections_select ON public.page_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY page_connections_insert ON public.page_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY page_connections_update ON public.page_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY page_connections_delete ON public.page_connections FOR DELETE USING (auth.uid() = user_id);

-- Knowledge fields: tenant-scoped CRUD
CREATE POLICY knowledge_fields_select ON public.knowledge_fields FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY knowledge_fields_insert ON public.knowledge_fields FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY knowledge_fields_update ON public.knowledge_fields FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY knowledge_fields_delete ON public.knowledge_fields FOR DELETE USING (auth.uid() = user_id);

-- Documents: tenant-scoped CRUD
CREATE POLICY documents_select ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY documents_insert ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY documents_update ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY documents_delete ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- Document chunks: tenant-scoped read (writes happen server-side)
CREATE POLICY document_chunks_select ON public.document_chunks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY document_chunks_insert ON public.document_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY document_chunks_delete ON public.document_chunks FOR DELETE USING (auth.uid() = user_id);

-- Chat sessions: tenant-scoped read
CREATE POLICY chat_sessions_select ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);

-- Chat messages: tenant-scoped read
CREATE POLICY chat_messages_select ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);

-- Service role bypass: The Cloudflare Worker uses the service_role key,
-- which bypasses RLS entirely. This is by design — the webhook needs
-- unrestricted access to route messages across tenants.


-- ============================================================================
-- 9. UPDATED_AT TRIGGER (auto-update timestamps)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.page_connections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.knowledge_fields
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
