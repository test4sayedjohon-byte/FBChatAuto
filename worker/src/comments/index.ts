// ============================================================================
// Webhook Comments Processor — FB feed & IG comments Coordinator
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPageConnectionFallback } from '../db';
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

      // 6. Cost calculation: Standard = 1 credit, Vision = 3 credits
      cost = mediaUrl ? 3 : 1;

      finalAction = 'no_action';
      replyMessageText = '';
      dmSentId = '';
      const actionsExecuted: string[] = [];

      // 7. Credits check & deduction
      const creditRes = await verifyAndDeductCredits(supabase, userId, cost);
      if (!creditRes.success) {
        console.warn(`[Comments Webhook] Credit deduction failed for user ${userId}: ${creditRes.error}`);
        continue;
      }

      // 8. Evaluate comment rules
      try {
        ruleResult = await evaluateCommentRules(supabase, userId, pageConnection.page_id, messageText, postId, env.DB);
      } catch (err: any) {
        console.error(`[Comments Webhook] evaluateCommentRules failed: ${err.message}`);
        ruleResult = { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [] };
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
        let replyText = ruleResult.replyTemplate || 'Thanks for commenting!';
        
        if (ruleResult.useDynamicAiReply) {
          // 1. Fetch post context from DB cache or Meta Graph API
          let postCaption = '';
          try {
            const { data: postCtx } = await supabase
              .from('post_contexts')
              .select('post_context_data')
              .eq('meta_post_id', postId)
              .maybeSingle();
            
            postCaption = postCtx?.post_context_data || '';
            
            if (!postCaption && postId) {
              try {
                postCaption = await fetchPostContext(pageConnection.access_token, postId, platform);
                // Cache post caption
                await supabase.from('post_contexts').upsert({
                  user_id: userId,
                  page_connection_id: pageConnection.page_id,
                  meta_post_id: postId,
                  post_context_data: postCaption,
                  updated_at: new Date().toISOString()
                });
              } catch (ctxErr: any) {
                console.warn(`[Comments Webhook] fetchPostContext failed: ${ctxErr.message}`);
              }
            }
          } catch (dbErr: any) {
            console.warn(`[Comments Webhook] Fetch post context DB check failed: ${dbErr.message}`);
          }

          // 2. Fetch User's Brand Voice Profile
          let brandVoice = 'Friendly and professional';
          try {
            const { data: userProfile } = await supabase
              .from('users')
              .select('brand_voice_profile')
              .eq('id', userId)
              .single();
            
            if (userProfile?.brand_voice_profile) {
              brandVoice = userProfile.brand_voice_profile;
            }
          } catch (voiceErr: any) {
            console.warn(`[Comments Webhook] Fetch user voice profile failed: ${voiceErr.message}`);
          }

          // 2b. Fetch active Quick Answers (knowledge fields)
          let quickAnswersText = '';
          try {
            const { data: rawFields } = await supabase
              .from('knowledge_fields')
              .select('field_name, field_value, category, page_id')
              .eq('user_id', userId)
              .eq('is_active', true)
              .or(`page_id.eq.${pageConnection.page_id},page_id.is.null`);

            if (rawFields && rawFields.length > 0) {
              // Deduplicate global fields if page-specific override is present
              const fieldMap = new Map<string, any>();
              for (const f of rawFields) {
                const existing = fieldMap.get(f.field_name);
                if (!existing || (f.page_id && !existing.page_id)) {
                  fieldMap.set(f.field_name, f);
                }
              }
              const dedupedFields = Array.from(fieldMap.values());
              quickAnswersText = '## Business Information / Facts:\n' +
                dedupedFields.map(f => `- **${f.field_name}:** ${f.field_value}`).join('\n') + '\n\n';
            }
          } catch (kfErr: any) {
            console.warn(`[Comments Webhook] Fetch knowledge fields failed: ${kfErr.message}`);
          }

          // 2c. Fetch RAG Context (Hybrid retrieval)
          let ragContextText = '';
          const isShortComment = messageText.trim().length < 15;
          if (!isShortComment) {
            try {
              // Resolve which folders are active (rule overrides or page defaults)
              let activeFolderIds: string[] = ruleResult.aiFolderOverrides || [];
              if (!ruleResult.aiFolderOverrides || ruleResult.aiFolderOverrides.length === 0) {
                const { data: assignments } = await supabase
                  .from('folder_page_assignments')
                  .select('folder_id')
                  .eq('page_id', pageConnection.page_id);
                if (assignments) {
                  activeFolderIds = assignments.map(a => a.folder_id);
                }
              }

              if (activeFolderIds.length > 0) {
                // Fetch document IDs in active folders
                const { data: folderDocs } = await supabase
                  .from('documents')
                  .select('id')
                  .in('folder_id', activeFolderIds);
                const activeDocIds = (folderDocs || []).map(d => d.id);

                if (activeDocIds.length > 0) {
                  const embeddingChain = await getEmbeddingProviderChain(supabase, userId, env.DB);
                  if (embeddingChain.length > 0) {
                    const ragResults = await searchDocuments(
                      supabase,
                      embeddingChain,
                      userId,
                      messageText.trim(),
                      null, // null queries all tenant chunks, then manually filter by folder doc IDs
                      0.0,
                      5
                    );

                    // Filter only results that belong to documents in active folders
                    const filteredRag = ragResults.filter(r => activeDocIds.includes(r.documentId));
                    if (filteredRag.length > 0) {
                      ragContextText = '## Additional Context (from business knowledge base):\n' +
                        filteredRag.slice(0, 3).map((r, i) => `[Fact ${i + 1}]\n${r.content}`).join('\n\n') + '\n\n';
                    }
                  }
                }
              }
            } catch (ragErr: any) {
              console.error(`[Comments Webhook] Hybrid RAG retrieval failed: ${ragErr.message}`);
            }
          }

          // 3. Call LLM to generate dynamic contextual response
          try {
            const chain = await getChatProviderChain(supabase, userId, env.DB);
            if (chain.length > 0) {
              const baseInstructions = ruleResult.aiCommentInstruction || 'Write a direct, engaging, helpful reply to this comment based on the post context, brand voice, and business facts.';
              const isDmHandshakeActive = actions.includes('dm') || actions.includes('like_and_dm');
              const dmInstruction = isDmHandshakeActive 
                ? `\n## DM Handshake Active\nA private DM has also been automatically sent to this user's inbox. You MUST explicitly mention in your reply that you've sent them a DM / message / inbox details, prompting them to check their messages.` 
                : '';
              
              const generationPrompt = `You are a social media assistant replying to comments on a post.
${baseInstructions}${dmInstruction}

Brand Voice Profile: ${brandVoice}

Post Context/Caption: "${postCaption || 'No caption available'}"

${quickAnswersText}${ragContextText}User Comment: "${messageText}"

## Strict Language Policy (Strict Mirroring)
Detect the language and script/style of the user comment (e.g. Bengali script, Banglish/Latin script, or English). You MUST reply in that EXACT same language and script/style. If the user comment is in Banglish (e.g., "koto", "daam"), reply in Banglish. NEVER reply in Bengali script to a Banglish query, and never reply in English to a Banglish query.

## Formatting Policy (Strict Plain Text)
Output your reply in STRICT PLAIN TEXT. Do NOT use markdown bold (**text**), headers (#), bullet lists (- item), or numbered lists. Output only 1-2 concise sentences directly addressing the comment. Do not mention you are an AI.`;

              const aiResponse = await callChatCompletionWithFailover(chain, [
                { role: 'user', content: generationPrompt }
              ], { temperature: 0.7 });

              const generatedText = aiResponse.choices?.[0]?.message?.content?.trim();
              if (generatedText) {
                console.log(`[Comments Webhook] Generated AI reply for comment ${commentId}: "${generatedText}"`);
                replyText = generatedText;

                // Log token burn to audit logs
                try {
                  const promptTokens = Math.ceil(generationPrompt.length / 4);
                  const completionTokens = Math.ceil(generatedText.length / 4);
                  const totalTokens = promptTokens + completionTokens;
                  
                  await supabase.from('audit_logs').insert({
                    user_id: userId,
                    action_type: 'dynamic_reply',
                    description: `Generated dynamic reply to comment ${commentId} on post ${postId}`,
                    tokens_burned: totalTokens,
                    token_type: 'text'
                  });
                } catch (logErr: any) {
                  console.warn(`[Comments Webhook] Failed to log dynamic reply token burn: ${logErr.message}`);
                }
              }
            }
          } catch (llmErr: any) {
            console.error(`[Comments Webhook] LLM reply generation failed: ${llmErr.message}`);
          }
        }

        if (ruleResult.attachmentUrls && ruleResult.attachmentUrls.length > 0) {
          replyText += '\n\nFiles:\n' + ruleResult.attachmentUrls.join('\n');
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
        let remainingAttachs: string[] = [];

        if (dmAttachs && dmAttachs.length > 0) {
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
            remainingAttachs = dmAttachs.slice(1);
          } else {
            remainingAttachs = dmAttachs;
          }
        }

        if (remainingAttachs.length > 0) {
          if (dmText) {
            dmText += '\n\nFiles:\n' + remainingAttachs.join('\n');
          } else {
            dmText = 'Files:\n' + remainingAttachs.join('\n');
          }
        }

        // Fallback default message if both dmText and primaryImageUrl are completely empty
        if (!dmText && !primaryImageUrl) {
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
              primaryImageUrl
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
          const fallbackCost = (typeof cost !== 'undefined') ? cost : 1;
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
