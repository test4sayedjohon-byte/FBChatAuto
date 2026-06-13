-- migration_partition_triggers.sql
ALTER TABLE chat_rules ADD COLUMN IF NOT EXISTS is_canvas_trigger BOOLEAN DEFAULT false;
ALTER TABLE comment_rules ADD COLUMN IF NOT EXISTS is_canvas_trigger BOOLEAN DEFAULT false;
