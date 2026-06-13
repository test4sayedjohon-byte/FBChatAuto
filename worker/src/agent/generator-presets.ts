export interface GeneratorPresetOptions {
  preset: 'thematic' | 'daily_consistency' | 'sequential_story' | 'product_showcase';
  themeText?: string;
  previousCaption?: string;
  product?: {
    name: string;
    description: string;
    price: number | string;
    currency: string;
  };
}

/**
 * Builds custom prompts and instructions depending on the selected campaign preset.
 */
export function buildPresetSystemInstructions(options: GeneratorPresetOptions): string {
  const { preset, themeText, previousCaption, product } = options;

  switch (preset) {
    case 'thematic':
      return `
CAMPAIGN PRESET: Thematic Campaign Focus
- Core Campaign Topic: "${themeText || 'General Business Showcase'}"
- Objective: Provide a deep-dive educational analysis of this topic. Avoid generic high-level summaries. Write about tools, best practices, common pitfalls, or step-by-step methods related to the topic.
- Style: Informative, authoritative, and helpful.
`;

    case 'sequential_story':
      const sequelContext = previousCaption
        ? `Yesterday's Post Caption:
"""
${previousCaption}
"""
- Continuation Directive: Reference or transition from yesterday's post smoothly (e.g., "Yesterday we explored X. Today, we're diving into Y..."). Build on the narrative sequence.`
        : `Start of the Story Sequence. Establish the core problem, hook the reader's interest, and hint at the next day's solution.`;

      return `
CAMPAIGN PRESET: Sequential Story Narrative
- Objective: Take the user on a progressive narrative journey.
- Spacing Context: ${sequelContext}
- Style: Story-driven, conversational, engaging, and transitional.
`;

    case 'product_showcase':
      if (!product) {
        return `
CAMPAIGN PRESET: Product Showcase
- Objective: Promote our services or offerings. Describe the core benefits and value propositions.
- Style: Persuasive, promotional, high-intent.
`;
      }
      return `
CAMPAIGN PRESET: Product Showcase
- Target Product Specs:
  * Name: ${product.name}
  * Description: ${product.description || 'No description provided'}
  * Pricing: ${product.price} ${product.currency || 'BDT'}
  * Product Photo URL: ${(product as any).image_url || 'None'}
- Objective: Highlight this specific product's key features, use cases, and pricing details. If a product photo URL is provided, reference it in your suggested image prompt and instruct the generator to display or integrate this product image. End with a clear call-to-action to purchase or inquire.
- Style: Conversion-focused, professional showcase, persuasive.
`;

    case 'daily_consistency':
    default:
      return `
CAMPAIGN PRESET: Daily Consistency (Rotating Formats)
- Objective: Keep the feed active with varied content types.
- Rotate styles: Alternates through:
  1. Educational tip (high-value tutorial, tip, or hack)
  2. Customer quote / success story (transformation, emotional hook)
  3. Interactive hook (question, industry poll, or survey)
  4. Product promo (benefit-led presentation)
- Format for this post: Choose one of the above styles that contrasts with the previous posts in the batch.
`;
  }
}
