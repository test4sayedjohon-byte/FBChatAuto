// ============================================================================
// Rules Engine — Sentiment, Toxicity, and Keyword Evaluation
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCommentAnalysisProviderChain, getEmbeddingProviderChain } from '../ai/provider';
import { callChatCompletionWithFailover } from '../ai/client';
import { searchDocuments } from '../rag/pipeline';
import { fetchPostContext } from './meta-api';

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
  cost: number;
  generated_reply?: string;
}

function parseActions(actionStr: string): string[] {
  if (!actionStr) return [];
  if (actionStr === 'hide_and_reply') return ['hide', 'reply'];
  return actionStr.split(',').map(s => s.trim()).filter(Boolean);
}

async function checkInstagramFollower(senderId: string, accessToken: string): Promise<boolean> {
  try {
    const url = `https://graph.facebook.com/v25.0/${senderId}?fields=is_user_follow_business&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Rules Engine] Follower check failed for Instagram user ${senderId}: ${errText}`);
      return false;
    }
    const data = await res.json() as any;
    return !!data.is_user_follow_business;
  } catch (err: any) {
    console.error(`[Rules Engine] Error checking Instagram follower status: ${err.message}`);
    return false;
  }
}

export async function evaluateCommentRules(
  supabase: SupabaseClient,
  userId: string,
  pageId: string,
  commentText: string,
  postId: string,
  platform?: 'facebook' | 'instagram',
  mediaUrl?: string | null,
  db?: any,
  senderId?: string,
  accessToken?: string
): Promise<EvaluationResult> {
  // 1. Fetch active rules for this page connection
  const { data: rules, error } = await supabase
    .from('comment_rules')
    .select('*')
    .eq('user_id', userId)
    .or(`page_connection_id.eq.${pageId},page_connection_id.is.null`)
    .eq('is_active', true);

  if (error || !rules || rules.length === 0) {
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [], cost: 0 };
  }

  // Filter and prioritize post-specific rules first, then global rules
  const postSpecificRules = rules.filter(r => {
    if (!r.post_id || !postId) return false;
    return r.post_id.split('_').pop() === postId.split('_').pop();
  });
  const globalRules = rules.filter(r => !r.post_id);
  let sortedRules = [...postSpecificRules, ...globalRules];

  // 1.5 Fetch customer profile to evaluate intent targeting constraints
  let customerProfile: any = null;
  if (senderId && pageId) {
    try {
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('lead_score, intent_level')
        .eq('page_id', pageId)
        .eq('sender_id', senderId)
        .maybeSingle();
      customerProfile = profile;
    } catch (err: any) {
      console.warn(`[Rules Engine] Failed to load customer profile for targeting check: ${err.message}`);
    }
  }

  // Filter sortedRules by customer profile constraints
  sortedRules = sortedRules.filter(rule => {
    if (rule.min_lead_score !== undefined && rule.min_lead_score !== null) {
      const customerScore = customerProfile?.lead_score ?? 1; // Default to 1 if no profile
      if (customerScore < rule.min_lead_score) {
        console.log(`[Rules Engine] Excluding rule "${rule.id}" due to lead_score constraint: customer score ${customerScore} < min required ${rule.min_lead_score}`);
        return false;
      }
    }

    if (rule.intent_levels && Array.isArray(rule.intent_levels) && rule.intent_levels.length > 0) {
      const customerIntent = customerProfile?.intent_level || 'unknown';
      if (!rule.intent_levels.includes(customerIntent)) {
        console.log(`[Rules Engine] Excluding rule "${rule.id}" due to intent_level constraint: customer intent "${customerIntent}" not in allowed list [${rule.intent_levels.join(', ')}]`);
        return false;
      }
    }
    return true;
  });

  // 2. Load User Profile to check allow_comment_analysis and brand_voice_profile
  let allowCommentAnalysis = true;
  let brandVoice = 'Friendly and professional';
  try {
    const { data: userProfile } = await supabase
      .from('users')
      .select('allow_comment_analysis, brand_voice_profile, settings')
      .eq('id', userId)
      .single();
    
    if (userProfile) {
      let isUserDisabled = false;
      const settings = typeof userProfile.settings === 'string'
        ? JSON.parse(userProfile.settings)
        : userProfile.settings;
      if (settings && Array.isArray(settings.disabled_features)) {
        isUserDisabled = settings.disabled_features.includes('allow_comment_analysis');
      }
      
      allowCommentAnalysis = !!userProfile.allow_comment_analysis && !isUserDisabled;
      if (userProfile.brand_voice_profile) {
        brandVoice = userProfile.brand_voice_profile;
      }
    }
  } catch (voiceErr: any) {
    console.warn(`[Rules Engine] Fetch user profile failed: ${voiceErr.message}`);
  }

  // 3. Keyword matching check (pre-AI)
  const lowerText = commentText.toLowerCase();
  let matchedKeywordRule: any = null;
  for (const rule of sortedRules) {
    if (rule.trigger_type === 'keywords' && Array.isArray(rule.keywords) && rule.keywords.length > 0) {
      const isMatch = rule.keywords.some((kw: string) => lowerText.includes(kw.toLowerCase()));
      if (isMatch) {
        if (rule.must_be_follower && platform === 'instagram' && senderId && accessToken) {
          const isFollower = await checkInstagramFollower(senderId, accessToken);
          if (!isFollower) {
            console.log(`[Rules Engine] User ${senderId} is not a follower. Skipping rule ${rule.id}.`);
            continue;
          }
        }
        matchedKeywordRule = rule;
        break;
      }
    }
  }

  // If allow_comment_analysis is false, we can only run keyword rules.
  if (!allowCommentAnalysis) {
    if (matchedKeywordRule) {
      return {
        sentiment: 'neutral',
        toxicityScore: 0,
        confidence: 1.0,
        matchedRuleId: matchedKeywordRule.id,
        actions: parseActions(matchedKeywordRule.action_to_take),
        replyTemplate: (Array.isArray(matchedKeywordRule.reply_templates) && matchedKeywordRule.reply_templates.length > 0)
          ? matchedKeywordRule.reply_templates[Math.floor(Math.random() * matchedKeywordRule.reply_templates.length)]
          : undefined,
        dmReplyTemplate: (Array.isArray(matchedKeywordRule.dm_reply_templates) && matchedKeywordRule.dm_reply_templates.length > 0)
          ? matchedKeywordRule.dm_reply_templates[Math.floor(Math.random() * matchedKeywordRule.dm_reply_templates.length)]
          : undefined,
        dmFlowId: matchedKeywordRule.dm_flow_id || undefined,
        attachmentUrls: matchedKeywordRule.attachment_urls || undefined,
        dmAttachmentUrls: matchedKeywordRule.dm_attachment_urls || undefined,
        useDynamicAiReply: false,
        aiCommentInstruction: matchedKeywordRule.ai_comment_instruction || undefined,
        aiFolderOverrides: matchedKeywordRule.ai_folder_overrides || undefined,
        cost: 0,
      };
    }
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [], cost: 0 };
  }

  // If a keyword rule matches and does NOT require dynamic AI reply, we can skip AI classification and charge 0 credits.
  if (matchedKeywordRule && !matchedKeywordRule.use_dynamic_ai_reply) {
    return {
      sentiment: 'neutral',
      toxicityScore: 0,
      confidence: 1.0,
      matchedRuleId: matchedKeywordRule.id,
      actions: parseActions(matchedKeywordRule.action_to_take),
      replyTemplate: (Array.isArray(matchedKeywordRule.reply_templates) && matchedKeywordRule.reply_templates.length > 0)
        ? matchedKeywordRule.reply_templates[Math.floor(Math.random() * matchedKeywordRule.reply_templates.length)]
        : undefined,
      dmReplyTemplate: (Array.isArray(matchedKeywordRule.dm_reply_templates) && matchedKeywordRule.dm_reply_templates.length > 0)
        ? matchedKeywordRule.dm_reply_templates[Math.floor(Math.random() * matchedKeywordRule.dm_reply_templates.length)]
        : undefined,
      dmFlowId: matchedKeywordRule.dm_flow_id || undefined,
      attachmentUrls: matchedKeywordRule.attachment_urls || undefined,
      dmAttachmentUrls: matchedKeywordRule.dm_attachment_urls || undefined,
      useDynamicAiReply: false,
      aiCommentInstruction: matchedKeywordRule.ai_comment_instruction || undefined,
      aiFolderOverrides: matchedKeywordRule.ai_folder_overrides || undefined,
      cost: 0,
    };
  }

  // 4. AI Classifier check (either keyword rule with dynamic reply, or falling through to AI rules)
  const hasAIRules = sortedRules.some(r => r.trigger_type === 'all' || r.trigger_type === 'ai_sentiment' || r.trigger_type === 'ai_custom');
  
  // If we don't have AI rules AND we don't have a matched keyword rule requiring dynamic AI reply, we skip AI classification.
  if (!hasAIRules && (!matchedKeywordRule || !matchedKeywordRule.use_dynamic_ai_reply)) {
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [], cost: 0 };
  }

  // Retrieve Comment Analysis AI Provider chain
  const chain = await getCommentAnalysisProviderChain(supabase, userId, db);
  if (chain.length === 0) {
    console.warn('[Rules Engine] No AI providers configured. Skipping AI moderation.');
    // Fall back to keyword rule if matched, otherwise return neutral
    if (matchedKeywordRule) {
      return {
        sentiment: 'neutral',
        toxicityScore: 0,
        confidence: 1.0,
        matchedRuleId: matchedKeywordRule.id,
        actions: parseActions(matchedKeywordRule.action_to_take),
        replyTemplate: matchedKeywordRule.reply_templates?.[Math.floor(Math.random() * matchedKeywordRule.reply_templates.length)] || undefined,
        dmReplyTemplate: matchedKeywordRule.dm_reply_templates?.[Math.floor(Math.random() * matchedKeywordRule.dm_reply_templates.length)] || undefined,
        dmFlowId: matchedKeywordRule.dm_flow_id || undefined,
        cost: 0
      };
    }
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [], cost: 0 };
  }

  // A. Load Post Context
  let postCaption = '';
  if (postId) {
    try {
      const { data: postCtx } = await supabase
        .from('post_contexts')
        .select('post_context_data')
        .eq('meta_post_id', postId)
        .maybeSingle();
      
      postCaption = postCtx?.post_context_data || '';
      
      if (!postCaption) {
        const { data: pageConn } = await supabase
          .from('page_connections')
          .select('access_token')
          .eq('page_id', pageId)
          .eq('user_id', userId)
          .maybeSingle();
        
        const accessToken = pageConn?.access_token;
        if (accessToken) {
          try {
            postCaption = await fetchPostContext(accessToken, postId, platform || 'facebook');
            await supabase.from('post_contexts').upsert({
              user_id: userId,
              page_connection_id: pageId,
              meta_post_id: postId,
              post_context_data: postCaption,
              updated_at: new Date().toISOString()
            });
          } catch (ctxErr: any) {
            console.warn(`[Rules Engine] fetchPostContext failed: ${ctxErr.message}`);
          }
        }
      }
    } catch (dbErr: any) {
      console.warn(`[Rules Engine] Fetch post context DB check failed: ${dbErr.message}`);
    }
  }

  // B. Load Quick Answers (knowledge fields)
  let quickAnswersText = '';
  try {
    const { data: rawFields } = await supabase
      .from('knowledge_fields')
      .select('field_name, field_value, category, page_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`page_id.eq.${pageId},page_id.is.null`);

    if (rawFields && rawFields.length > 0) {
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
    console.warn(`[Rules Engine] Fetch knowledge fields failed: ${kfErr.message}`);
  }

  // C. Load Active Folders
  let activeFolderIds: string[] = [];
  try {
    const { data: assignments } = await supabase
      .from('folder_page_assignments')
      .select('folder_id')
      .eq('page_id', pageId);
    if (assignments) {
      activeFolderIds = assignments.map(a => a.folder_id);
    }
  } catch (err) {
    console.warn('[Rules Engine] Failed to fetch folder assignments:', err);
  }

  // D. Load RAG Facts
  let ragContextText = '';
  const isShortComment = commentText.trim().length < 15;
  if (!isShortComment && activeFolderIds.length > 0) {
    try {
      const { data: folderDocs } = await supabase
        .from('documents')
        .select('id')
        .in('folder_id', activeFolderIds);
      const activeDocIds = (folderDocs || []).map(d => d.id);

      if (activeDocIds.length > 0) {
        const embeddingChain = await getEmbeddingProviderChain(supabase, userId, db);
        if (embeddingChain.length > 0) {
          const ragResults = await searchDocuments(
            supabase,
            embeddingChain,
            userId,
            commentText.trim(),
            null,
            0.0,
            5
          );

          const filteredRag = ragResults.filter(r => activeDocIds.includes(r.documentId));
          if (filteredRag.length > 0) {
            ragContextText = '## Additional Context (from business knowledge base):\n' +
              filteredRag.slice(0, 3).map((r, i) => `[Fact ${i + 1}]\n${r.content}`).join('\n\n') + '\n\n';
          }
        }
      }
    } catch (ragErr: any) {
      console.error(`[Rules Engine] Hybrid RAG retrieval failed: ${ragErr.message}`);
    }
  }

  // E. Load Media Vault Aliases
  let mediaVaultText = '';
  if (activeFolderIds.length > 0) {
    try {
      const { data: folderMedia } = await supabase
        .from('media')
        .select('name, friendly_name, description, file_type')
        .eq('user_id', userId)
        .eq('use_in_comments', true)
        .in('folder_id', activeFolderIds);
      if (folderMedia && folderMedia.length > 0) {
        mediaVaultText = '## Available Media to Attach:\n' +
          'You have access to the following files/media that you can attach to the reply by appending `[AttachMedia: alias]` (replacing `alias` with the media name) at the very end of your reply. Only attach a file if it is directly relevant or requested.\n' +
          folderMedia.map(m => `- **Name:** \`${m.name}\` (Description: ${m.description || m.friendly_name}, Type: ${m.file_type})`).join('\n') + '\n\n';
      }
    } catch (mErr: any) {
      console.warn(`[Rules Engine] Fetch folder media failed: ${mErr.message}`);
    }
  }

  const customRules = sortedRules.filter(r => r.trigger_type === 'ai_custom' && r.ai_custom_criteria);
  let customRulesPrompt = '';
  if (customRules.length > 0) {
    customRulesPrompt = '\nHere are the custom rules to evaluate (determine if the comment matches the criteria):\n' +
      customRules.map(r => `[Rule ID: "${r.id}"] Criteria: "${r.ai_custom_criteria}"`).join('\n');
  }

  // Determine base instructions and DM handshake status
  const ruleInstructions = sortedRules
    .map(r => r.ai_comment_instruction)
    .filter(Boolean)
    .map((inst, idx) => `Instruction ${idx + 1}: ${inst}`)
    .join('\n');
  
  const baseInstructions = ruleInstructions
    ? `Follow these instructions if relevant:\n${ruleInstructions}\nOtherwise, write a direct, engaging, helpful reply to this comment based on the post context, brand voice, and business facts.`
    : 'Write a direct, engaging, helpful reply to this comment based on the post context, brand voice, and business facts.';

  const isDmHandshakeActive = sortedRules.some(r => {
    const actions = parseActions(r.action_to_take);
    return actions.includes('dm') || actions.includes('like_and_dm');
  });

  const dmInstruction = isDmHandshakeActive 
    ? `\n## DM Handshake Active\nA private DM may also be sent to this user's inbox. If so, you MUST explicitly mention in your reply that you've sent them a DM / message / inbox details, prompting them to check their messages.` 
    : '';

  const prompt = `You are a social media assistant analyzing a user comment and generating a reply.
Analyze this user comment: "${commentText}"

Return a JSON object containing:
- "sentiment": "positive", "negative", or "neutral"
- "toxicity_score": number between 0.0 and 1.0 (indicating level of aggression, profanity, or spam)
- "confidence_score": number between 0.0 and 1.0 (indicating confidence in this assessment)
- "custom_matches": a JSON object mapping each custom rule ID (key) to a boolean true/false (value) indicating whether the comment matches that specific rule's criteria.
- "generated_reply": a string containing the generated public response.

Here is the context to use to generate the "generated_reply":
Brand Voice Profile: ${brandVoice}

Post Context/Caption: "${postCaption || 'No caption available'}"

${quickAnswersText}${mediaVaultText}${ragContextText}

Instructions:
${baseInstructions}${dmInstruction}

## Strict Language Policy (Strict Mirroring)
Detect the language and script/style of the user comment (e.g. Bengali script, Banglish/Latin script, or English). You MUST reply in that EXACT same language and script/style. If the user comment is in Banglish (e.g., "koto", "daam"), reply in Banglish. NEVER reply in Bengali script to a Banglish query, and never reply in English to a Banglish query.

## Formatting Policy (Strict Plain Text)
Output the generated reply in STRICT PLAIN TEXT. Do NOT use markdown bold (**text**), headers (#), bullet lists (- item), or numbered lists. Output only 1-2 concise sentences directly addressing the comment. Do not mention you are an AI.

## Language & Phonetic Translation Rules for Classification:
1. The comment may be written in English, Bengali, or Romanized Bengali / Banglish (e.g., "kato", "koto", "kat", "daam koto" phonetic spelling for asking price/cost).
2. Carefully translate, interpret, and resolve any colloquial, phonetic, or Romanized multilingual expressions to their semantic meaning. If the semantic meaning matches the rule criteria, evaluate it as true.

${customRules.length > 0 ? `\n## Custom Rules for Classification:\n${customRulesPrompt}` : ''}

Ensure the response is STRICTLY a valid JSON object. Do not include markdown code block formatting.`;

  try {
    console.log(`[Rules Engine Debug] Prompt sent:\n${prompt}`);
    const aiResponse = await callChatCompletionWithFailover(chain, [
      { role: 'user', content: prompt }
    ], { temperature: 0.1 });

    const rawContent = aiResponse.choices?.[0]?.message?.content?.trim() || '{}';
    console.log(`[Rules Engine Debug] Raw response content: ${rawContent}`);
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    } else {
      jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    const result = JSON.parse(jsonStr);

    const sentiment = result.sentiment || 'neutral';
    const toxicityScore = result.toxicity_score || 0.0;
    const confidence = result.confidence_score || 1.0;
    const customMatches = result.custom_matches || {};
    const generatedReply = result.generated_reply || '';
    console.log(`[Rules Engine Debug] Parsed matches:`, customMatches);

    // Log token usage to audit_logs
    try {
      const promptTokens = aiResponse.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
      const completionTokens = aiResponse.usage?.completion_tokens ?? Math.ceil(rawContent.length / 4);
      const totalTokens = promptTokens + completionTokens;
      
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action_type: 'comment_analysis_and_reply',
        description: `Unified comment classification and reply on post ${postId || 'unknown'}`,
        tokens_burned: totalTokens,
        token_type: 'text'
      });
    } catch (logErr: any) {
      console.warn(`[Rules Engine] Failed to log unified reply token burn: ${logErr.message}`);
    }

    let matchedRule = matchedKeywordRule;
    if (!matchedRule) {
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
          if (rule.must_be_follower && platform === 'instagram' && senderId && accessToken) {
            const isFollower = await checkInstagramFollower(senderId, accessToken);
            if (!isFollower) {
              console.log(`[Rules Engine] User ${senderId} is not a follower. Skipping rule ${rule.id}.`);
              continue;
            }
          }
          matchedRule = rule;
          break;
        }
      }
    }

    // Cost calculation:
    // Keyword rule with static reply = 0 credits (handled early)
    // Keyword rule with dynamic reply = 1 credit (5 if mediaUrl)
    // AI classified rule with static/no reply = 1 credit
    // AI classified rule with dynamic reply = 2 credits (6 if mediaUrl)
    let cost = 1;
    if (matchedRule) {
      const isKeywordRule = matchedRule.trigger_type === 'keywords';
      const isDynamic = !!matchedRule.use_dynamic_ai_reply;
      if (isKeywordRule) {
        cost = isDynamic ? (mediaUrl ? 5 : 1) : 0;
      } else {
        cost = isDynamic ? (mediaUrl ? 6 : 2) : 1;
      }
    } else {
      cost = 1;
    }

    let matchedResult: any = null;
    if (matchedRule) {
      matchedResult = {
        sentiment,
        toxicityScore,
        confidence,
        matchedRuleId: matchedRule.id,
        actions: parseActions(matchedRule.action_to_take),
        replyTemplate: matchedRule.reply_templates?.[Math.floor(Math.random() * matchedRule.reply_templates.length)] || undefined,
        dmReplyTemplate: matchedRule.dm_reply_templates?.[Math.floor(Math.random() * matchedRule.dm_reply_templates.length)] || undefined,
        dmFlowId: matchedRule.dm_flow_id || undefined,
        attachmentUrls: matchedRule.attachment_urls || undefined,
        dmAttachmentUrls: matchedRule.dm_attachment_urls || undefined,
        useDynamicAiReply: !!matchedRule.use_dynamic_ai_reply,
        aiCommentInstruction: matchedRule.ai_comment_instruction || undefined,
        aiFolderOverrides: matchedRule.ai_folder_overrides || undefined,
      };
    }

    // Apply toxicity override to matched result or fallback
    if (toxicityScore > 0.6) {
      if (matchedResult) {
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
        return { ...matchedResult, cost, generated_reply: undefined };
      } else {
        return {
          sentiment,
          toxicityScore,
          confidence,
          actions: ['trash_queue'],
          cost: 1, // Override to static/no reply cost
        };
      }
    }

    if (matchedResult) {
      return {
        ...matchedResult,
        cost,
        generated_reply: generatedReply || undefined,
      };
    }

    return { sentiment, toxicityScore, confidence, actions: [], cost, generated_reply: generatedReply || undefined };
  } catch (err: any) {
    console.error('[Rules Engine] AI moderation analysis failed:', err.message);
    return { sentiment: 'neutral', toxicityScore: 0, confidence: 1.0, actions: [], cost: 0 };
  }
}
