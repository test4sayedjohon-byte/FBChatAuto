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
BEGIN
  -- If status changes from pending to approved
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE public.users
    SET 
      allowed_channels = allowed_channels + NEW.channels_count,
      monthly_message_limit = CASE 
        WHEN COALESCE(monthly_message_limit, 0) = -1 OR NEW.message_addon = 'unlimited' THEN -1
        ELSE COALESCE(monthly_message_limit, 0) + (NEW.channels_count * 300) + 
             CASE 
               WHEN NEW.message_addon = '+500' THEN 500
               WHEN NEW.message_addon = '+1000' THEN 1000
               ELSE 0
             END
      END
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for purchase approval
DROP TRIGGER IF EXISTS trg_purchase_approval ON public.purchases;
CREATE TRIGGER trg_purchase_approval
  AFTER UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_approval();
