// ============================================================================
// AutometaBot — Chat Keyword Rules Evaluation & Execution Engine
// ============================================================================

import type { D1Database } from '@cloudflare/workers-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection } from '../types';
import { getChatRulesFallback, logRuleMatchFallback, storeAssistantMessageFallback } from '../db';
import { sendFacebookReply, sendFacebookAttachment } from '../facebook';
import { sendWhatsAppReply } from '../whatsapp';
import { startFlow } from './flow-engine';

export interface KeywordRuleResult {
  matched: boolean;
  isAiPush?: boolean;
  aiPromptDirective?: string;
}

/**
 * Normalizes incoming message text and matches it against active rules.
 * If matched, executes the rule response (or registers AI prompt push) and updates counts/logs.
 * Returns KeywordRuleResult detailing whether to bypass the AI chatbot.
 */
export async function processChatKeywordRules(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  pageConnection: PageConnection,
  senderId: string,
  messageText: string,
  platform: 'facebook' | 'whatsapp'
): Promise<KeywordRuleResult> {
  const activeRules = await getChatRulesFallback(db, supabase, pageConnection.page_id);
  if (!activeRules || activeRules.length === 0) return { matched: false };

  const rawClean = messageText.trim();
  // Strip common punctuation for fuzzy/contains check
  const lowerClean = rawClean.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");

  let matchedRule: any = null;
  let matchedKeyword: string = "";

  for (const rule of activeRules) {
    const matchType = rule.match_type || 'contains';
    const caseSensitive = !!rule.case_sensitive;
    const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];

    for (const kw of keywords) {
      const kwStr = (kw || "").trim();
      if (!kwStr) continue;

      const checkIncoming = caseSensitive ? rawClean : lowerClean;
      const checkKw = caseSensitive ? kwStr : kwStr.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");

      if (matchType === 'exact') {
        if (checkIncoming === checkKw) {
          matchedRule = rule;
          matchedKeyword = kwStr;
          break;
        }
      } else { // contains
        if (checkIncoming.includes(checkKw)) {
          matchedRule = rule;
          matchedKeyword = kwStr;
          break;
        }
      }
    }
    if (matchedRule) break;
  }

  if (!matchedRule) return { matched: false };

  console.log(`[Keyword Rules] Rule matched: "${matchedRule.name}" triggered by "${matchedKeyword}" on ${platform}`);

  // Loop protection: Check recent log matches for this session
  let recentMatchesCount = 0;
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const checkRes = await db.prepare(
      `SELECT COUNT(*) as count FROM chat_rule_logs WHERE session_id = ? AND rule_id = ? AND created_at >= ?`
    )
      .bind(sessionId, matchedRule.id, oneMinuteAgo)
      .first<{ count: number }>();
    recentMatchesCount = checkRes?.count || 0;
  } catch (err: any) {
    console.warn(`[Loop Protection] Error querying logs: ${err.message}`);
  }

  if (recentMatchesCount >= 3) {
    console.warn(`[Keyword Rules] 🛑 Loop protection triggered for session ${sessionId} on rule "${matchedRule.name}". Skipping reply.`);
    return { matched: true }; // Match was found and handled (skipped due to rate limit)
  }

  let actionTaken = "";

  // 1. AI Push Logic: Pass dynamic prompt to the main chatbot pipeline
  if (matchedRule.action_type === 'ai_push') {
    actionTaken = `AI Push: ${matchedRule.ai_prompt_directive || 'Default AI directive'}`;
    
    // Log match details
    await logRuleMatchFallback(db, supabase, {
      rule_id: matchedRule.id,
      session_id: sessionId,
      matched_keyword: matchedKeyword,
      incoming_message: messageText,
      action_taken: actionTaken
    });

    return {
      matched: true,
      isAiPush: true,
      aiPromptDirective: matchedRule.ai_prompt_directive
    };
  }

  // 2. Plain Text Auto-Replies (Bypasses AI)
  if (matchedRule.action_type === 'text') {
    const templates = Array.isArray(matchedRule.reply_templates) ? matchedRule.reply_templates : [];
    const replyMode = matchedRule.reply_mode || 'random';

    if (replyMode === 'all' && templates.length > 0) {
      const sentTexts: string[] = [];
      for (let i = 0; i < templates.length; i++) {
        const replyText = templates[i];
        if (!replyText || !replyText.trim()) continue;

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        if (platform === 'whatsapp') {
          await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, senderId, replyText);
        } else {
          await sendFacebookReply(pageConnection.access_token, senderId, replyText, pageConnection.page_id);
        }

        await storeAssistantMessageFallback(
          db,
          supabase,
          sessionId,
          pageConnection.user_id,
          replyText,
          null,
          { is_keyword_rule: true, rule_id: matchedRule.id, matched_keyword: matchedKeyword, segment_index: i }
        );
        sentTexts.push(replyText);
      }
      actionTaken = `Sent text series (${sentTexts.length}): ${sentTexts.join(' | ')}`;
    } else {
      const replyText = templates.length > 0 
        ? templates[Math.floor(Math.random() * templates.length)] 
        : "I've matched your request!";

      actionTaken = `Sent text: ${replyText}`;

      if (platform === 'whatsapp') {
        await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, senderId, replyText);
      } else {
        await sendFacebookReply(pageConnection.access_token, senderId, replyText, pageConnection.page_id);
      }

      await storeAssistantMessageFallback(
        db,
        supabase,
        sessionId,
        pageConnection.user_id,
        replyText,
        null,
        { is_keyword_rule: true, rule_id: matchedRule.id, matched_keyword: matchedKeyword }
      );
    }
  } 
  // 3. Media & Text series (Bypasses AI)
  else if (matchedRule.action_type === 'media') {
    let mediaUrl = "";
    let mediaType: 'image' | 'video' | 'audio' | 'file' = 'image';
    if (matchedRule.media_id) {
      try {
        const { data: mAsset } = await supabase.from('media').select('file_url, file_type').eq('id', matchedRule.media_id).maybeSingle();
        if (mAsset) {
          mediaUrl = mAsset.file_url;
          const fType = mAsset.file_type;
          if (fType === 'image' || fType === 'video' || fType === 'audio' || fType === 'file') {
            mediaType = fType;
          }
        }
      } catch (_) {}
    }

    // Step A: Send Text Before Media (if configured)
    const textBefore = (Array.isArray(matchedRule.reply_templates) && matchedRule.reply_templates.length > 0)
      ? matchedRule.reply_templates[0]
      : '';
    if (textBefore) {
      if (platform === 'whatsapp') {
        await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, senderId, textBefore);
      } else {
        await sendFacebookReply(pageConnection.access_token, senderId, textBefore, pageConnection.page_id);
      }
      await storeAssistantMessageFallback(
        db,
        supabase,
        sessionId,
        pageConnection.user_id,
        textBefore,
        null,
        { is_keyword_rule: true, rule_id: matchedRule.id, matched_keyword: matchedKeyword, segment: 'text_before' }
      );
    }

    // Step B: Send Media Attachment
    if (mediaUrl) {
      actionTaken = `Sent media: ${mediaUrl} (${mediaType})`;
      if (platform === 'whatsapp') {
        await sendWhatsAppReply(
          pageConnection.whatsapp_phone_number_id!,
          pageConnection.access_token,
          senderId,
          `Attachment: ${mediaUrl}`
        );
      } else {
        await sendFacebookAttachment(
          pageConnection.access_token,
          { id: senderId },
          mediaType,
          mediaUrl,
          undefined,
          pageConnection.page_id
        );
      }

      await storeAssistantMessageFallback(
        db,
        supabase,
        sessionId,
        pageConnection.user_id,
        `[Sent Media Attachment: ${mediaUrl}]`,
        null,
        { is_keyword_rule: true, rule_id: matchedRule.id, matched_keyword: matchedKeyword, media_url: mediaUrl, segment: 'media' }
      );
    } else {
      actionTaken = "Failed to send media (media asset not found)";
    }

    // Step C: Send Text After Media (if configured)
    const textAfter = matchedRule.reply_text_after || '';
    if (textAfter) {
      if (platform === 'whatsapp') {
        await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, senderId, textAfter);
      } else {
        await sendFacebookReply(pageConnection.access_token, senderId, textAfter, pageConnection.page_id);
      }
      await storeAssistantMessageFallback(
        db,
        supabase,
        sessionId,
        pageConnection.user_id,
        textAfter,
        null,
        { is_keyword_rule: true, rule_id: matchedRule.id, matched_keyword: matchedKeyword, segment: 'text_after' }
      );
    }

  } 
  // 4. Trigger visual flow (Bypasses AI)
  else if (matchedRule.action_type === 'flow' && matchedRule.dm_flow_id) {
    actionTaken = `Started flow: ${matchedRule.dm_flow_id}`;
    await startFlow(db, supabase, sessionId, matchedRule.dm_flow_id, pageConnection, senderId);
  }

  // Log match details
  await logRuleMatchFallback(db, supabase, {
    rule_id: matchedRule.id,
    session_id: sessionId,
    matched_keyword: matchedKeyword,
    incoming_message: messageText,
    action_taken: actionTaken
  });

  return { matched: true };
}
