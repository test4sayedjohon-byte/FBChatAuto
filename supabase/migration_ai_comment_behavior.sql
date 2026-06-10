-- Migration: Add AI Comment Behavior Customization Columns
ALTER TABLE public.comment_rules 
ADD COLUMN IF NOT EXISTS ai_comment_instruction TEXT,
ADD COLUMN IF NOT EXISTS ai_folder_overrides UUID[] DEFAULT NULL;
