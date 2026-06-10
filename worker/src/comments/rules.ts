// ============================================================================
// Rules Engine — Sentiment, Toxicity, and Keyword Evaluation
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getChatProviderChain } from '../ai/provider';
import { callChatCompletionWithFailover } from '../ai/client';

export interface EvaluationResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  toxicityScore: number;
  confidence: number;
  matchedRuleId?: string;
  actions: string[];
  replyTemplate?: string;
  dmReplyTemplate?: string;
  dmFlowId?: string;
  attachmentUrls?: string[];
  dmAttachmentUrls?: string[];
  useDynamicAiReply?: boolean;
  aiCommentInstruction?: string;
  aiFolderOverrides?: string[];
}

function parseActions(actionStr: string): string[] {
  if (!actionStr) return [];
  if (actionStr === 'hide_and_reply') return ['hide', 'reply'];
  return actionStr.split(',').map(s => s.trim()).filter(Boolean);
}

export async function evaluateCommentRules(
  supabase: SupabaseClient,
  userId: string,
  pageId: string,
  commentText: string,
  postId: string,
  db?: any
): Promise<EvaluationResult> {
  // 1. Fetch active rules for this page connection
  const { data: rules, error } = await supabase
    .from('comment_rules')
    .select('*')
    .eq('user_id', userId)
    .or(`page_connection_id.eq.${pageId},page_connection_id.is.null`)
    .eq('is_active', true);

  if (error || !rules || rules.length === 0) {
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [] };
  }

  // Filter and prioritize post-specific rules first, then global rules
  const postSpecificRules = rules.filter(r => {
    if (!r.post_id || !postId) return false;
    return r.post_id.split('_').pop() === postId.split('_').pop();
  });
  const globalRules = rules.filter(r => !r.post_id);
  const sortedRules = [...postSpecificRules, ...globalRules];

  // 2. Keyword matching check
  const lowerText = commentText.toLowerCase();
  for (const rule of sortedRules) {
    if (rule.trigger_type === 'keywords' && Array.isArray(rule.keywords) && rule.keywords.length > 0) {
      const isMatch = rule.keywords.some((kw: string) => lowerText.includes(kw.toLowerCase()));
      if (isMatch) {
        return {
          sentiment: 'neutral',
          toxicityScore: 0,
          confidence: 1.0,
          matchedRuleId: rule.id,
          actions: parseActions(rule.action_to_take),
          replyTemplate: (Array.isArray(rule.reply_templates) && rule.reply_templates.length > 0)
            ? rule.reply_templates[Math.floor(Math.random() * rule.reply_templates.length)]
            : undefined,
          dmReplyTemplate: (Array.isArray(rule.dm_reply_templates) && rule.dm_reply_templates.length > 0)
            ? rule.dm_reply_templates[Math.floor(Math.random() * rule.dm_reply_templates.length)]
            : undefined,
          dmFlowId: rule.dm_flow_id || undefined,
          attachmentUrls: rule.attachment_urls || undefined,
          dmAttachmentUrls: rule.dm_attachment_urls || undefined,
          useDynamicAiReply: !!rule.use_dynamic_ai_reply,
          aiCommentInstruction: rule.ai_comment_instruction || undefined,
          aiFolderOverrides: rule.ai_folder_overrides || undefined,
        };
      }
    }
  }

  // 3. AI Classifier check (if there is an 'all', 'ai_sentiment', or 'ai_custom' rule)
  const hasAIRules = sortedRules.some(r => r.trigger_type === 'all' || r.trigger_type === 'ai_sentiment' || r.trigger_type === 'ai_custom');
  if (!hasAIRules) {
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [] };
  }

  // Retrieve AI Provider chain
  const chain = await getChatProviderChain(supabase, userId, db);
  if (chain.length === 0) {
    console.warn('[Rules Engine] No AI providers configured. Skipping AI moderation.');
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [] };
  }

  const customRules = sortedRules.filter(r => r.trigger_type === 'ai_custom' && r.ai_custom_criteria);
  let customRulesPrompt = '';
  if (customRules.length > 0) {
    customRulesPrompt = '\nHere are the custom rules to evaluate (determine if the comment matches the criteria):\n' +
      customRules.map(r => `[Rule ID: "${r.id}"] Criteria: "${r.ai_custom_criteria}"`).join('\n');
  }

  const prompt = `Analyze this social media comment: "${commentText}"
Return a JSON object containing:
- "sentiment": "positive", "negative", or "neutral"
- "toxicity_score": number between 0.0 and 1.0 (indicating level of aggression, profanity, or spam)
- "confidence_score": number between 0.0 and 1.0 (indicating confidence in this assessment)
${customRules.length > 0 ? `- "custom_matches": a JSON object mapping each custom rule ID (key) to a boolean true/false (value) indicating whether the comment matches that specific rule's criteria.` : ''}
${customRulesPrompt}

Language & Phonetic Translation Rules:
1. The comment may be written in English, Bengali, or Romanized Bengali / Banglish (e.g., "kato", "koto", "kat", "daam koto" phonetic spelling for asking price/cost).
2. Carefully translate, interpret, and resolve any colloquial, phonetic, or Romanized multilingual expressions to their semantic meaning. If the semantic meaning matches the rule criteria, evaluate it as true.

Ensure the response is STRICTLY a valid JSON object. Do not include markdown code block formatting.`;

  try {
    console.log(`[Rules Engine Debug] Prompt sent:\n${prompt}`);
    const aiResponse = await callChatCompletionWithFailover(chain, [
      { role: 'user', content: prompt }
    ], { temperature: 0.1 });

    const rawContent = aiResponse.choices?.[0]?.message?.content?.trim() || '{}';
    console.log(`[Rules Engine Debug] Raw response content: ${rawContent}`);
    const jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    const sentiment = result.sentiment || 'neutral';
    const toxicityScore = result.toxicity_score || 0.0;
    const confidence = result.confidence_score || 1.0;
    const customMatches = result.custom_matches || {};
    console.log(`[Rules Engine Debug] Parsed matches:`, customMatches);

    let matchedResult: any = null;

    // Evaluate rules against AI metrics
    for (const rule of sortedRules) {
      let isMatch = false;
      if (rule.trigger_type === 'ai_custom' && customMatches[rule.id] === true) {
        isMatch = true;
      } else if (rule.trigger_type === 'ai_sentiment' && rule.sentiment_target === sentiment) {
        isMatch = true;
      } else if (rule.trigger_type === 'all') {
        isMatch = true;
      }

      if (isMatch) {
        matchedResult = {
          sentiment,
          toxicityScore,
          confidence,
          matchedRuleId: rule.id,
          actions: parseActions(rule.action_to_take),
          replyTemplate: rule.reply_templates?.[Math.floor(Math.random() * rule.reply_templates.length)] || undefined,
          dmReplyTemplate: rule.dm_reply_templates?.[Math.floor(Math.random() * rule.dm_reply_templates.length)] || undefined,
          dmFlowId: rule.dm_flow_id || undefined,
          attachmentUrls: rule.attachment_urls || undefined,
          dmAttachmentUrls: rule.dm_attachment_urls || undefined,
          useDynamicAiReply: !!rule.use_dynamic_ai_reply,
          aiCommentInstruction: rule.ai_comment_instruction || undefined,
          aiFolderOverrides: rule.ai_folder_overrides || undefined,
        };
        break;
      }
    }

    // Apply toxicity override to matched result or fallback
    if (toxicityScore > 0.6) {
      if (matchedResult) {
        // If matched rule already hides, deletes, blocks, or trashes, keep it!
        const hasDestructiveAction = matchedResult.actions.some((a: string) => 
          ['hide', 'delete', 'block', 'trash_queue'].includes(a)
        );
        if (!hasDestructiveAction) {
          matchedResult.actions = ['trash_queue'];
          matchedResult.replyTemplate = undefined;
          matchedResult.dmReplyTemplate = undefined;
          matchedResult.dmFlowId = undefined;
          matchedResult.useDynamicAiReply = false;
        }
        return matchedResult;
      } else {
        return {
          sentiment,
          toxicityScore,
          confidence,
          actions: ['trash_queue'],
        };
      }
    }

    if (matchedResult) {
      return matchedResult;
    }

    return { sentiment, toxicityScore, confidence, actions: [] };
  } catch (err: any) {
    console.error('[Rules Engine] AI moderation analysis failed:', err.message);
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [] };
  }
}
