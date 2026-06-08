export interface Tenant {
  id: string;
  email: string;
  display_name: string;
  plan: string;
  created_at: string;
  is_suspended: boolean;
  is_super_admin: boolean;
  assigned_chat_provider_id: string | null;
  assigned_embedding_provider_id: string | null;
  assigned_fallback_chat_provider_id: string | null;
  assigned_summarization_provider_id: string | null;
  assigned_agent_provider_id: string | null;
  assigned_vision_provider_id: string | null;
  pageCount: number;
  documentCount: number;
  fieldCount: number;
  sessionCount: number;
  messageCount: number;
  monthly_token_limit: number;
  strict_token_enforcement: boolean;
  allowed_channels?: number;
  monthly_message_limit?: number;
  extra_message_limit?: number;
}

export type UserRole = 'user' | 'admin' | 'super_admin';

export interface SuperAdminUser {
  id: string;
  email: string;
  display_name: string;
  plan: string;
  role: UserRole;
  is_super_admin: boolean;
  is_suspended: boolean;
  created_at: string;
  assigned_chat_provider_id: string | null;
  assigned_fallback_chat_provider_id: string | null;
  assigned_embedding_provider_id: string | null;
  assigned_summarization_provider_id: string | null;
  assigned_agent_provider_id: string | null;
  assigned_vision_provider_id: string | null;
  pageCount: number;
  documentCount: number;
  fieldCount: number;
  sessionCount: number;
  messageCount: number;
  monthly_token_limit: number;
  strict_token_enforcement: boolean;
  allowed_channels?: number;
  monthly_message_limit?: number;
  extra_message_limit?: number;
}

export interface InspectData {
  pages: any[];
  documents: any[];
  fields: any[];
  usage: {
    totalMonthTokens: number;
    filteredTokens: number;
    modelBreakdown: { model: string; tokens: number }[];
    dateBreakdown: { date: string; tokens: number }[];
  };
}

export interface PageFormState {
  page_id: string;
  page_name: string;
  access_token: string;
  bot_name: string;
  custom_system_prompt: string;
  ai_model: string;
  temperature: number;
  is_active: boolean;
  ai_provider_id: string;
}

export interface FieldFormState {
  field_name: string;
  field_value: string;
  category: string;
  page_id: string;
  is_active: boolean;
}

export interface DocFormState {
  title: string;
  original_content: string;
  selectedPageIds: string[];
}
