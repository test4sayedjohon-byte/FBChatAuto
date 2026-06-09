// ============================================================================
// Third-Party CRM & Google Sheets Leads Synchronization
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export interface LeadPayload {
  userId: string;
  senderId: string;
  platform: string;
  userName?: string;
  userMessage?: string;
  aiSentiment?: string;
  actionTaken?: string;
  replyMessage?: string;
  email?: string;
  phone?: string;
}

export async function triggerLeadSync(
  supabase: SupabaseClient,
  payload: LeadPayload
): Promise<void> {
  try {
    // Fetch user integrations
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', payload.userId)
      .eq('is_active', true);

    if (error || !integrations || integrations.length === 0) return;

    for (const integration of integrations) {
      try {
        const { integration_type, credentials, config } = integration;

        // Route based on type
        if (integration_type === 'custom_webhook') {
          const webhookUrl = config?.webhook_url;
          if (webhookUrl) {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(5000),
            });
          }
        } else if (integration_type === 'google_sheets') {
          const sheetsWebhook = config?.sheets_webhook_url; // Direct script URL
          if (sheetsWebhook) {
            await fetch(sheetsWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(5000),
            });
          }
        } else if (integration_type === 'hubspot') {
          // HubSpot contact creation API
          const accessToken = credentials?.access_token;
          if (accessToken && payload.email) {
            const hsUrl = 'https://api.hubapi.com/crm/v3/objects/contacts';
            await fetch(hsUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                properties: {
                  email: payload.email,
                  firstname: payload.userName?.split(' ')[0] || '',
                  lastname: payload.userName?.split(' ').slice(1).join(' ') || '',
                  phone: payload.phone || '',
                  hs_lead_status: 'NEW',
                  message: payload.userMessage || '',
                },
              }),
              signal: AbortSignal.timeout(5000),
            });
          }
        }
      } catch (innerErr: any) {
        console.warn(`[Integrations] Failed integration trigger for user ${payload.userId}: ${innerErr.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[Integrations] Global error: ${err.message}`);
  }
}
