-- ============================================================================
-- AutometaBot — Supabase Schema (System Content Prompts)
-- Description: Adds Global Content Prompts managed by super admin to drive AI content generation.
-- ============================================================================

-- 1. Create table public.system_content_prompts
CREATE TABLE IF NOT EXISTS public.system_content_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    image_prompt_text TEXT,
    sequence_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.system_content_prompts ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS system_content_prompts_select ON public.system_content_prompts;
CREATE POLICY system_content_prompts_select ON public.system_content_prompts
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS system_content_prompts_admin_all ON public.system_content_prompts;
CREATE POLICY system_content_prompts_admin_all ON public.system_content_prompts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
    );

-- 4. Default Seed Data
INSERT INTO public.system_content_prompts (title, prompt_text, image_prompt_text, sequence_order)
VALUES
('Product Awareness', 'Introduce our product and core features. Focus on explaining what problem our product solves, who it is for, and the unique value proposition. Hook the reader with a relatable pain point and end with a clear Call to Action (CTA) directing them to learn more.', 'A sleek modern workspace with a laptop displaying a vibrant dashboard, clean aesthetic, 4k, professional photography', 1),
('Educational Tip', 'Share a valuable, actionable tip, best practice, or educational insight related to our industry. Do not pitch the product directly; instead, establish authority and provide genuine value. End with a question asking the audience for their thoughts or experiences.', 'Infographic style visual showing steps of a workflow, modern design, clean background, high contrast', 2),
('User Story & Perspective', 'Share a customer success story, user perspective, or case study. Focus on the transformation: the struggle before using our solution, the discovery, and the successful outcome/result. Use an emotional hook and authentic tone.', 'A happy professional smiling while looking at a tablet screen in a bright office environment, natural lighting, premium look', 3),
('Interactive Hook', 'Create a short, highly engaging post designed to drive comments and interaction. Ask a thought-provoking industry question, run a virtual poll (e.g. A vs B), or share an interesting statistic. Keep the caption punchy and encourage immediate comments.', 'Two contrasting options styled as elegant visual blocks side-by-side, neon accents, eye-catching design', 4),
('Sequential Sequel (Part 2)', 'This post is a follow-up or deeper dive into the topic discussed in the previous post. Build on the narrative, adding advanced tips, next steps, or a sequel angle. Refer to the previous context and keep the storyline cohesive.', 'A logical next step illustration, futuristic tech concept art, glowing lines, clean rendering', 5)
ON CONFLICT DO NOTHING;
