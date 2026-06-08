-- ============================================================================
-- FB Chat Auto — Purchases Migration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channels_count INTEGER NOT NULL,
  message_addon VARCHAR NOT NULL,
  currency VARCHAR NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_method VARCHAR NOT NULL,
  manual_payment_details TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all purchases"
  ON public.purchases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_super_admin = true
    )
  );

-- Function to handle purchase approval (auto-update user limits to be additive)
CREATE OR REPLACE FUNCTION public.handle_purchase_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_message_limit_add INTEGER := 0;
  v_vision_limit_add INTEGER := 0;
  v_agent_limit_add INTEGER := 0;
  v_set_unlimited BOOLEAN := false;
  v_match text;
BEGIN
  -- Check if approval condition is met:
  -- For INSERT: status must be 'approved'
  -- For UPDATE: status must change from 'pending' to 'approved'
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved') OR
     (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'approved') THEN
     
    -- Parse messages limit
    IF NEW.message_addon LIKE '%unlimited%' THEN
      v_set_unlimited := true;
    ELSE
      v_match := substring(NEW.message_addon from 'Messages?:? \+(\d+)');
      IF v_match IS NULL THEN
        v_match := substring(NEW.message_addon from 'Gift: \+(\d+) Messages');
      END IF;
      IF v_match IS NULL THEN
        v_match := substring(NEW.message_addon from '\+(\d+) Messages');
      END IF;
      
      IF v_match IS NOT NULL THEN
        v_message_limit_add := v_match::integer;
      ELSIF NEW.message_addon = '+500' THEN
        v_message_limit_add := 500;
      ELSIF NEW.message_addon = '+1000' THEN
        v_message_limit_add := 1000;
      END IF;
    END IF;

    -- Parse vision limit
    v_match := substring(NEW.message_addon from 'Vision?:? \+(\d+)');
    IF v_match IS NULL THEN
      v_match := substring(NEW.message_addon from 'Gift: \+(\d+) Vision');
    END IF;
    IF v_match IS NOT NULL THEN
      v_vision_limit_add := v_match::integer;
    END IF;

    -- Parse agent limit
    v_match := substring(NEW.message_addon from 'Agent?:? \+(\d+)');
    IF v_match IS NULL THEN
      v_match := substring(NEW.message_addon from 'Gift: \+(\d+) AI');
    END IF;
    IF v_match IS NOT NULL THEN
      v_agent_limit_add := v_match::integer;
    END IF;

    -- Update user limits
    UPDATE public.users
    SET 
      plan = CASE WHEN plan = 'enterprise' THEN 'enterprise' ELSE 'pro' END,
      allowed_channels = allowed_channels + NEW.channels_count,
      
      -- Message limits: channels add to monthly limit, addons go to extra_message_limit
      monthly_message_limit = CASE 
        WHEN COALESCE(monthly_message_limit, 0) = -1 OR v_set_unlimited THEN -1
        ELSE COALESCE(monthly_message_limit, 0) + (NEW.channels_count * 300)
      END,
      extra_message_limit = COALESCE(extra_message_limit, 0) + v_message_limit_add,
      
      -- Vision: enable if gifting vision queries.
      -- Reset extras if month has changed (uses existing vision_usage_month column).
      allow_vision = CASE WHEN v_vision_limit_add > 0 THEN true ELSE allow_vision END,
      vision_extra_queries = CASE
        WHEN v_vision_limit_add > 0 AND (
          vision_usage_month IS NULL OR vision_usage_month <> to_char(NOW(), 'YYYY-MM')
        ) THEN v_vision_limit_add
        ELSE COALESCE(vision_extra_queries, 0) + v_vision_limit_add
      END,
      vision_usage_month = CASE
        WHEN v_vision_limit_add > 0 THEN to_char(NOW(), 'YYYY-MM')
        ELSE vision_usage_month
      END,
      
      -- Agent: accumulate extras.
      -- Reset extras if month has changed (uses existing agent_usage_month column).
      agent_extra_queries = CASE
        WHEN v_agent_limit_add > 0 AND (
          agent_usage_month IS NULL OR agent_usage_month <> to_char(NOW(), 'YYYY-MM')
        ) THEN v_agent_limit_add
        ELSE COALESCE(agent_extra_queries, 0) + v_agent_limit_add
      END,
      agent_usage_month = CASE
        WHEN v_agent_limit_add > 0 THEN to_char(NOW(), 'YYYY-MM')
        ELSE agent_usage_month
      END
      
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for purchase approval
DROP TRIGGER IF EXISTS trg_purchase_approval ON public.purchases;
CREATE TRIGGER trg_purchase_approval
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_approval();
