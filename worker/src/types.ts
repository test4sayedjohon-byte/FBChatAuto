// ============================================================================
// Type Definitions for the Facebook Webhook Worker
// ============================================================================

/**
 * Cloudflare Worker environment bindings.
 * Secrets are set via `wrangler secret put <KEY>`.
 */
export interface Env {
  // Facebook
  FB_VERIFY_TOKEN: string;
  FB_APP_SECRET: string;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  // General
  ENVIRONMENT: string;
  
  // Cloudflare D1 Failover DB
  DB: D1Database;

  // Agent configuration (optional, for highly capable agentic tasks)
  AGENT_API_KEY?: string;
  AGENT_MODEL?: string;
}

/**
 * Authenticated user info attached by the requireAuth middleware.
 */
export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * Hono app environment type — combines Cloudflare bindings with
 * custom context variables set by middleware (e.g., authUser).
 */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    authUser: AuthUser;
  };
};


/**
 * Facebook Webhook Event payload.
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks
 */
export interface FacebookWebhookEvent {
  object: string;
  entry: FacebookEntry[];
}

export interface FacebookEntry {
  id: string;        // Page ID
  time: number;      // Epoch timestamp
  messaging?: FacebookMessagingEvent[];
  changes?: any[];
}

export interface FacebookMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;       // Message ID
    text?: string;
    attachments?: Array<{
      type: string;
      payload: {
        url?: string;
      };
    }>;
  };
  postback?: {
    title: string;
    payload: string;
  };
  delivery?: {
    mids: string[];
    watermark: number;
  };
  read?: {
    watermark: number;
  };
}

/**
 * WhatsApp Webhook Event payload.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */
export interface WhatsAppWebhookEvent {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;        // WABA (WhatsApp Business Account) ID
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

export interface WhatsAppValue {
  messaging_product: string; // 'whatsapp'
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: {
    mime_type: string;
    sha256: string;
    id: string;
  };
  audio?: {
    mime_type: string;
    sha256: string;
    id: string;
  };
  video?: {
    mime_type: string;
    sha256: string;
    id: string;
  };
  document?: {
    mime_type: string;
    sha256: string;
    id: string;
    filename?: string;
  };
  voice?: {
    mime_type: string;
    sha256: string;
    id: string;
  };
  interactive?: {
    type: string;
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
}

export interface WhatsAppStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

/**
 * Page connection row from Supabase.
 */
export interface PageConnection {
  id: string;
  user_id: string;
  page_id: string;
  page_name: string | null;
  access_token: string;
  is_active: boolean;
  webhook_secret: string | null;
  bot_name: string | null;
  custom_system_prompt: string | null;
  ai_model: string | null;
  temperature: number;
  ai_provider_id?: string | null;
  enable_customer_profiling?: boolean;
  profiling_model?: string | null;
  trigger_words?: string[] | null;
  trigger_responses?: string[] | null;
  is_trigger_enabled?: boolean;
  whatsapp_phone_number_id?: string | null;
  whatsapp_business_account_id?: string | null;
  is_whatsapp_active?: boolean;
  instagram_account_id?: string | null;
  is_instagram_active?: boolean;
}
