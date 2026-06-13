import { callChatCompletion } from './client';
import { getActiveChatProvider } from './provider';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TargetFilter {
  intent_levels?: string[];
  tags?: string[];
  last_active_hours?: number;
}

export interface BroadcastContact {
  sender_id: string;
  sender_name: string;
  summary: string;
  intent_level: string;
  last_message_at: string;
}

/**
 * Fetch matching contacts for campaign using customer_profiles and chat_sessions
 */
export async function getMatchingContacts(
  supabase: SupabaseClient,
  userId: string,
  pageId: string,
  filters: TargetFilter,
  sendingOrder: 'random' | 'latest_first' | 'oldest_first'
): Promise<BroadcastContact[]> {
  // 1. Fetch customer profiles
  let profileQuery = supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('page_id', pageId);

  if (filters.intent_levels && filters.intent_levels.length > 0) {
    profileQuery = profileQuery.in('intent_level', filters.intent_levels);
  }

  const { data: profiles, error: profileErr } = await profileQuery;
  if (profileErr || !profiles) {
    console.error('[Broadcast] Error fetching customer profiles:', profileErr?.message);
    return [];
  }

  // 2. Filter by tags in memory (since metadata is jsonb)
  let filteredProfiles = profiles;
  if (filters.tags && filters.tags.length > 0) {
    const filterTags = filters.tags.map(t => t.toLowerCase());
    filteredProfiles = profiles.filter(p => {
      const profileTags = Array.isArray(p.metadata?.tags)
        ? p.metadata.tags.map((t: string) => t.toLowerCase())
        : [];
      return filterTags.some(t => profileTags.includes(t));
    });
  }

  // 3. Fetch chat sessions for matching sender IDs to get last_message_at & sender_name
  const senderIds = filteredProfiles.map(p => p.sender_id);
  if (senderIds.length === 0) return [];

  // Break sender IDs into batches if too many (to prevent query length errors)
  const limit = 500;
  let sessions: any[] = [];
  for (let i = 0; i < senderIds.length; i += limit) {
    const chunk = senderIds.slice(i, i + limit);
    const { data: sessionChunk } = await supabase
      .from('chat_sessions')
      .select('sender_id, sender_name, last_message_at')
      .eq('user_id', userId)
      .eq('page_id', pageId)
      .in('sender_id', chunk);
    if (sessionChunk) {
      sessions = sessions.concat(sessionChunk);
    }
  }

  const sessionMap = new Map<string, { sender_name: string; last_message_at: string }>();
  for (const s of sessions) {
    sessionMap.set(s.sender_id, {
      sender_name: s.sender_name || 'there',
      last_message_at: s.last_message_at
    });
  }

  // 4. Combine and filter by last active hours
  let contacts: BroadcastContact[] = filteredProfiles.map(p => {
    const s = sessionMap.get(p.sender_id);
    return {
      sender_id: p.sender_id,
      sender_name: s?.sender_name || 'there',
      summary: p.summary || '',
      intent_level: p.intent_level || 'unknown',
      last_message_at: s?.last_message_at || p.created_at
    };
  });

  if (filters.last_active_hours) {
    const activeSince = new Date(Date.now() - filters.last_active_hours * 60 * 60 * 1000).toISOString();
    contacts = contacts.filter(c => c.last_message_at >= activeSince);
  }

  // 5. Sort based on sending_order
  if (sendingOrder === 'latest_first') {
    contacts.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  } else if (sendingOrder === 'oldest_first') {
    contacts.sort((a, b) => a.last_message_at.localeCompare(b.last_message_at));
  } else {
    // random shuffle
    for (let i = contacts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [contacts[i], contacts[j]] = [contacts[j], contacts[i]];
    }
  }

  return contacts;
}

/**
 * Generate a batch of 50 personalized messages for a campaign
 */
export async function generateBroadcastBatch(
  supabase: SupabaseClient,
  campaignId: string,
  userId: string,
  pageId: string,
  db?: D1Database
): Promise<{ success: boolean; generatedCount: number; message?: string }> {
  // 1. Fetch Campaign Details
  const { data: campaign, error: campErr } = await supabase
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) {
    return { success: false, generatedCount: 0, message: campErr?.message || 'Campaign not found' };
  }

  // 2. Fetch existing queue entries to see what sender IDs are already processed
  const { data: existingQueue } = await supabase
    .from('broadcast_queue')
    .select('sender_id, batch_number')
    .eq('campaign_id', campaignId);

  const processedSenders = new Set<string>(existingQueue?.map(q => q.sender_id) || []);
  const maxBatchNumber = existingQueue?.reduce((max, q) => Math.max(max, q.batch_number || 1), 0) || 0;
  const nextBatchNumber = maxBatchNumber + 1;

  // 3. Get all eligible contacts
  const allContacts = await getMatchingContacts(
    supabase,
    userId,
    pageId,
    campaign.filters,
    campaign.sending_order
  );

  // Filter out contacts already in the queue
  const pendingContacts = allContacts.filter(c => !processedSenders.has(c.sender_id));

  if (pendingContacts.length === 0) {
    return { success: true, generatedCount: 0, message: 'All target contacts have already been processed.' };
  }

  // Slice the next 50 contacts
  const batchContacts = pendingContacts.slice(0, 50);

  // 4. Resolve active AI Provider Config
  const aiProvider = await getActiveChatProvider(supabase, userId, db);
  if (!aiProvider) {
    return { success: false, generatedCount: 0, message: 'No active AI Provider configured for this tenant.' };
  }

  // 5. Fetch previous approved/sent message examples for few-shot learning
  const { data: approvedExamples } = await supabase
    .from('broadcast_queue')
    .select('customer_name, message_content')
    .eq('campaign_id', campaignId)
    .in('status', ['sent', 'queued'])
    .limit(4);

  let fewShotText = '';
  if (approvedExamples && approvedExamples.length > 0) {
    fewShotText = `\nHere are some examples of messages that were APPROVED and SENT to other customers in this campaign. You MUST match their tone, length, and style:\n`;
    for (const ex of approvedExamples) {
      fewShotText += `- Customer: ${ex.customer_name}\n  Approved Message: "${ex.message_content}"\n`;
    }
  }

  const goal = campaign.ai_prompt_goal || 'Start a conversation and offer help.';

  // 6. Generate messages for each contact in parallel (with concurrency limit)
  const queueItems: any[] = [];
  const chunkSize = 5; // run 5 at a time to prevent rate limits
  for (let i = 0; i < batchContacts.length; i += chunkSize) {
    const chunk = batchContacts.slice(i, i + chunkSize);
    const promises = chunk.map(async (contact) => {
      let finalMessage = '';

      if (campaign.mode === 'single') {
        finalMessage = campaign.static_templates?.[0] || 'Hello!';
      } else if (campaign.mode === 'multiple_random') {
        const templates = campaign.static_templates || ['Hello!'];
        finalMessage = templates[Math.floor(Math.random() * templates.length)];
      } else {
        // AI Personalized mode
        try {
          const systemPrompt = `You are a helpful customer assistant. Write a single, highly personalized message to a customer.
Rules:
- Write ONLY the message itself. Do NOT wrap in quotes, do NOT add subject lines, headers, or any filler content.
- Keep the tone human-like, casual, and natural (not bot-like).
- Keep it concise: 1 to 3 sentences max.
- Use the customer's name if appropriate.
- Focus on the Campaign Goal.

Campaign Goal: "${goal}"
${fewShotText}`;

          const userPrompt = `Write the message for this customer:
Customer Name: ${contact.sender_name}
Customer AI Intent: ${contact.intent_level}
Chat Summary / History with Customer: "${contact.summary}"`;

          const aiRes = await callChatCompletion(aiProvider, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ], { temperature: 0.7, maxTokens: 250 });

          finalMessage = aiRes.choices[0]?.message?.content?.trim() || '';
          // Strip any leading/trailing quotes if the model wrapped them
          if (finalMessage.startsWith('"') && finalMessage.endsWith('"')) {
            finalMessage = finalMessage.slice(1, -1);
          }
        } catch (err: any) {
          console.error(`[Broadcast AI Gen] Error generating for ${contact.sender_name}:`, err.message);
          finalMessage = `Hi ${contact.sender_name}, hope you are doing well! Let us know if you need anything.`;
        }
      }

      // Replace variables if static mode is used
      finalMessage = finalMessage.replace(/\{first_name\}/gi, contact.sender_name);
      finalMessage = finalMessage.replace(/\{name\}/gi, contact.sender_name);

      queueItems.push({
        campaign_id: campaignId,
        user_id: userId,
        sender_id: contact.sender_id,
        customer_name: contact.sender_name,
        message_content: finalMessage,
        status: 'pending_review',
        batch_number: nextBatchNumber,
        scheduled_at: null,
      });
    });

    await Promise.all(promises);
  }

  // 7. Insert the generated batch into public.broadcast_queue
  if (queueItems.length > 0) {
    const { error: insertErr } = await supabase
      .from('broadcast_queue')
      .insert(queueItems);
    if (insertErr) {
      console.error('[Broadcast] Error inserting into queue:', insertErr.message);
      return { success: false, generatedCount: 0, message: insertErr.message };
    }
  }

  return { success: true, generatedCount: queueItems.length };
}
