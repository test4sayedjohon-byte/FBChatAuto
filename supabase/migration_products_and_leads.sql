-- ============================================================================
-- FB Chat Auto — Products & Leads Migration
-- ============================================================================

-- 1. Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    price       NUMERIC(10, 2) NOT NULL,
    currency    VARCHAR(10) DEFAULT 'BDT',
    image_url   TEXT,
    options     JSONB DEFAULT '{}'::jsonb, -- e.g., {"sizes": ["S", "M", "L"], "colors": ["Red", "Blue"]}
    inventory   INTEGER DEFAULT -1,        -- -1 = Unlimited
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own products" ON public.products 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products" ON public.products 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products" ON public.products 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products" ON public.products 
    FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_products_user ON public.products(user_id);

-- 2. Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id     UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    flow_id        UUID NOT NULL REFERENCES public.dm_flows(id) ON DELETE CASCADE,
    customer_name  VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    platform       VARCHAR(50) CHECK (platform IN ('messenger', 'instagram', 'whatsapp')),
    product_id     UUID REFERENCES public.products(id) ON DELETE SET NULL,
    details        JSONB NOT NULL DEFAULT '{}'::jsonb, -- captured size, color, quantity, custom fields
    status         VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own leads" ON public.leads 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads" ON public.leads 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" ON public.leads 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" ON public.leads 
    FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_leads_user ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_session ON public.leads(session_id);
