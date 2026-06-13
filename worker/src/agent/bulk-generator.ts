import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv } from '../types';
import type { ChatMessage, AIProviderConfig } from '../ai/types';
import { callChatCompletionWithFailover } from '../ai/client';
import { getAgentProviderChain, getEmbeddingProviderChain, getImageProviderChain, getContentProviderChain } from '../ai/provider';
import { searchDocuments } from '../rag';
import { verifyAndDeductCredits, refundUserCredits } from '../credits';

// Import our modular helpers
import { getRecentMemoryContext, saveContentMemory } from './content-memory';
import { enhanceImagePrompt } from './prompt-enhancer';
import { compressBrandVoice, compressQaContext, compressRagDocs } from './context-compressor';
import { generateBatchContent } from './batch-generator';

export interface BulkGeneratorOptions {
  preset?: 'thematic' | 'daily_consistency' | 'sequential_story' | 'product_showcase';
  productIds?: string[];
  mediaType?: 'text' | 'catalog' | 'ai';
  imageModel?: string;
  aestheticTheme?: string;
  enableMiddleAi?: boolean;
  addFirstComment?: boolean;
  publishStatus?: 'draft' | 'scheduled';
  themeText?: string;
  postsPerDay?: number;
  postTimes?: string[];
}

export async function generateBulkContent(
  supabase: SupabaseClient,
  userId: string,
  pageConnectionId: string,
  count: number,
  generateImages: boolean,
  startDateStr: string,
  frequency: 'daily' | 'every_other_day' | 'weekly' | 'monthly',
  env: AppEnv['Bindings'],
  options: BulkGeneratorOptions = {},
  db?: any
): Promise<{ success: boolean; message: string; posts?: any[] }> {
  const mediaType = options.mediaType || (generateImages ? 'ai' : 'text');
  const isAiImage = mediaType === 'ai';
  const costPerPost = isAiImage ? 40 : 10;
  const totalCost = count * costPerPost;

  try {
    const preset = options.preset || 'daily_consistency';
    const isCatalogImage = mediaType === 'catalog';
    const publishStatus = options.publishStatus || 'draft';

    const creditRes = await verifyAndDeductCredits(supabase, userId, totalCost);
    if (!creditRes.success) {
      return {
        success: false,
        message: `Insufficient credits. This operation requires ${totalCost} credits, but your workspace has reached its limit. Please upgrade or gift credits.`
      };
    }

    // 2. Fetch page connection
    const { data: pageConn, error: pageErr } = await supabase
      .from('page_connections')
      .select('page_id, page_name, platform')
      .eq('page_id', pageConnectionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (pageErr || !pageConn) {
      return { success: false, message: 'Connected channel not found or unauthorized.' };
    }

    // 3. Fetch active system templates
    const { data: templates, error: tempErr } = await supabase
      .from('system_content_prompts')
      .select('*')
      .eq('is_active', true)
      .order('sequence_order', { ascending: true });

    if (tempErr || !templates || templates.length === 0) {
      return { success: false, message: 'No active system content templates found. Please contact an administrator.' };
    }

    // 3.5 Fetch global system prompts
    const { data: globalPromptsArray } = await supabase
      .from('global_system_prompts')
      .select('*');

    const globalPrompts = (globalPromptsArray || []).reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.prompt_text;
      return acc;
    }, {});

    // 4. Fetch user brand voice profile
    const { data: userProfile, error: profileErr } = await supabase
      .from('users')
      .select('brand_voice_profile, image_model')
      .eq('id', userId)
      .single();

    if (profileErr || !userProfile) {
      return { success: false, message: 'User profile not found.' };
    }

    // 5. Gather business facts / knowledge base context (RAG)
    let relevantDocs = '';
    const embedChain = await getEmbeddingProviderChain(supabase, userId, db);
    if (embedChain && embedChain.length > 0) {
      try {
        const ragResults = await searchDocuments(
          supabase,
          embedChain,
          userId,
          'general content strategy marketing product overview',
          null,
          0.3,
          8
        );
        if (ragResults && ragResults.length > 0) {
          relevantDocs = ragResults.map(r => r.content).join('\n\n');
        }
      } catch (err) {
        console.error('[Bulk Generator] RAG search error:', err);
      }
    }

    if (!relevantDocs) {
      const { data: docs } = await supabase
        .from('documents')
        .select('original_content')
        .eq('user_id', userId)
        .limit(5);
      if (docs && docs.length > 0) {
        relevantDocs = docs.map(d => d.original_content).join('\n\n');
      }
    }

    // Fetch quick answers
    const { data: qas } = await supabase
      .from('knowledge_fields')
      .select('field_name, field_value')
      .eq('user_id', userId)
      .limit(15);
    const qaContext = qas ? qas.map(q => `${q.field_name}: ${q.field_value}`).join('\n') : '';

    // Fetch selected products if Showcase or Catalog is selected
    let selectedProducts: any[] = [];
    if (preset === 'product_showcase' || isCatalogImage) {
      let query = supabase.from('products').select('*').eq('is_active', true);
      if (options.productIds && options.productIds.length > 0) {
        query = query.in('id', options.productIds);
      }
      const { data: prods } = await query.limit(20);
      if (prods && prods.length > 0) {
        selectedProducts = prods;
      }
    }

    // Fetch AI Content Memory context (Token Efficient Deduplication)
    const { memoryContext } = await getRecentMemoryContext(supabase, userId);

    // 6. Get AI provider for generating content
    let providerChain: AIProviderConfig[] = [];
    providerChain = await getContentProviderChain(supabase, userId, db);

    if (providerChain.length === 0) {
      if (env.AGENT_API_KEY && env.AGENT_MODEL) {
        const isOpenRouter = env.AGENT_MODEL.includes('/');
        providerChain = [{
          id: 'agent_override',
          userId: 'global',
          providerName: isOpenRouter ? 'openrouter' : 'openai',
          displayName: 'Super Admin Agent (Env)',
          baseUrl: isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1',
          apiKey: env.AGENT_API_KEY,
          modelChat: env.AGENT_MODEL,
          modelEmbedding: '',
          maxTokens: 2048,
          temperature: 0.7,
          contextWindow: 15,
          extraHeaders: isOpenRouter ? { 'HTTP-Referer': 'https://autometabot.com', 'X-Title': 'AutometaBot' } : {}
        }];
      } else {
        providerChain = await getAgentProviderChain(supabase, userId, db);
      }
    }

    if (providerChain.length === 0) {
      return { success: false, message: 'No active chat AI provider configured for generating content.' };
    }

    // 7. Resolve image provider if checked
    let activeImageProvider: any = null;
    let imageModel = options.imageModel || userProfile.image_model || 'flux';
    if (isAiImage) {
      const imageChain = await getImageProviderChain(supabase, userId, db);
      activeImageProvider = imageChain[0];
      if (!activeImageProvider) {
        console.warn('[Bulk Generator] Image generation requested, but no active image provider configured. Skipping images.');
      }
    }

    // 8. Generator Loop
    const batchId = crypto.randomUUID ? crypto.randomUUID() : `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const generatedPosts: any[] = [];
    const baseDate = new Date(startDateStr);
    
    // Map frequency to ms offsets
    const offsets = {
      daily: 24 * 60 * 60 * 1000,
      every_other_day: 48 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000
    };
    let spacingMs = offsets[frequency] || offsets.daily;
    if (frequency === 'daily' && options.postsPerDay && options.postsPerDay > 1) {
      spacingMs = Math.round((24 / options.postsPerDay) * 60 * 60 * 1000);
    }

    // A. Build templates list
    const templatesToGenerate: any[] = [];
    for (let i = 0; i < count; i++) {
      templatesToGenerate.push(templates[i % templates.length]);
    }

    // B. Compress contexts
    const brandVoice = compressBrandVoice(userProfile.brand_voice_profile);
    const compressedRag = compressRagDocs(relevantDocs);
    const compressedQa = compressQaContext(qas);

    // C. Call batch content generation
    const payloads = await generateBatchContent(providerChain, {
      preset,
      brandVoice,
      compressedRagDocs: compressedRag,
      compressedQa,
      memoryContext,
      templates: templatesToGenerate,
      addFirstComment: !!options.addFirstComment,
      themeText: options.themeText,
      selectedProducts,
      globalPrompts
    });

    // Log batch content generation to audit logs
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action_type: 'generate_ideas',
        description: `Batch generated ${payloads.length} posts using token-efficient content generator.`,
        tokens_burned: payloads.length * 350,
        token_type: 'text'
      });
    } catch (e) {
      console.error('[Bulk Generator] Failed to log batch audit log:', e);
    }

    // D. Process generated post payloads
    for (let i = 0; i < payloads.length; i++) {
      const parsedOutput = payloads[i];
      const template = templatesToGenerate[i];
      let scheduledTime: Date;
      if (frequency === 'daily' && options.postTimes && options.postTimes.length > 0) {
        const postsPerDay = options.postsPerDay || 1;
        const dayIndex = Math.floor(i / postsPerDay);
        const timeIndex = i % postsPerDay;
        const timeStr = options.postTimes[timeIndex] || '09:00';
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        scheduledTime = new Date(baseDate);
        scheduledTime.setDate(baseDate.getDate() + dayIndex);
        scheduledTime.setHours(hours, minutes, 0, 0);
      } else {
        scheduledTime = new Date(baseDate.getTime() + i * spacingMs);
      }
      const currentProduct = selectedProducts.length > 0 ? selectedProducts[i % selectedProducts.length] : null;

      // Handle comments
      const postComments = (options.addFirstComment && parsedOutput.first_comments) ? parsedOutput.first_comments : [];

      // Determine Image Attachment URL
      let imageUrls: string[] | null = null;

      if (isCatalogImage && currentProduct && currentProduct.image_url) {
        // Use Catalog Image directly (Saves 30 credits!)
        imageUrls = [currentProduct.image_url];
      } else if (isAiImage && activeImageProvider) {
        // Generate Image via AI
        try {
          let enhancedPrompt = parsedOutput.image_prompt;
          
          // Apply Middle AI Prompt Enhancer if enabled
          if (options.enableMiddleAi) {
            enhancedPrompt = await enhanceImagePrompt(providerChain, {
              rawImagePrompt: parsedOutput.image_prompt,
              aestheticTheme: options.aestheticTheme || 'Modern Minimalist',
              imageModel
            });
          }

          let productIntegrationText = '';
          if (currentProduct && globalPrompts['product_integration_prompt']) {
             productIntegrationText = globalPrompts['product_integration_prompt'].replace('{{product_name}}', currentProduct.name);
             productIntegrationText = ` ${productIntegrationText}`;
          }

          const imgPrompt = `${enhancedPrompt}. ${template.image_prompt_text || ''}${productIntegrationText}`.substring(0, 950);
          const imageRes = await fetch(`${activeImageProvider.baseUrl}/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeImageProvider.apiKey}`,
              ...activeImageProvider.extraHeaders
            },
            body: JSON.stringify({
              prompt: imgPrompt,
              n: 1,
              size: '1024x1024',
              model: imageModel
            }),
            signal: AbortSignal.timeout(60_000)
          });

          if (imageRes.ok) {
            const imageJson = await imageRes.json() as any;
            const generatedUrl = imageJson.data?.[0]?.url || null;
            if (generatedUrl) {
              imageUrls = [generatedUrl];
              await supabase.from('audit_logs').insert({
                user_id: userId,
                action_type: 'generate_image',
                description: `Generated image for bulk post ${i + 1} using model ${imageModel}.`,
                tokens_burned: 1,
                token_type: 'image_gen'
              });
            }
          } else {
            console.error('[Bulk Generator] Image provider error status:', imageRes.status, await imageRes.text());
          }
        } catch (imgErr) {
          console.error('[Bulk Generator] Image generation exception:', imgErr);
        }
      }

      // Insert post into scheduled_posts
      const platformToUse = pageConn.platform || 'facebook';
      const { data: postData, error: postInsertErr } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          page_connection_id: pageConn.page_id,
          platform: platformToUse,
          post_type: imageUrls ? 'photo' : 'text',
          message: parsedOutput.caption,
          media_urls: imageUrls,
          scheduled_time: scheduledTime.toISOString(),
          status: publishStatus === 'scheduled' ? 'scheduled' : 'scheduled', // internally schedules post
          media_source_type: isCatalogImage ? 'catalog' : (imageUrls ? 'ai_generated' : 'manual'),
          approval_status: publishStatus, // 'draft' or 'scheduled' (approved)
          first_comments: postComments,
          ai_generated_options: {
            batch_id: batchId,
            sequence_index: i,
            total_in_batch: count,
            template_title: template.title
          }
        })
        .select('*')
        .single();

      if (postInsertErr) {
        console.error('[Bulk Generator] Post insertion failed:', postInsertErr);
      } else if (postData) {
        generatedPosts.push({
          id: postData.id,
          caption: parsedOutput.caption,
          templateTitle: template.title,
          scheduledTime: scheduledTime.toISOString(),
          imageUrl: imageUrls?.[0] || null
        });

        // Save new post to AI memory (Preventing duplicates in next batch run)
        await saveContentMemory(supabase, userId, batchId, postData.id, {
          theme: parsedOutput.theme,
          summary: parsedOutput.summary,
          keywords: parsedOutput.keywords
        });
      }
    }

    // E. Refund unused credits if actual cost is less than total cost
    let actualCost = 0;
    for (const post of generatedPosts) {
      const hasImage = post.imageUrl ? true : false;
      const costForThisPost = (isAiImage && hasImage) ? 40 : 10;
      actualCost += costForThisPost;
    }

    const unusedCredits = totalCost - actualCost;
    if (unusedCredits > 0) {
      console.log(`[Bulk Generator] Refunding ${unusedCredits} unused credits to user ${userId} (Total: ${totalCost}, Actual: ${actualCost})`);
      await refundUserCredits(supabase, userId, unusedCredits);
    }

    return {
      success: true,
      message: `Successfully generated ${generatedPosts.length} posts spaced ${frequency} apart.`,
      posts: generatedPosts
    };

  } catch (err: any) {
    console.error('[Bulk Generator] Error generating bulk content:', err);
    try {
      console.log(`[Bulk Generator] Refunding full ${totalCost} credits due to error: ${err.message}`);
      await refundUserCredits(supabase, userId, totalCost);
    } catch (refundErr) {
      console.error('[Bulk Generator] Failed to refund credits after error:', refundErr);
    }
    return { success: false, message: `Error generating content: ${err.message}` };
  }
}
