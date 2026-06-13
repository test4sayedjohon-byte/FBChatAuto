import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { createSupabaseAdmin } from '../supabase';
import { generateBroadcastBatch, getMatchingContacts } from '../ai/broadcast-generator';
import { runBroadcastRunner } from '../scheduler/broadcast-runner';

const broadcasts = new Hono<AppEnv>();

/**
 * List campaigns for the authenticated tenant
 */
broadcasts.get('/', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);
    const { data: campaigns, error } = await supabase
      .from('broadcast_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ campaigns });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Create a new campaign
 */
broadcasts.post('/', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const {
      name,
      pageId,
      filters,
      sendingOrder,
      mode,
      staticTemplates,
      aiPromptGoal,
      delaySeconds,
      randomizeDelay,
    } = body;

    if (!name || !pageId) {
      return c.json({ error: 'Missing campaign name or page connection.' }, 400);
    }

    const supabase = createSupabaseAdmin(c.env);
    const { data: campaign, error } = await supabase
      .from('broadcast_campaigns')
      .insert({
        user_id: user.id,
        page_id: pageId,
        name,
        filters: filters || {},
        sending_order: sendingOrder || 'random',
        mode: mode || 'single',
        static_templates: staticTemplates || [],
        ai_prompt_goal: aiPromptGoal || '',
        delay_seconds: delaySeconds || 30,
        randomize_delay: randomizeDelay ?? true,
        status: 'draft',
      })
      .select('*')
      .single();

    if (error) return c.json({ error: error.message }, 500);

    return c.json({ success: true, campaign });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Get details & statistics of a campaign
 */
broadcasts.get('/:id', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const campaignId = c.req.param('id');
    const supabase = createSupabaseAdmin(c.env);

    // Fetch campaign
    const { data: campaign, error } = await supabase
      .from('broadcast_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (error || !campaign) {
      return c.json({ error: error?.message || 'Campaign not found' }, 404);
    }

    // Get statistics
    const { data: queueStats, error: statsErr } = await supabase
      .from('broadcast_queue')
      .select('status')
      .eq('campaign_id', campaignId);

    const stats = {
      pending_review: 0,
      queued: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      total: 0,
    };

    if (queueStats) {
      for (const item of queueStats) {
        stats.total++;
        if (item.status === 'pending_review') stats.pending_review++;
        else if (item.status === 'queued') stats.queued++;
        else if (item.status === 'sending') stats.sending++;
        else if (item.status === 'sent') stats.sent++;
        else if (item.status === 'failed') stats.failed++;
      }
    }

    // Fetch total matching contacts count
    const matchingContacts = await getMatchingContacts(
      supabase,
      user.id,
      campaign.page_id,
      campaign.filters,
      campaign.sending_order
    );

    return c.json({
      campaign,
      stats,
      matchingContactsCount: matchingContacts.length,
      unsentContactsCount: Math.max(0, matchingContacts.length - stats.total + stats.pending_review),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Generate next batch of 50 messages
 */
broadcasts.post('/:id/generate-batch', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const campaignId = c.req.param('id');
    const supabase = createSupabaseAdmin(c.env);

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from('broadcast_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campErr || !campaign) {
      return c.json({ error: campErr?.message || 'Campaign not found' }, 404);
    }

    // Check if there is already a batch pending review
    const { count } = await supabase
      .from('broadcast_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending_review');

    if (count && count > 0) {
      return c.json({ error: 'You already have a batch pending review. Please approve or discard it first.' }, 400);
    }

    const genRes = await generateBroadcastBatch(
      supabase,
      campaignId,
      user.id,
      campaign.page_id,
      c.env.DB
    );

    if (!genRes.success) {
      return c.json({ error: genRes.message }, 500);
    }

    return c.json({ success: true, generatedCount: genRes.generatedCount });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Fetch messages pending review for campaign
 */
broadcasts.get('/:id/pending-batch', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const campaignId = c.req.param('id');
    const supabase = createSupabaseAdmin(c.env);

    const { data: pendingMessages, error } = await supabase
      .from('broadcast_queue')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true });

    if (error) return c.json({ error: error.message }, 500);

    return c.json({ pendingMessages });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Edit a pending message content
 */
broadcasts.put('/:id/messages/:messageId', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const messageId = c.req.param('messageId');
    const { messageContent } = await c.req.json();

    const supabase = createSupabaseAdmin(c.env);

    const { data: msg, error } = await supabase
      .from('broadcast_queue')
      .update({ message_content: messageContent })
      .eq('id', messageId)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) return c.json({ error: error.message }, 500);

    return c.json({ success: true, message: msg });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Discard a pending message from campaign review
 */
broadcasts.delete('/:id/messages/:messageId', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const messageId = c.req.param('messageId');
    const supabase = createSupabaseAdmin(c.env);

    const { error } = await supabase
      .from('broadcast_queue')
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id);

    if (error) return c.json({ error: error.message }, 500);

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Approve pending batch: Schedules and activates sending
 */
broadcasts.post('/:id/approve-batch', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const campaignId = c.req.param('id');
    const supabase = createSupabaseAdmin(c.env);

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from('broadcast_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campErr || !campaign) {
      return c.json({ error: campErr?.message || 'Campaign not found' }, 404);
    }

    // Fetch messages pending review
    const { data: pendingMessages } = await supabase
      .from('broadcast_queue')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending_review');

    if (!pendingMessages || pendingMessages.length === 0) {
      return c.json({ error: 'No messages pending review.' }, 400);
    }

    // Calculate paced schedule times
    let nextScheduledTime = Date.now();
    const delayMs = campaign.delay_seconds * 1000;

    for (const msg of pendingMessages) {
      const scheduledAt = new Date(nextScheduledTime).toISOString();
      
      await supabase
        .from('broadcast_queue')
        .update({
          status: 'queued',
          scheduled_at: scheduledAt
        })
        .eq('id', msg.id);

      // Increment next scheduled time with random jitter if enabled
      let actualDelay = delayMs;
      if (campaign.randomize_delay) {
        // Add jitter between -10 seconds and +15 seconds (min delay 5s)
        const jitter = (Math.random() * 25 - 10) * 1000;
        actualDelay = Math.max(5000, delayMs + jitter);
      }
      nextScheduledTime += actualDelay;
    }

    // Update campaign status to 'sending'
    await supabase
      .from('broadcast_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    // Launch runner loop in background
    c.executionCtx.waitUntil(runBroadcastRunner(supabase, campaignId));

    return c.json({ success: true, queuedCount: pendingMessages.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Modify campaign status (Pause, Resume, Stop)
 */
broadcasts.post('/:id/status', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const campaignId = c.req.param('id');
    const { status } = await c.req.json(); // 'paused' | 'sending' | 'stopped'

    if (!['paused', 'sending', 'stopped'].includes(status)) {
      return c.json({ error: 'Invalid campaign status.' }, 400);
    }

    const supabase = createSupabaseAdmin(c.env);

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from('broadcast_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campErr || !campaign) {
      return c.json({ error: campErr?.message || 'Campaign not found' }, 404);
    }

    // Handle status transition
    if (status === 'stopped') {
      // Cancel remaining pending/queued messages
      await supabase
        .from('broadcast_queue')
        .delete()
        .eq('campaign_id', campaignId)
        .in('status', ['pending_review', 'queued']);
    } else if (status === 'sending' && campaign.status === 'paused') {
      // Recalculate scheduled_at for remaining queued messages so they start from NOW
      const { data: queuedMessages } = await supabase
        .from('broadcast_queue')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'queued')
        .order('scheduled_at', { ascending: true });

      if (queuedMessages && queuedMessages.length > 0) {
        let nextScheduledTime = Date.now();
        const delayMs = campaign.delay_seconds * 1000;

        for (const msg of queuedMessages) {
          const scheduledAt = new Date(nextScheduledTime).toISOString();
          await supabase
            .from('broadcast_queue')
            .update({ scheduled_at: scheduledAt })
            .eq('id', msg.id);

          let actualDelay = delayMs;
          if (campaign.randomize_delay) {
            const jitter = (Math.random() * 25 - 10) * 1000;
            actualDelay = Math.max(5000, delayMs + jitter);
          }
          nextScheduledTime += actualDelay;
        }
      }
    }

    // Update campaign status
    const { data: updatedCampaign } = await supabase
      .from('broadcast_campaigns')
      .update({ status })
      .eq('id', campaignId)
      .select('*')
      .single();

    if (status === 'sending') {
      // Spin up the paced sender in background
      c.executionCtx.waitUntil(runBroadcastRunner(supabase, campaignId));
    }

    return c.json({ success: true, campaign: updatedCampaign });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default broadcasts;
