-- ============================================================================
-- Billing Cycle Cache Migration (Phase 2)
-- Adds billing_cycle_anchor to users to optimize webhook performance
-- ============================================================================

-- 1. Add column to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.users.billing_cycle_anchor
  IS 'Cached timestamp of the user billing cycle anchor (latest approved purchase or registration date).';

-- 2. Update the purchase approval trigger function to calculate the anchor
CREATE OR REPLACE FUNCTION public.handle_purchase_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_message_limit_add INTEGER := 0;
  v_vision_limit_add INTEGER := 0;
  v_agent_limit_add INTEGER := 0;
  v_set_unlimited BOOLEAN := false;
  v_match text;
  v_billing_cycle_anchor TIMESTAMPTZ;
  v_user_created TIMESTAMPTZ;
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

    -- Calculate the new billing cycle anchor:
    -- Find latest approved purchase (which isn't a gift) for this user (including this new one)
    SELECT created_at INTO v_billing_cycle_anchor
    FROM public.purchases
    WHERE user_id = NEW.user_id
      AND status = 'approved'
      AND payment_method != 'gift'
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no approved non-gift purchase exists, use user registration date
    IF v_billing_cycle_anchor IS NULL THEN
      SELECT created_at INTO v_billing_cycle_anchor
      FROM public.users
      WHERE id = NEW.user_id;
    END IF;

    -- Update user limits and cache the anchor
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
      agent_extra_queries = CASE
        WHEN v_agent_limit_add > 0 AND (
          agent_usage_month IS NULL OR agent_usage_month <> to_char(NOW(), 'YYYY-MM')
        ) THEN v_agent_limit_add
        ELSE COALESCE(agent_extra_queries, 0) + v_agent_limit_add
      END,
      agent_usage_month = CASE
        WHEN v_agent_limit_add > 0 THEN to_char(NOW(), 'YYYY-MM')
        ELSE agent_usage_month
      END,
      
      -- Cache the computed billing cycle anchor
      billing_cycle_anchor = COALESCE(v_billing_cycle_anchor, created_at)
      
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Populate existing users' anchors
UPDATE public.users u
SET billing_cycle_anchor = COALESCE(
  (
    SELECT created_at 
    FROM public.purchases p 
    WHERE p.user_id = u.id 
      AND p.status = 'approved' 
      AND p.payment_method != 'gift' 
    ORDER BY p.created_at DESC 
    LIMIT 1
  ),
  u.created_at
)
WHERE u.billing_cycle_anchor IS NULL;
