-- migration_folders.sql

-- 1. Create document_folders table
CREATE TABLE public.document_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_folders_select ON public.document_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY document_folders_insert ON public.document_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY document_folders_update ON public.document_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY document_folders_delete ON public.document_folders FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.document_folders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Create folder_page_assignments table
CREATE TABLE public.folder_page_assignments (
    folder_id UUID NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL REFERENCES public.page_connections(page_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    PRIMARY KEY (folder_id, page_id)
);

ALTER TABLE public.folder_page_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY folder_page_assignments_select ON public.folder_page_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY folder_page_assignments_insert ON public.folder_page_assignments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY folder_page_assignments_delete ON public.folder_page_assignments FOR DELETE USING (auth.uid() = user_id);

-- 3. Alter documents table
ALTER TABLE public.documents ADD COLUMN folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE;
ALTER TABLE public.documents DROP COLUMN IF EXISTS page_id;

-- 4. Drop document_page_assignments table (if exists)
DROP TABLE IF EXISTS public.document_page_assignments CASCADE;

-- 5. Update match_documents function
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
    JOIN public.folder_page_assignments fpa ON fpa.folder_id = d.folder_id
    WHERE dc.user_id = p_user_id
      AND d.is_active = true
      AND (p_page_id IS NULL OR fpa.page_id = p_page_id)
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY dc.embedding <=> p_query_embedding
    LIMIT p_match_count;
$$;
