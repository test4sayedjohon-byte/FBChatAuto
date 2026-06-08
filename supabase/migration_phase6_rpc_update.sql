CREATE OR REPLACE FUNCTION public.get_session_context(
    p_session_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    role TEXT,
    content TEXT,
    created_at TIMESTAMPTZ,
    metadata JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT cm.role, cm.content, cm.created_at, cm.metadata
    FROM public.chat_messages cm
    WHERE cm.session_id = p_session_id
    ORDER BY cm.created_at DESC
    LIMIT p_limit
$$;
