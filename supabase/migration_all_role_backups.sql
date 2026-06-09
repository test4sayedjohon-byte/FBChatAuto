-- Add role-specific fallback order columns to ai_providers
ALTER TABLE ai_providers 
ADD COLUMN IF NOT EXISTS fallback_chat_order integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fallback_agent_order integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fallback_summarize_order integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fallback_vision_order integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fallback_embedding_order integer DEFAULT NULL;

-- Migrate existing fallback_order to fallback_chat_order
UPDATE ai_providers 
SET fallback_chat_order = fallback_order 
WHERE fallback_order IS NOT NULL;
