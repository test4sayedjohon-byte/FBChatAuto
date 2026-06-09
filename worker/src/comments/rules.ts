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
  action: 'reply' | 'hide' | 'trash_queue' | 'hide_and_reply' | 'dm' | 'none';
  replyTemplate?: string;
  dmFlowId?: string;
}

export async function evaluateCommentRules(
  supabase: SupabaseClient,
  userId: string,
  pageId: string,
  commentText: string,
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
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, action: 'none' };
  }

  // 2. Keyword matching check
  const lowerText = commentText.toLowerCase();
  for (const rule of rules) {
    if (rule.trigger_type === 'keywords' && rule.keywords && rule.keywords.length > 0) {
      const isMatch = rule.keywords.some((kw: string) => lowerText.includes(kw.toLowerCase()));
      if (isMatch) {
        return {
          sentiment: 'neutral',
          toxicityScore: 0,
          confidence: 1.0,
          matchedRuleId: rule.id,
          action: rule.action_to_take as any,
          replyTemplate: rule.reply_templates?.[Math.floor(Math.random() * rule.reply_templates.length)] || undefined,
          dmFlowId: rule.dm_flow_id || undefined,
        };
      }
    }
  }

  // 3. AI Classifier check (if there is an 'all' or 'ai_sentiment' rule)
  const hasAIRules = rules.some(r => r.trigger_type === 'all' || r.trigger_type === 'ai_sentiment');
  if (!hasAIRules) {
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, action: 'none' };
  }

  // Retrieve AI Provider chain
  const chain = await getChatProviderChain(supabase, userId, db);
  if (chain.length === 0) {
    console.warn('[Rules Engine] No AI providers configured. Skipping AI moderation.');
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, action: 'none' };
  }

  const prompt = `Analyze this social media comment: "${commentText}"
Return a JSON object containing:
- "sentiment": "positive", "negative", or "neutral"
- "toxicity_score": number between 0.0 and 1.0 (indicating level of aggression, profanity, or spam)
- "confidence_score": number between 0.0 and 1.0 (indicating confidence in this assessment)

Ensure the response is STRICTLY a valid JSON object. Do not include markdown code block formatting.`;

  try {
    const aiResponse = await callChatCompletionWithFailover(chain, [
      { role: 'user', content: prompt }
    ], { temperature: 0.1 });

    const rawContent = aiResponse.choices?.[0]?.message?.content?.trim() || '{}';
    const jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    const sentiment = result.sentiment || 'neutral';
    const toxicityScore = result.toxicity_score || 0.0;
    const confidence = result.confidence_score || 1.0;

    // Toxicity overrides: if toxicity is high (> 0.6), auto-route to trash_queue for moderation
    if (toxicityScore > 0.6) {
      return {
        sentiment,
        toxicityScore,
        confidence,
        action: 'trash_queue',
      };
    }

    // Evaluate rules against AI metrics
    for (const rule of rules) {
      if (rule.trigger_type === 'ai_sentiment' && rule.sentiment_target === sentiment) {
        return {
          sentiment,
          toxicityScore,
          confidence,
          matchedRuleId: rule.id,
          action: rule.action_to_take as any,
          replyTemplate: rule.reply_templates?.[Math.floor(Math.random() * rule.reply_templates.length)] || undefined,
          dmFlowId: rule.dm_flow_id || undefined,
        };
      }
      if (rule.trigger_type === 'all') {
        return {
          sentiment,
          toxicityScore,
          confidence,
          matchedRuleId: rule.id,
          action: rule.action_to_take as any,
          replyTemplate: rule.reply_templates?.[Math.floor(Math.random() * rule.reply_templates.length)] || undefined,
          dmFlowId: rule.dm_flow_id || undefined,
        };
      }
    }

    return { sentiment, toxicityScore, confidence, action: 'none' };
  } catch (err: any) {
    console.error('[Rules Engine] AI moderation analysis failed:', err.message);
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, action: 'none' };
  }
}
