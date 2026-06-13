import type { ChatMessage, AIProviderConfig } from '../ai/types';
import { callChatCompletionWithFailover } from '../ai/client';

export interface PromptEnhancerOptions {
  rawImagePrompt: string;
  aestheticTheme: string;
  imageModel: string;
}

/**
 * Enhances a raw image prompt based on the selected aesthetic theme and image model constraints.
 * Uses a token-efficient, concise system prompt.
 */
export async function enhanceImagePrompt(
  providerChain: AIProviderConfig[],
  options: PromptEnhancerOptions
): Promise<string> {
  const { rawImagePrompt, aestheticTheme, imageModel } = options;

  // Compact rules mapping
  const themeStyles: Record<string, string> = {
    'Modern Minimalist': 'Clean layout, ample negative space, soft ambient natural side-lighting, organic neutral color scheme, premium high-end aesthetic.',
    'Corporate B2B': 'Professional office setting, bright clean lighting, premium workspaces, slate gray and navy corporate accents, high contrast, clean rendering.',
    'Vibrant Tech': 'Neon glows, dynamic cybernetic lines, deep dark backdrops with cyan/purple accents, futuristic high-tech styling, octane render.',
    'Moody Studio': 'Chiaroscuro studio photography, dark matte backgrounds, sharp dramatic spotlight focus, rich gold/bronze highlights, sophisticated feel.'
  };

  const selectedThemeStyle = themeStyles[aestheticTheme] || themeStyles['Modern Minimalist'];
  const modelInstruction = imageModel.toLowerCase().includes('flux')
    ? 'Write a detailed natural-language descriptive paragraph depicting the scene, photographic elements, and focus details. Flux excels at photorealistic details.'
    : 'Write a punchy, stylized, graphic-design prompt with clear design keywords (e.g., vector graphic, flat illustration, clean shapes).';

  const systemPrompt = `You are a professional AI image prompt builder. Enhance the raw prompt below.
Guidelines:
- Tone Style: ${selectedThemeStyle}
- Target Model Guidance: ${modelInstruction}
- output ONLY the enhanced, clean, highly detailed image prompt text. Do NOT include intro, explanation, or quotes. Keep it under 150 words.`;

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Enhance this raw idea: "${rawImagePrompt}"` }
  ];

  try {
    const completion = await callChatCompletionWithFailover(providerChain, chatMessages, {
      temperature: 0.6,
      maxTokens: 300
    });

    const result = completion.choices[0].message.content?.trim() || rawImagePrompt;
    // Strip surrounding quotes if the model wrapped it
    return result.replace(/^["']|["']$/g, '');
  } catch (err) {
    console.error('[Prompt Enhancer] Failed to enhance image prompt:', err);
    return rawImagePrompt;
  }
}
