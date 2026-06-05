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
}

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
}
