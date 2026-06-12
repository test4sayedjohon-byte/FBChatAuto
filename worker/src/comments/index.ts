// ============================================================================
// Webhook Comments Processor — FB feed & IG comments Coordinator
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPageConnectionFallback, getUserRecord } from '../db';
import { createSupabaseAdmin } from '../supabase';
import { verifyAndDeductCredits } from '../credits';
import { evaluateCommentRules } from './rules';
import { sendCommentReply, hideComment, sendPrivateReply, deleteComment, blockUserOnPage, likeComment, fetchPostContext } from './meta-api';
import { triggerLeadSync } from './integrations';
import { syncOmnichannelIdentity } from './omnichannel-sync';
import { startFlow } from '../chat/flow-engine';
import { getChatProviderChain, getEmbeddingProviderChain } from '../ai/provider';
import { callChatCompletionWithFailover } from '../ai/client';
import { searchDocuments } from '../rag/pipeline';

/**
 * Resolve raw Supabase URLs to branded media redirect links.
 */
async function resolveBrandedUrls(supabase: SupabaseClient, urls: string[]): Promise<string[]> {
  if (!urls || urls.length === 0) return [];
  const branded: string[] = [];
  for (const url of urls) {
    try {
      if (url.includes('/media_assets/')) {
        const { data } = await supabase
          .from('media')
          .select('id, name')
          .eq('file_url', url)
          .maybeSingle();
        if (data) {
          branded.push(`https://mybonusdm.junoverseai.com/media/${data.name || data.id}`);
          continue;
        }
      }
    } catch (e) {
      console.warn('[Comments Webhook] Failed to resolve branded URL:', e);
    }
    branded.push(url);
  }
  return branded;
}

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

  // Load user record to check suspension
  const userRecord = await getUserRecord(env.DB, supabase, userId);
  if (userRecord?.is_suspended) {
    console.warn(`[Comments Webhook] User ${userId} is suspended. Stopping processing.`);
    return;
  }

  if (userRecord?.is_paused) {
    console.warn(`[Comments Webhook] User ${userId} is paused by administrator. Stopping processing.`);
    return;
  }

  for (const change of changes) {
    let commentId = '';
    let postId = '';
    let parentId: string | null = null;
    let senderId = '';
    let senderName = '';
    let messageText = '';
    let mediaUrl: string | null = null;
    let cost = 1;
    let finalAction = 'no_action';
    let replyMessageText = '';
    let dmSentId = '';
    let ruleResult: any = null;
    let matchedMediaAsset: any = null;
    let creditsDeducted = false;

    try {
      const { field, value } = change;
      if (field !== 'feed' && field !== 'comments') continue;

      // 2. Extract values based on platform
      if (platform === 'facebook') {
        if (value.item !== 'comment' || value.verb !== 'add') continue;
        commentId = value.comment_id;
        postId = value.post_id;
        parentId = value.parent_id || null;
        senderId = value.from?.id || value.sender_id;
        senderName = value.from?.name || value.sender_name || '';
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

      // 2b. Thread-level reply check: skip replies if the parent thread has already been processed by the bot
      if (parentId !== null) {
        const { data: parentLog } = await supabase
          .from('comment_logs')
          .select('id')
          .eq('comment_id', parentId)
          .maybeSingle();

        if (parentLog) {
          console.log(`[Comments Webhook] Comment ${commentId} is a reply in a thread already processed (parent: ${parentId}). Skipping.`);
          continue;
        }
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

      finalAction = 'no_action';
      replyMessageText = '';
      dmSentId = '';
      const actionsExecuted: string[] = [];

      // 6. Evaluate comment rules first to get correct classification and cost
      try {
        ruleResult = await evaluateCommentRules(
          supabase,
          userId,
          pageConnection.page_id,
          messageText,
          postId,
          platform,
          mediaUrl,
          env.DB,
          senderId,
          pageConnection.access_token
        );
      } catch (err: any) {
        console.error(`[Comments Webhook] evaluateCommentRules failed: ${err.message}`);
        ruleResult = { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [], cost: 1 };
      }

      cost = ruleResult.cost;

      // 7. Credits check & deduction
      const creditRes = await verifyAndDeductCredits(supabase, userId, cost);
      if (!creditRes.success) {
        console.warn(`[Comments Webhook] Credit deduction failed for user ${userId}: ${creditRes.error}`);
        continue;
      }
      creditsDeducted = true;

      // Early parse media trigger tag from generated reply if dynamic AI reply was evaluated
      if (ruleResult.useDynamicAiReply && ruleResult.generated_reply) {
        const attachMediaRegex = /\[(?:AttachMedia|SendFile|SendMedia):\s*([a-zA-Z0-9_-]+)\s*\]/i;
        const mediaMatch = ruleResult.generated_reply.match(attachMediaRegex);
        if (mediaMatch) {
          const mediaAlias = mediaMatch[1];
          try {
            const { data: mediaAsset } = await supabase
              .from('media')
              .select('id, name, friendly_name, file_url, file_type, times_sent')
              .eq('user_id', userId)
              .eq('name', mediaAlias)
              .maybeSingle();
            if (mediaAsset) {
              matchedMediaAsset = mediaAsset;
              console.log(`[Comments Webhook] Parsed dynamic media trigger: ${mediaAlias}`);
              // Fire-and-forget: increment usage counter (non-blocking)
              supabase
                .from('media')
                .update({ times_sent: (mediaAsset.times_sent ?? 0) + 1 })
                .eq('id', mediaAsset.id)
                .then(({ error: cntErr }) => {
                  if (cntErr) console.warn('[Comments Webhook] Failed to increment times_sent:', cntErr.message);
                });
            }
          } catch (mediaErr) {
            console.error('[Comments Webhook] Failed to query media trigger:', mediaErr);
          }
          ruleResult.generated_reply = ruleResult.generated_reply.replace(attachMediaRegex, '').trim();
        }
      }

      const actions = ruleResult.actions || [];

      if (actions.includes('ignore')) {
        console.log(`[Comments Webhook] Comment ${commentId} matched an ignore rule. Skipping all actions.`);
        const { error: dbErr } = await supabase
          .from('comment_logs')
          .insert({
            user_id: userId,
            page_connection_id: pageConnection.page_id,
            platform,
            post_id: postId || 'unknown',
            comment_id: commentId,
            parent_comment_id: parentId,
            sender_id: senderId || 'unknown',
            user_name: senderName || 'Unknown User',
            user_message: messageText || '',
            ai_sentiment: ruleResult.sentiment || 'neutral',
            ai_toxicity_score: ruleResult.toxicityScore || 0,
            action_taken: 'ignored',
            reply_message: null,
            dm_sent_id: null,
            credits_deducted: cost,
          });
        if (dbErr) {
          console.error(`[Comments Webhook] Failed to insert ignore comment log: ${dbErr.message}`);
        }
        continue;
      }

      // Helper to check for permission errors
      const isPermissionError = (err: any) => {
        const msg = (err.message || '').toLowerCase();
        return msg.includes('permission') || msg.includes('oauthexception') || msg.includes('scope') || msg.includes('code: 200') || msg.includes('code: 3') || msg.includes('code: 10');
      };

      let isCommentHidden = false;

      // 9. Execute actions
      // A. HIDE or TRASH_QUEUE (Trash Queue is essentially a hide + status logged as trashed)
      if (actions.includes('hide') || actions.includes('trash_queue')) {
        try {
          await hideComment(pageConnection.access_token, commentId);
          isCommentHidden = true;
          actionsExecuted.push(actions.includes('trash_queue') ? 'trashed' : 'hidden');
        } catch (err: any) {
          console.error(`[Comments Webhook] hideComment failed: ${err.message}`);
        }
      }

      // B. DELETE
      if (actions.includes('delete') || actions.includes('delete_and_block')) {
        try {
          await deleteComment(pageConnection.access_token, commentId);
          actionsExecuted.push('deleted');
        } catch (err: any) {
          console.error(`[Comments Webhook] deleteComment failed: ${err.message}`);
          if (isPermissionError(err)) {
            console.warn(`[Comments Webhook] Permission issue during deletion. Falling back to hide.`);
            try {
              if (!isCommentHidden) {
                await hideComment(pageConnection.access_token, commentId);
                isCommentHidden = true;
              }
              actionsExecuted.push('fallback_hidden_due_to_permissions');
            } catch (hideErr: any) {
              console.error(`[Comments Webhook] Fallback hide failed: ${hideErr.message}`);
            }
          }
        }
      }

      // C. BLOCK USER
      if (actions.includes('block') || actions.includes('delete_and_block')) {
        try {
          await blockUserOnPage(pageConnection.access_token, pageConnection.page_id, senderId);
          actionsExecuted.push('blocked');
        } catch (err: any) {
          console.error(`[Comments Webhook] blockUserOnPage failed: ${err.message}`);
          if (isPermissionError(err)) {
            console.warn(`[Comments Webhook] Permission issue during user block. Falling back to hide.`);
            try {
              if (!isCommentHidden) {
                await hideComment(pageConnection.access_token, commentId);
                isCommentHidden = true;
              }
              if (!actionsExecuted.includes('fallback_hidden_due_to_permissions')) {
                actionsExecuted.push('fallback_hidden_due_to_permissions');
              }
            } catch (hideErr: any) {
              console.error(`[Comments Webhook] Fallback hide failed: ${hideErr.message}`);
            }
          }
        }
      }

      // D. LIKE COMMENT
      if (actions.includes('like') || actions.includes('like_and_reply') || actions.includes('like_and_dm')) {
        try {
          await likeComment(pageConnection.access_token, commentId);
          actionsExecuted.push('liked');
        } catch (err: any) {
          console.error(`[Comments Webhook] likeComment failed: ${err.message}`);
        }
      }

      // E. PUBLIC REPLY
      if (actions.includes('reply') || actions.includes('like_and_reply')) {
        let replyText = ruleResult.useDynamicAiReply
          ? (ruleResult.generated_reply || ruleResult.replyTemplate || 'Thanks for commenting!')
          : (ruleResult.replyTemplate || 'Thanks for commenting!');

        if (matchedMediaAsset) {
          const brandedMediaUrl = `https://mybonusdm.junoverseai.com/media/${matchedMediaAsset.name || matchedMediaAsset.id}`;
          replyText += `\n\nLink: ${brandedMediaUrl}`;
        }

        if (ruleResult.attachmentUrls && ruleResult.attachmentUrls.length > 0) {
          const brandedUrls = await resolveBrandedUrls(supabase, ruleResult.attachmentUrls);
          replyText += '\n\nFiles:\n' + brandedUrls.join('\n');
        }

        try {
          await sendCommentReply(pageConnection.access_token, commentId, replyText);
          actionsExecuted.push('replied');
          replyMessageText = replyText;
        } catch (err: any) {
          console.error(`[Comments Webhook] sendCommentReply failed: ${err.message}`);
        }
      }

      // F. PRIVATE DM HANDSHAKE
      if (actions.includes('dm') || actions.includes('like_and_dm')) {
        let dmText = ruleResult.dmReplyTemplate || '';
        const dmAttachs = ruleResult.dmAttachmentUrls || ruleResult.attachmentUrls;
        
        let primaryImageUrl: string | null = null;
        let primaryFileUrl: string | null = null;
        let primaryFileName: string | null = null;
        let remainingAttachs: string[] = [];

        if (dmAttachs && dmAttachs.length > 0) {
          const resolvedUrls = await resolveBrandedUrls(supabase, dmAttachs);

          // Robust check if the first attachment is an image
          let isImg = false;
          try {
            const pathname = new URL(dmAttachs[0]).pathname;
            isImg = /\.(png|jpg|jpeg|gif|webp)$/i.test(pathname);
          } catch (e) {
            isImg = /\.(png|jpg|jpeg|gif|webp)/i.test(dmAttachs[0]);
          }

          if (isImg) {
            primaryImageUrl = dmAttachs[0];
            remainingAttachs = resolvedUrls.slice(1);
          } else {
            // It's a document/PDF! Send it as a native attachment template
            primaryFileUrl = resolvedUrls[0];
            
            // Try to resolve the actual saved friendly name first
            if (dmAttachs[0].includes('/media_assets/')) {
              try {
                const { data } = await supabase
                  .from('media')
                  .select('friendly_name, name')
                  .eq('file_url', dmAttachs[0])
                  .maybeSingle();
                if (data) {
                  primaryFileName = data.friendly_name || data.name || null;
                }
              } catch (_) {}
            }

            // Get original extension from the URL
            let origExt = '';
            try {
              const urlParts = new URL(dmAttachs[0]).pathname.split('/');
              const lastPart = urlParts[urlParts.length - 1];
              const extIndex = lastPart.lastIndexOf('.');
              if (extIndex !== -1) {
                origExt = lastPart.substring(extIndex).toLowerCase();
              }
            } catch (_) {}

            if (primaryFileName) {
              if (origExt && !primaryFileName.toLowerCase().endsWith(origExt)) {
                primaryFileName += origExt;
              }
            } else {
              // Fallback to filename in the URL
              try {
                const urlParts = new URL(dmAttachs[0]).pathname.split('/');
                primaryFileName = urlParts[urlParts.length - 1];
              } catch (_) {
                primaryFileName = 'brochure.pdf';
              }
            }
            remainingAttachs = resolvedUrls.slice(1);
          }
        }

        if (matchedMediaAsset) {
          if (matchedMediaAsset.file_type === 'image' && !primaryImageUrl) {
            primaryImageUrl = matchedMediaAsset.file_url;
          } else if (matchedMediaAsset.file_type !== 'image' && !primaryFileUrl) {
            primaryFileUrl = `https://mybonusdm.junoverseai.com/media/${matchedMediaAsset.name || matchedMediaAsset.id}`;
            let assetName = matchedMediaAsset.friendly_name || matchedMediaAsset.name || 'document.pdf';
            
            let origExt = '';
            try {
              const urlParts = new URL(matchedMediaAsset.file_url).pathname.split('/');
              const lastPart = urlParts[urlParts.length - 1];
              const extIndex = lastPart.lastIndexOf('.');
              if (extIndex !== -1) {
                origExt = lastPart.substring(extIndex).toLowerCase();
              }
            } catch (_) {}

            if (origExt && !assetName.toLowerCase().endsWith(origExt)) {
              assetName += origExt;
            }
            primaryFileName = assetName;
          } else {
            const brandedMediaUrl = `https://mybonusdm.junoverseai.com/media/${matchedMediaAsset.name || matchedMediaAsset.id}`;
            remainingAttachs.push(brandedMediaUrl);
          }
        }

        if (remainingAttachs.length > 0) {
          if (dmText) {
            dmText += '\n\nFiles:\n' + remainingAttachs.join('\n');
          } else {
            dmText = 'Files:\n' + remainingAttachs.join('\n');
          }
        }

        // Fallback default message if both dmText, primaryImageUrl, and primaryFileUrl are completely empty
        if (!dmText && !primaryImageUrl && !primaryFileUrl) {
          dmText = ruleResult.replyTemplate || 'Thanks for your comment! Here is the link you requested.';
        }

        try {
          if (ruleResult.dmFlowId) {
            // Retrieve or create chat session
            let sessionId = '';
            
            // 1. Try Supabase first
            try {
              const { data: sessionData } = await supabase.rpc(
                'get_or_create_session',
                {
                  p_page_id: pageConnection.page_id,
                  p_sender_id: senderId,
                  p_user_id: pageConnection.user_id,
                  p_session_timeout: 1800,
                }
              );
              if (sessionData?.o_session_id) {
                sessionId = sessionData.o_session_id;
              }
            } catch (err) {
              console.warn(`[Comments Webhook] Supabase get session failed in comments index:`, err);
            }

            // 2. Fallback to D1
            if (!sessionId) {
              const sessionRes = await env.DB.prepare(
                `SELECT id FROM chat_sessions WHERE page_id = ? AND sender_id = ?`
              )
                .bind(pageConnection.page_id, senderId)
                .first();
              
              if (sessionRes) {
                sessionId = sessionRes.id as string;
              } else {
                sessionId = crypto.randomUUID();
              }
            }

            // 3. Cache the resolved session in D1
            const nowISO = new Date().toISOString();
            await env.DB.prepare(
              `INSERT OR REPLACE INTO chat_sessions (id, user_id, page_id, sender_id, bot_paused, unread_count, last_message_at)
               VALUES (?, ?, ?, ?, 1, 0, ?)`
            )
              .bind(sessionId, pageConnection.user_id, pageConnection.page_id, senderId, nowISO)
              .run();

            // 4. Cache/upsert in Supabase (in case of D1 fallback)
            try {
              await supabase.from('chat_sessions').upsert({
                id: sessionId,
                user_id: pageConnection.user_id,
                page_id: pageConnection.page_id,
                sender_id: senderId,
                bot_paused: true,
                status: 'active'
              });
            } catch (_) {}

            const flowRes = await startFlow(
              env.DB,
              supabase,
              sessionId,
              ruleResult.dmFlowId,
              pageConnection,
              senderId,
              commentId
            );
            if (flowRes.success) {
              dmSentId = `flow:${ruleResult.dmFlowId}`;
              actionsExecuted.push('dm_sent');
            } else {
              dmSentId = `flow_failed: ${flowRes.error || 'unknown error'}`;
              actionsExecuted.push('dm_failed');
            }
          } else {
            const dmRes = await sendPrivateReply(
              pageConnection.access_token,
              commentId,
              dmText,
              primaryImageUrl,
              primaryFileUrl,
              primaryFileName
            );
            dmSentId = dmRes?.message_id || 'sent';
            actionsExecuted.push('dm_sent');
          }
        } catch (err: any) {
          console.error(`[Comments Webhook] DM / Flow start failed: ${err.message}`);
          dmSentId = 'failed_api_call';
        }
      }

      finalAction = actionsExecuted.filter((v, i, a) => a.indexOf(v) === i).join(',');
      if (!finalAction) {
        finalAction = 'no_action';
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
      try {
        const { error: dbErr } = await supabase
          .from('comment_logs')
          .insert({
            user_id: userId,
            page_connection_id: pageConnection.page_id,
            platform,
            post_id: postId || 'unknown',
            comment_id: commentId,
            parent_comment_id: parentId,
            sender_id: senderId || 'unknown',
            user_name: senderName || 'Unknown User',
            user_message: messageText || '',
            ai_sentiment: ruleResult?.sentiment || 'neutral',
            ai_toxicity_score: ruleResult?.toxicityScore || 0,
            action_taken: finalAction,
            reply_message: replyMessageText || null,
            dm_sent_id: dmSentId || null,
            credits_deducted: cost,
          });

        if (dbErr) {
          console.error(`[Comments Webhook] Failed to insert comment log: ${dbErr.message}`);
        } else {
          console.log(`[Comments Webhook] Comment ${commentId} logged successfully in database.`);
        }
      } catch (dbInsertErr: any) {
        console.error(`[Comments Webhook] Exception during comment log insert: ${dbInsertErr.message}`);
      }

      console.log(`[Comments Webhook] Comment ${commentId} processed successfully. Action: ${finalAction}`);
    } catch (err: any) {
      console.error(`[Comments Webhook] Error processing change in entries: ${err.message}`);
      
      // Fallback logging on error to ensure comment is still logged in DB
      try {
        if (userId && pageConnection && commentId) {
          const fallbackAction = (typeof finalAction !== 'undefined' && finalAction) ? finalAction : 'failed_error';
          const fallbackCost = creditsDeducted ? cost : 0;
          await supabase
            .from('comment_logs')
            .insert({
              user_id: userId,
              page_connection_id: pageConnection.page_id,
              platform,
              post_id: postId || 'unknown',
              comment_id: commentId,
              parent_comment_id: parentId || null,
              sender_id: senderId || 'unknown',
              user_name: senderName || 'Unknown User',
              user_message: messageText || '',
              ai_sentiment: ruleResult?.sentiment || 'neutral',
              ai_toxicity_score: ruleResult?.toxicityScore || 0,
              action_taken: fallbackAction,
              reply_message: `Error: ${err.message}`,
              dm_sent_id: dmSentId || null,
              credits_deducted: fallbackCost,
            });
          console.log(`[Comments Webhook] Fallback error comment log written for comment ${commentId}.`);
        }
      } catch (fallbackErr: any) {
        console.error(`[Comments Webhook] Failed to write fallback error log: ${fallbackErr.message}`);
      }
    }
  }
}
