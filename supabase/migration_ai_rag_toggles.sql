-- Add feed_to_ai columns to dm_flows, chat_rules, and comment_rules
ALTER TABLE public.dm_flows ADD COLUMN IF NOT EXISTS feed_to_ai BOOLEAN DEFAULT true;
ALTER TABLE public.chat_rules ADD COLUMN IF NOT EXISTS feed_to_ai BOOLEAN DEFAULT true;
ALTER TABLE public.comment_rules ADD COLUMN IF NOT EXISTS feed_to_ai BOOLEAN DEFAULT true;
