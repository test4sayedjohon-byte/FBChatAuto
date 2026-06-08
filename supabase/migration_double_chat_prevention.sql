-- ============================================================================
-- Double Chatting Concurrency Prevention Migration
-- ============================================================================

-- 1. Add processing_lock_until column to chat_sessions
--    Nullable — NULL means the session is free to process.
--    Safe to add to existing rows; all existing sessions get NULL by default.
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS processing_lock_until TIMESTAMPTZ DEFAULT NULL;

-- 2. Create function to atomically acquire a session lock.
--    Returns TRUE if the lock was granted, FALSE if already locked by another worker.
--    The lock auto-expires after p_lock_duration seconds to prevent deadlocks.
CREATE OR REPLACE FUNCTION public.acquire_session_lock(
    p_session_id UUID,
    p_lock_duration INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_locked BOOLEAN := false;
BEGIN
    -- Atomically try to acquire the lock.
    -- Only succeeds if: (a) no lock exists, or (b) an existing lock has expired.
    UPDATE public.chat_sessions
    SET processing_lock_until = now() + (p_lock_duration * INTERVAL '1 second')
    WHERE id = p_session_id
      AND (processing_lock_until IS NULL OR processing_lock_until < now());

    IF FOUND THEN
        v_locked := true;
    END IF;

    RETURN v_locked;
END;
$$;

COMMENT ON FUNCTION public.acquire_session_lock IS
    'Atomically acquires a concurrency lock on a chat session. Returns TRUE if granted. '
    'Lock auto-expires after p_lock_duration seconds to prevent deadlocks.';

-- 3. Create function to release the session lock when processing is done.
CREATE OR REPLACE FUNCTION public.release_session_lock(
    p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.chat_sessions
    SET processing_lock_until = NULL
    WHERE id = p_session_id;
END;
$$;

COMMENT ON FUNCTION public.release_session_lock IS
    'Releases the concurrency lock on a chat session after processing is complete.';

-- 4. Safely clean up any existing duplicate fb_message_ids before adding the constraint.
--    Only targets rows where fb_message_id is NOT NULL (AI replies etc. have NULL — ignore those).
--    Keeps the earliest copy of each duplicate, deletes the rest.
DELETE FROM public.chat_messages a
USING public.chat_messages b
WHERE a.fb_message_id IS NOT NULL
  AND a.fb_message_id = b.fb_message_id
  AND a.created_at > b.created_at;

-- 5. Add a PARTIAL unique index on fb_message_id.
--    PARTIAL = only enforces uniqueness when fb_message_id IS NOT NULL.
--    This is critical: AI replies, trigger responses, and human-agent messages
--    all have fb_message_id = NULL and must NOT be blocked.
DROP INDEX IF EXISTS public.uq_chat_messages_fb_message_id;
CREATE UNIQUE INDEX uq_chat_messages_fb_message_id
    ON public.chat_messages (fb_message_id)
    WHERE fb_message_id IS NOT NULL;
