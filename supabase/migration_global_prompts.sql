-- ============================================================================
-- AutometaBot — Supabase Schema (Global Prompts)
-- Description: Adds a new table to manage global system prompts, ideation prompts, and product/image prompts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.global_system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.global_system_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_system_prompts_select ON public.global_system_prompts;
CREATE POLICY global_system_prompts_select ON public.global_system_prompts
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS global_system_prompts_admin_all ON public.global_system_prompts;
CREATE POLICY global_system_prompts_admin_all ON public.global_system_prompts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
    );

INSERT INTO public.global_system_prompts (key, title, prompt_text, description)
VALUES
('ideation_system_prompt', 'Global Ideation System Prompt', 'You are a creative social media strategist...', 'Used for generating initial content ideas.'),
('product_integration_prompt', 'Product/Image Integration Prompt', 'Focus on highlighting the product features in the generated image prompt, placing {{product_name}} dynamically in the scene.', 'Used to append product context to generated image prompts.'),
('default_system_prompt', 'Default Bot System Prompt', 'You are a helpful customer support bot.', 'The default behavior for the chatbot if the user hasn''t customized it.')
ON CONFLICT (key) DO NOTHING;
