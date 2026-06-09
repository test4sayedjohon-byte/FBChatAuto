// ============================================================================
// Webhook Comments Processor — FB feed & IG comments Coordinator
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPageConnectionFallback } from '../db';
import { createSupabaseAdmin } from '../supabase';
import { verifyAndDeductCredits } from '../credits';
import { evaluateCommentRules } from './rules';
import { sendCommentReply, hideComment, sendPrivateReply } from './meta-api';
import { triggerLeadSync } from './integrations';
import { syncOmnichannelIdentity } from './omnichannel-sync';

export async function processCommentChanges(
  changes: any[],
  pageConnectionId: string,
  platform: 'facebook' | 'instagram',
  env: any,
  expectedUserId: string
): Promise<void> {
  const supabase = createSupabaseAdmin(env);

  // 1. Fetch page connection
  const pageConnection = await getPageConnectionFallback(env.DB, supabase, pageConnectionId);
  if (!pageConnection) {
    console.warn(`[Comments Webhook] Page connection ${pageConnectionId} not found.`);
    return;
  }

  const userId = pageConnection.user_id;

  for (const change of changes) {
    try {
      const { field, value } = change;
      if (field !== 'feed' && field !== 'comments') continue;

      // 2. Extract values based on platform
      let commentId = '';
      let postId = '';
      let parentId = null;
      let senderId = '';
      let senderName = '';
      let messageText = '';
      let mediaUrl = null;

      if (platform === 'facebook') {
        if (value.item !== 'comment' || value.verb !== 'add') continue;
        commentId = value.comment_id;
        postId = value.post_id;
        parentId = value.parent_id || null;
        senderId = value.sender_id;
        senderName = value.sender_name || '';
        messageText = value.message || '';
        mediaUrl = value.attachment || value.photo || null;
      } else {
        // Instagram
        commentId = value.id;
        postId = value.media?.id;
        senderId = value.from?.id;
        senderName = value.from?.username || '';
        messageText = value.text || '';
        // IG webhook comment media is less common but mapped here if present
        mediaUrl = value.media?.media_url || null;
      }

      // Verify platform is active
      if (platform === 'facebook' && !pageConnection.is_active) {
        console.log(`[Comments Webhook] Facebook comments inactive for connection ${pageConnectionId}. Skipping.`);
        continue;
      }
      if (platform === 'instagram' && !pageConnection.is_instagram_active) {
        console.log(`[Comments Webhook] Instagram comments inactive for connection ${pageConnectionId}. Skipping.`);
        continue;
      }

      // Avoid self-reply loops
      if (senderId === pageConnection.page_id) {
        continue;
      }

      // 3. Deduplication check
      const { data: duplicate } = await supabase
        .from('comment_logs')
        .select('id')
        .eq('comment_id', commentId)
        .maybeSingle();

      if (duplicate) {
        console.log(`[Comments Webhook] Comment ${commentId} already processed. Skipping.`);
        continue;
      }

      // 4. Blocklist check
      const { data: isBlocklisted } = await supabase
        .from('user_blocklist')
        .select('id')
        .eq('user_id', userId)
        .eq('sender_id', senderId)
        .maybeSingle();

      if (isBlocklisted) {
        console.log(`[Comments Webhook] Sender ${senderId} is blocklisted. Skipping automation.`);
        continue;
      }

      // 5. STOP keyword opt-out handling
      const isStopTrigger = /^(stop|unsubscribe|optout)$/i.test(messageText.trim());
      if (isStopTrigger) {
        await supabase
          .from('user_blocklist')
          .insert({
            user_id: userId,
            sender_id: senderId,
            platform,
          });
        console.log(`[Comments Webhook] Sender ${senderId} requested opt-out. Added to blocklist.`);
        continue;
      }

      // 6. Cost calculation: Standard = 1 credit, Vision = 3 credits
      const cost = mediaUrl ? 3 : 1;

      // 7. Credits check & deduction
      const creditRes = await verifyAndDeductCredits(supabase, userId, cost);
      if (!creditRes.success) {
        console.warn(`[Comments Webhook] Credit deduction failed for user ${userId}: ${creditRes.error}`);
        continue;
      }

      // 8. Evaluate comment rules
      const ruleResult = await evaluateCommentRules(supabase, userId, pageConnection.page_id, messageText, env.DB);

      let finalAction = 'no_action';
      let replyMessageText = '';
      let dmSentId = '';

      // 9. Execute actions
      if (ruleResult.action === 'hide' || ruleResult.action === 'trash_queue' || ruleResult.action === 'hide_and_reply') {
        try {
          await hideComment(pageConnection.access_token, commentId);
        } catch (err: any) {
          console.error(`[Comments Webhook] hideComment failed: ${err.message}`);
        }
        finalAction = ruleResult.action === 'trash_queue' ? 'trashed' : 'hidden';
      }

      if (ruleResult.action === 'reply' || ruleResult.action === 'hide_and_reply') {
        const replyText = ruleResult.replyTemplate || 'Thanks for commenting!';
        try {
          await sendCommentReply(pageConnection.access_token, commentId, replyText);
        } catch (err: any) {
          console.error(`[Comments Webhook] sendCommentReply failed: ${err.message}`);
        }
        replyMessageText = replyText;
        finalAction = finalAction === 'hidden' ? 'hidden_and_replied' : 'replied';
      }

      if (ruleResult.action === 'dm') {
        const dmText = ruleResult.replyTemplate || 'Thanks for your comment! Here is the link you requested.';
        try {
          const dmRes = await sendPrivateReply(pageConnection.access_token, commentId, dmText);
          dmSentId = dmRes?.message_id || 'sent';
        } catch (err: any) {
          console.error(`[Comments Webhook] sendPrivateReply failed: ${err.message}`);
          dmSentId = 'failed_api_call';
        }
        finalAction = 'dm_sent';
      }

      // 10. Extract contact info for integrations CRM syncs
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g;

      const emails = messageText.match(emailRegex);
      const phones = messageText.match(phoneRegex);

      if (emails || phones) {
        await triggerLeadSync(supabase, {
          userId,
          senderId,
          platform,
          userName: senderName,
          userMessage: messageText,
          aiSentiment: ruleResult.sentiment,
          actionTaken: finalAction,
          replyMessage: replyMessageText || undefined,
          email: emails?.[0] || undefined,
          phone: phones?.[0] || undefined,
        });

        // Trigger Omnichannel Identity Merge
        await syncOmnichannelIdentity(supabase, {
          userId,
          senderId,
          platform,
          userName: senderName,
          email: emails?.[0] || undefined,
          phone: phones?.[0] || undefined,
        });
      }

      // 11. Log engagement in database
      await supabase
        .from('comment_logs')
        .insert({
          user_id: userId,
          page_connection_id: pageConnection.page_id,
          platform,
          post_id: postId,
          comment_id: commentId,
          parent_comment_id: parentId,
          sender_id: senderId,
          user_name: senderName,
          user_message: messageText,
          ai_sentiment: ruleResult.sentiment,
          ai_toxicity_score: ruleResult.toxicityScore,
          action_taken: finalAction,
          reply_message: replyMessageText || null,
          dm_sent_id: dmSentId || null,
          credits_deducted: cost,
        });

      console.log(`[Comments Webhook] Comment ${commentId} processed successfully. Action: ${finalAction}`);
    } catch (err: any) {
      console.error(`[Comments Webhook] Error processing change in entries: ${err.message}`);
    }
  }
}
