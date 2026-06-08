-- Create version_history table
CREATE TABLE IF NOT EXISTS version_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_value TEXT,
  field_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE version_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own version history"
  ON version_history FOR SELECT
  USING (auth.uid() = user_id);

-- Triggers for page_connections (system prompt)
CREATE OR REPLACE FUNCTION log_system_prompt_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.custom_system_prompt IS DISTINCT FROM NEW.custom_system_prompt THEN
    INSERT INTO version_history (user_id, page_id, entity_type, entity_id, previous_value, field_name)
    VALUES (NEW.user_id, NEW.page_id, 'system_prompt', NEW.page_id, OLD.custom_system_prompt, 'custom_system_prompt');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_system_prompt_change ON page_connections;
CREATE TRIGGER trigger_log_system_prompt_change
  BEFORE UPDATE ON page_connections
  FOR EACH ROW
  EXECUTE FUNCTION log_system_prompt_change();


-- Triggers for knowledge_fields
CREATE OR REPLACE FUNCTION log_knowledge_field_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO version_history (user_id, page_id, entity_type, entity_id, previous_value, field_name)
    VALUES (NEW.user_id, NEW.page_id, 'quick_answer', NEW.id::TEXT, NULL, NEW.field_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.field_value IS DISTINCT FROM NEW.field_value THEN
      INSERT INTO version_history (user_id, page_id, entity_type, entity_id, previous_value, field_name)
      VALUES (NEW.user_id, NEW.page_id, 'quick_answer', NEW.id::TEXT, OLD.field_value, NEW.field_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO version_history (user_id, page_id, entity_type, entity_id, previous_value, field_name)
    VALUES (OLD.user_id, OLD.page_id, 'quick_answer', OLD.id::TEXT, OLD.field_value, OLD.field_name);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_knowledge_field_change ON knowledge_fields;
CREATE TRIGGER trigger_log_knowledge_field_change
  BEFORE INSERT OR UPDATE OR DELETE ON knowledge_fields
  FOR EACH ROW
  EXECUTE FUNCTION log_knowledge_field_change();


-- Triggers for documents
CREATE OR REPLACE FUNCTION log_document_change()
RETURNS TRIGGER AS $$
DECLARE
  v_page_id TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get page_id from folder_page_assignments
    SELECT page_id INTO v_page_id FROM folder_page_assignments WHERE folder_id = NEW.folder_id LIMIT 1;
    INSERT INTO version_history (user_id, page_id, entity_type, entity_id, previous_value, field_name)
    VALUES (NEW.user_id, v_page_id, 'document', NEW.id::TEXT, NULL, NEW.title);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.original_content IS DISTINCT FROM NEW.original_content THEN
      SELECT page_id INTO v_page_id FROM folder_page_assignments WHERE folder_id = NEW.folder_id LIMIT 1;
      INSERT INTO version_history (user_id, page_id, entity_type, entity_id, previous_value, field_name)
      VALUES (NEW.user_id, v_page_id, 'document', NEW.id::TEXT, OLD.original_content, NEW.title);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT page_id INTO v_page_id FROM folder_page_assignments WHERE folder_id = OLD.folder_id LIMIT 1;
    INSERT INTO version_history (user_id, page_id, entity_type, entity_id, previous_value, field_name)
    VALUES (OLD.user_id, v_page_id, 'document', OLD.id::TEXT, OLD.original_content, OLD.title);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_document_change ON documents;
CREATE TRIGGER trigger_log_document_change
  BEFORE INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION log_document_change();
