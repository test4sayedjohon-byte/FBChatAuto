import type { AIProviderConfig, ChatMessage } from '../ai/types';
import { callChatCompletionWithFailover } from '../ai/client';
import { buildPresetSystemInstructions } from './generator-presets';

export interface GeneratedPostPayload {
  caption: string;
  image_prompt: string;
  theme: string;
  summary: string;
  keywords: string[];
  first_comments?: string[];
}

/**
 * Generates multiple posts in a single LLM request to maximize token efficiency.
 * Automatically falls back to 1-by-1 generation if batching fails.
 */
export async function generateBatchContent(
  providerChain: AIProviderConfig[],
  options: {
    preset: string;
    brandVoice: string;
    compressedRagDocs: string;
    compressedQa: string;
    memoryContext: string;
    templates: any[];
    addFirstComment: boolean;
    themeText?: string;
    selectedProducts?: any[];
  }
): Promise<GeneratedPostPayload[]> {
  const { templates } = options;
  const batchSize = 5;
  const allPayloads: GeneratedPostPayload[] = [];

  for (let i = 0; i < templates.length; i += batchSize) {
    const batchTemplates = templates.slice(i, i + batchSize);
    const previousCaption = allPayloads.length > 0 ? allPayloads[allPayloads.length - 1].caption : undefined;
    
    try {
      console.log(`[Batch Generator] Attempting to generate batch of ${batchTemplates.length} posts (index ${i} to ${i + batchTemplates.length - 1})`);
      const payloads = await generateSingleBatch(providerChain, batchTemplates, i, options, previousCaption);
      allPayloads.push(...payloads);
    } catch (err) {
      console.warn(`[Batch Generator] Batch starting at index ${i} failed. Falling back to 1-by-1 generation.`, err);
      // Fallback: generate each template in this batch individually
      for (let j = 0; j < batchTemplates.length; j++) {
        const singlePayload = await generateSinglePostFallback(
          providerChain,
          batchTemplates[j],
          i + j,
          options,
          allPayloads
        );
        allPayloads.push(singlePayload);
      }
    }
  }

  return allPayloads;
}

async function generateSingleBatch(
  providerChain: AIProviderConfig[],
  batchTemplates: any[],
  startIndex: number,
  options: {
    preset: string;
    brandVoice: string;
    compressedRagDocs: string;
    compressedQa: string;
    memoryContext: string;
    addFirstComment: boolean;
    themeText?: string;
    selectedProducts?: any[];
  },
  previousCaption?: string
): Promise<GeneratedPostPayload[]> {
  const systemPrompt = `You are a social media copywriter.
Brand Voice Profile:
"""
${options.brandVoice}
"""

Business Context & Knowledge:
"""
${options.compressedRagDocs}
${options.compressedQa}
"""

Deduplication Memory Context:
${options.memoryContext}

Campaign Preset: ${options.preset.toUpperCase()}
${buildBatchPresetInstructions(options.preset, batchTemplates.length, startIndex, options.themeText, previousCaption, options.selectedProducts)}

Batch Diversity Constraints:
- Ensure each of the ${batchTemplates.length} posts addresses a distinct theme, angle, or industry topic.
- Do NOT repeat the same advice, tip, or hook across different posts in the same batch.
- Maintain variety in tone and message styling.

Generate a batch of exactly ${batchTemplates.length} posts matching the templates below in order:
${batchTemplates.map((t, idx) => `[Post ${idx + 1}]
- Template Title: "${t.title}"
- Instructions: "${t.prompt_text}"
- Image Style: "${t.image_prompt_text || 'A premium clean aesthetic matching the post style.'}"`).join('\n\n')}

Return your response ONLY as a JSON array matching this structure:
[
  {
    "caption": "message/caption for Post 1",
    "image_prompt": "suggested image description/prompt for Post 1",
    "theme": "theme/topic (2-4 words) for Post 1",
    "summary": "1 sentence summary for Post 1",
    "keywords": ["tag1", "tag2"],
    "first_comments": ["comment 1", "comment 2"]
  },
  ...
]`;

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate a batch of ${batchTemplates.length} posts as a token-efficient JSON response array.` }
  ];

  const completion = await callChatCompletionWithFailover(providerChain, chatMessages, {
    temperature: 0.7,
    maxTokens: 2500
  });

  const responseText = completion.choices[0].message.content || '[]';
  return parseBatchJson(responseText);
}

function parseBatchJson(text: string): GeneratedPostPayload[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const jsonText = jsonMatch ? jsonMatch[0] : text;
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error('Parsed output is not a JSON array');
  }
  return parsed;
}

async function generateSinglePostFallback(
  providerChain: AIProviderConfig[],
  template: any,
  index: number,
  options: {
    preset: string;
    brandVoice: string;
    compressedRagDocs: string;
    compressedQa: string;
    memoryContext: string;
    addFirstComment: boolean;
    themeText?: string;
    selectedProducts?: any[];
  },
  allPayloads: GeneratedPostPayload[]
): Promise<GeneratedPostPayload> {
  const previousCaption = allPayloads.length > 0 ? allPayloads[allPayloads.length - 1].caption : undefined;
  const currentProduct = options.selectedProducts && options.selectedProducts.length > 0 
    ? options.selectedProducts[index % options.selectedProducts.length]
    : null;

  const presetInstructions = buildPresetSystemInstructions({
    preset: options.preset as any,
    themeText: options.themeText,
    previousCaption,
    product: currentProduct
  });

  const systemPrompt = `You are a social media copywriter.
Brand Voice Profile:
"""
${options.brandVoice}
"""

Business Context & Knowledge:
"""
${options.compressedRagDocs}
${options.compressedQa}
"""

Deduplication Memory Context:
${options.memoryContext}

Campaign Configuration & Directives:
${presetInstructions}

Post Type Template "${template.title}":
"""
${template.prompt_text}
"""

Instructions for the Visual/Image Generation Prompt:
${template.image_prompt_text || 'A premium clean aesthetic matching the post style.'}

Generate:
1. Caption/message for this post.
2. Suggested image generation prompt (describing key details, colors, objects).
3. A theme name (2-4 words) summarizing the core topic.
4. Post summary (1 sentence).
5. Keywords (array of 3-5 tags used).
6. First comments (array of 1 to 3 engagement hooks, CTA hashtags, or product info links) if add_first_comment directive is enabled: ${options.addFirstComment ? 'true' : 'false'}.

Return your response ONLY as a JSON object matching this structure:
{
  "caption": "...",
  "image_prompt": "...",
  "theme": "...",
  "summary": "...",
  "keywords": ["tag1", "tag2", "tag3"],
  "first_comments": ["comment 1", "comment 2"]
}`;

  const completion = await callChatCompletionWithFailover(providerChain, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate post ${index + 1} (${template.title}) as a token-efficient JSON response.` }
  ], {
    temperature: 0.7,
    maxTokens: 1000
  });

  const responseText = completion.choices[0].message.content || '{}';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
  return {
    caption: parsed.caption || `Insightful update about ${template.title || 'our business'}.`,
    image_prompt: parsed.image_prompt || `A clean elegant visual illustrating ${template.title || 'marketing concepts'}.`,
    theme: parsed.theme || template.title || 'General Update',
    summary: parsed.summary || `Update on ${template.title || 'business topics'}.`,
    keywords: parsed.keywords && parsed.keywords.length > 0 ? parsed.keywords : [template.title ? template.title.toLowerCase().replace(/\s+/g, '-') : 'update'],
    first_comments: parsed.first_comments || (parsed.first_comment ? [parsed.first_comment] : [])
  };
}

function buildBatchPresetInstructions(
  preset: string,
  count: number,
  startIndex: number,
  themeText?: string,
  previousCaption?: string,
  selectedProducts?: any[]
): string {
  switch (preset) {
    case 'thematic':
      return `
- Topic Focus: "${themeText || 'General Business Showcase'}"
- Objective: Provide a deep-dive educational analysis of this topic. Avoid generic high-level summaries. Write about tools, best practices, common pitfalls, or step-by-step methods related to the topic.
- Style: Informative, authoritative, and helpful.
`;
    case 'sequential_story':
      const sequelContext = previousCaption
        ? `- Continuation: Yesterday's Post Caption was: "${previousCaption}". Start the first post of this batch as a smooth transition from yesterday's post.`
        : `- Starting Post: This is the first post of the sequence. Establish the core problem, hook the reader's interest, and hint at the next day's solution.`;
      return `
- Objective: Take the user on a progressive narrative journey. All ${count} posts generated in this batch MUST connect sequentially and tell a progressive story.
- Spacing Context: ${sequelContext}
- Style: Story-driven, conversational, engaging, and transitional.
`;
    case 'product_showcase':
      if (!selectedProducts || selectedProducts.length === 0) {
        return `
- Objective: Promote our services or offerings. Describe the core benefits and value propositions.
- Style: Persuasive, promotional, high-intent.
`;
      }
      return `
- Objective: Showcase our products. We have provided products. For each post in the batch, highlight a different product from the catalog.
- Catalog Products Available:
${selectedProducts.map((p, idx) => `  * Product ${idx + 1}: ${p.name} - ${p.description || 'No description'} (${p.price} ${p.currency || 'BDT'}) - Product Photo URL: ${p.image_url || 'None'}`).join('\n')}
- Image Guidelines: If a product photo URL is provided, reference it in your suggested image prompt and instruct the generator to display or integrate this product image.
- Style: Conversion-focused, professional showcase, persuasive.
`;
    case 'daily_consistency':
    default:
      return `
- Objective: Keep the feed active with varied content types.
- Rotate styles: Alternates through:
  1. Educational tip (high-value tutorial, tip, or hack)
  2. Success story (transformation, emotional hook)
  3. Interactive hook (question, industry poll, or survey)
  4. Product promo (benefit-led presentation)
- Format: Choose different formats from this list for each post in the batch to maintain variety.
`;
  }
}
