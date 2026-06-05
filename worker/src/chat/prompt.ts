// ============================================================================
// System Prompt Builder
// ============================================================================
// Constructs the AI system prompt by dynamically injecting:
//   1. Base persona/instructions
//   2. Knowledge fields (business data from the dashboard)
//   3. RAG context (relevant document chunks, when applicable)
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection } from '../types';

/**
 * Knowledge field from the database.
 */
interface KnowledgeField {
  field_name: string;
  field_value: string;
  category: string;
}

/**
 * Build the complete system prompt for an AI response.
 *
 * @param supabase       - Admin Supabase client
 * @param pageConnection - The Facebook Page connection details
 * @param ragContext     - Optional RAG chunks to inject (from vector search)
 */
export async function buildSystemPrompt(
  supabase: SupabaseClient,
  pageConnection: PageConnection,
  ragContext?: string
): Promise<string> {
  const userId = pageConnection.user_id;
  const pageId = pageConnection.page_id;

  // 1. Fetch the user's knowledge fields (Global or Page-specific)
  const { data: fields } = await supabase
    .from('knowledge_fields')
    .select('field_name, field_value, category')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`page_id.eq.${pageId},page_id.is.null`)
    .order('sort_order', { ascending: true });

  // 2. Build the base prompt
  const parts: string[] = [];

  // Base persona
  if (pageConnection.custom_system_prompt && pageConnection.custom_system_prompt.trim().length > 0) {
    parts.push(pageConnection.custom_system_prompt.trim());
    parts.push('');
  } else {
    const botName = pageConnection.bot_name ?? 'a helpful, friendly, and professional AI assistant';
    const pageName = pageConnection.page_name ?? 'this business';
    parts.push(`You are ${botName} for ${pageName} on Facebook Messenger.`);
    parts.push('');
    parts.push('## Instructions');
    parts.push('- Respond in a conversational, warm tone appropriate for Messenger.');
    parts.push('- Keep responses concise — Messenger is a chat format, not an essay.');
    parts.push('- If you do not know the answer, say so honestly. Do not make things up.');
    parts.push('- Use the business information below to answer customer questions accurately.');
    parts.push('- If a question is outside your knowledge, suggest the customer contact the business directly.');
    parts.push('- NEVER reveal that you are an AI unless directly asked. Present yourself as a helpful representative.');
    parts.push('');
  }

  // 3. Inject knowledge fields grouped by category
  if (fields && fields.length > 0) {
    parts.push('## Business Information');
    parts.push('Use the following verified facts to answer questions:');
    parts.push('');

    // Group by category
    const grouped = groupByCategory(fields as KnowledgeField[]);

    for (const [category, categoryFields] of Object.entries(grouped)) {
      parts.push(`### ${formatCategoryName(category)}`);
      for (const field of categoryFields) {
        parts.push(`- **${field.field_name}:** ${field.field_value}`);
      }
      parts.push('');
    }
  }

  // 4. Inject RAG context if available
  if (ragContext && ragContext.trim().length > 0) {
    parts.push('## Additional Context');
    parts.push('The following information was retrieved from the business knowledge base and may be relevant to the current question:');
    parts.push('');
    parts.push(ragContext);
    parts.push('');
    parts.push('Use this context to answer the question if relevant. If the context does not apply, ignore it.');
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Group knowledge fields by category.
 */
function groupByCategory(fields: KnowledgeField[]): Record<string, KnowledgeField[]> {
  const grouped: Record<string, KnowledgeField[]> = {};

  for (const field of fields) {
    const category = field.category || 'general';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(field);
  }

  return grouped;
}

/**
 * Format a category slug into a display name.
 * e.g., 'business_hours' → 'Business Hours'
 */
function formatCategoryName(category: string): string {
  return category
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
