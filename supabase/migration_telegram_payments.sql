-- ============================================================================
-- FB Chat Auto — Telegram Payments Migration
-- ============================================================================

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to notify telegram on new pending purchases
CREATE OR REPLACE FUNCTION public.notify_telegram_new_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_token text;
  v_chat_id text;
  v_enabled boolean;
  v_user_email text;
  v_text text;
  v_payload jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_telegram_new_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_token text;
  v_chat_id text;
  v_enabled boolean;
  v_user_email text;
  v_text text;
  v_payload jsonb;
BEGIN
  -- Check if purchase is pending
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending') OR
     (TG_OP = 'UPDATE' AND OLD.status <> 'pending' AND NEW.status = 'pending') THEN
     
    -- Retrieve super admin settings for Telegram Bot
    SELECT 
      (settings->>'telegram_bot_token')::text,
      (settings->>'telegram_admin_chat_id')::text,
      COALESCE((settings->>'telegram_bot_enabled')::boolean, false)
    INTO v_bot_token, v_chat_id, v_enabled
    FROM public.users
    WHERE is_super_admin = true
    LIMIT 1;

    -- If enabled and configured
    IF v_enabled = true AND v_bot_token IS NOT NULL AND v_chat_id IS NOT NULL THEN
      -- Get user email who made the purchase
      SELECT email INTO v_user_email FROM public.users WHERE id = NEW.user_id;

      -- Construct HTML message
      v_text := '🔔 <b>New Purchase Request</b>' || E'\n\n' ||
                '👤 <b>User:</b> ' || COALESCE(v_user_email, 'Unknown') || E'\n' ||
                '📦 <b>Package:</b> ' || NEW.channels_count || ' Channel' || CASE WHEN NEW.channels_count <> 1 THEN 's' ELSE '' END || ' (' || NEW.message_addon || ')' || E'\n' ||
                '💰 <b>Amount:</b> ' || NEW.currency || ' ' || NEW.total_amount || E'\n' ||
                '💳 <b>Method:</b> ' || NEW.payment_method || E'\n';
      
      IF NEW.manual_payment_details IS NOT NULL AND NEW.manual_payment_details <> '' THEN
        v_text := v_text || '📝 <b>Ref:</b> <code>' || NEW.manual_payment_details || '</code>' || E'\n';
      END IF;

      v_text := v_text || '🕒 <b>Date:</b> ' || to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC' || E'\n\n' ||
                'Please approve or reject this payment.';

      -- Construct JSON payload for Telegram sendMessage API
      v_payload := json_build_object(
        'chat_id', v_chat_id,
        'text', v_text,
        'parse_mode', 'HTML',
        'reply_markup', json_build_object(
          'inline_keyboard', json_build_array(
            json_build_array(
              json_build_object('text', 'Approve ✅', 'callback_data', 'approve:' || NEW.id),
              json_build_object('text', 'Reject ❌', 'callback_data', 'reject:' || NEW.id)
            )
          )
        )
      );

      -- Post to Telegram API asynchronously using pg_net
      PERFORM net.http_post(
        url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage',
        body := v_payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS trg_notify_telegram_new_purchase ON public.purchases;
CREATE TRIGGER trg_notify_telegram_new_purchase
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_telegram_new_purchase();
