import { sendFacebookReply } from '../facebook';
import { sendWhatsAppReply } from '../whatsapp';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sends a single campaign message based on channel connection type
 */
export async function sendCampaignMessage(
  supabase: SupabaseClient,
  campaignId: string,
  recipientId: string,
  messageText: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch the campaign to get the page_id
  const { data: campaign, error: campErr } = await supabase
    .from('broadcast_campaigns')
    .select('page_id')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) {
    return { success: false, error: 'Campaign or page connection not found: ' + campErr?.message };
  }

  // 2. Fetch page connection details
  const { data: conn, error } = await supabase
    .from('page_connections')
    .select('*')
    .eq('page_id', campaign.page_id)
    .single();

  if (error || !conn) {
    return { success: false, error: 'Page connection not found: ' + error?.message };
  }

  if (conn.whatsapp_phone_number_id && conn.is_whatsapp_active) {
    return await sendWhatsAppReply(
      conn.whatsapp_phone_number_id,
      conn.access_token,
      recipientId,
      messageText
    );
  } else {
    return await sendFacebookReply(
      conn.access_token,
      recipientId,
      messageText,
      conn.page_id
    );
  }
}

/**
 * Active runner loop for a campaign.
 * Runs in background (via ctx.waitUntil) or during cron runs.
 */
export async function runBroadcastRunner(
  supabase: SupabaseClient,
  campaignId: string
): Promise<void> {
  console.log(`[Broadcast Runner] Starting runner for campaign: ${campaignId}`);

  while (true) {
    // 1. Fetch Campaign status to check if it's still sending
    const { data: campaign, error: campErr } = await supabase
      .from('broadcast_campaigns')
      .select('status')
      .eq('id', campaignId)
      .single();

    if (campErr || !campaign || campaign.status !== 'sending') {
      console.log(`[Broadcast Runner] Campaign ${campaignId} status is ${campaign?.status || 'unknown'}. Stopping runner.`);
      break;
    }

    // 2. Fetch the next queued message whose scheduled time has arrived
    const { data: msg, error: msgErr } = await supabase
      .from('broadcast_queue')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'queued')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (msgErr) {
      console.error('[Broadcast Runner] Error fetching next message:', msgErr.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    if (!msg) {
      // Check if there are any remaining queued messages at all (even in the future)
      const { count } = await supabase
        .from('broadcast_queue')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'queued');

      if (!count || count === 0) {
        // No more queued messages left in this batch.
        // Check if there are any messages waiting for review in this campaign
        const { count: pendingCount } = await supabase
          .from('broadcast_queue')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .eq('status', 'pending_review');

        if (!pendingCount || pendingCount === 0) {
          console.log(`[Broadcast Runner] Campaign ${campaignId} has no more messages. Marking completed.`);
          await supabase
            .from('broadcast_campaigns')
            .update({ status: 'completed' })
            .eq('id', campaignId);
        } else {
          console.log(`[Broadcast Runner] Batch finished. Campaign ${campaignId} waiting for next batch approval.`);
          await supabase
            .from('broadcast_campaigns')
            .update({ status: 'paused' })
            .eq('id', campaignId);
        }
        break;
      }

      // There are future scheduled messages in the queue, sleep and check again
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    // 3. Mark message as sending to lock it
    await supabase
      .from('broadcast_queue')
      .update({ status: 'sending' })
      .eq('id', msg.id);

    // 4. Send the message
    console.log(`[Broadcast Runner] Sending message to ${msg.customer_name} (${msg.sender_id})`);
    const res = await sendCampaignMessage(supabase, msg.campaign_id, msg.sender_id, msg.message_content);

    // 5. Update message status
    if (res.success) {
      await supabase
        .from('broadcast_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', msg.id);
      console.log(`[Broadcast Runner] Message sent successfully to ${msg.customer_name}`);
    } else {
      const nextRetryCount = (msg.retry_count || 0) + 1;
      const nextStatus = nextRetryCount >= 3 ? 'failed' : 'queued';
      // If retrying, push the schedule back by 60 seconds
      const nextScheduledAt = nextStatus === 'queued'
        ? new Date(Date.now() + 60 * 1000).toISOString()
        : msg.scheduled_at;

      await supabase
        .from('broadcast_queue')
        .update({
          status: nextStatus,
          retry_count: nextRetryCount,
          error_message: res.error || 'Unknown sending failure',
          scheduled_at: nextScheduledAt
        })
        .eq('id', msg.id);
      console.error(`[Broadcast Runner] Message failed to ${msg.customer_name}: ${res.error}`);
    }

    // Sleep for a tiny safety cooldown (1s) before checking the next
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Fallback Cron Job runner (called by scheduled cron)
 */
export async function runCronBroadcasts(supabase: SupabaseClient): Promise<void> {
  // Find all campaigns in 'sending' status
  const { data: activeCampaigns } = await supabase
    .from('broadcast_campaigns')
    .select('id')
    .eq('status', 'sending');

  if (!activeCampaigns || activeCampaigns.length === 0) return;

  console.log(`[Cron Broadcasts] Found ${activeCampaigns.length} active campaigns. Running sweeps...`);

  for (const camp of activeCampaigns) {
    try {
      await runBroadcastRunner(supabase, camp.id);
    } catch (e: any) {
      console.error(`[Cron Broadcasts] Error running campaign ${camp.id}:`, e.message);
    }
  }
}
