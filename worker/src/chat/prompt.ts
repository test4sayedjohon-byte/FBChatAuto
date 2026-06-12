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
import { getKnowledgeFieldsFallback, getCustomerProfileFallback, getMediaAssetsFallback } from '../db';

/**
 * Knowledge field from the database.
 */
interface KnowledgeField {
  field_name: string;
  field_value: string;
  category: string;
  value_type?: 'string' | 'list' | 'boolean' | 'number';
  display_label?: string | null;
  description?: string | null;
  page_id?: string | null;
}

/**
 * Escape regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a field value for prompt injection based on its type.
 */
function formatFieldValueForPrompt(field: KnowledgeField): string {
  if (field.value_type === 'list') {
    try {
      const parsed = JSON.parse(field.field_value);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
    } catch (_) {
      // Return raw string if parsing fails
    }
  }
  if (field.value_type === 'boolean') {
    return field.field_value === 'true' ? 'Yes' : 'No';
  }
  return field.field_value;
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
  senderId: string,
  ragContext?: string,
  db?: D1Database,
  aiPromptDirective?: string
): Promise<string> {
  const userId = pageConnection.user_id;
  const pageId = pageConnection.page_id;

  // 1. Fetch the user's knowledge fields (Global or Page-specific)
  let rawFields = null;
  if (db) {
    rawFields = await getKnowledgeFieldsFallback(db, supabase, userId, pageId);
  } else {
    const { data } = await supabase
      .from('knowledge_fields')
      .select('field_name, field_value, category, value_type, display_label, description, page_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`page_id.eq.${pageId},page_id.is.null`)
      .order('sort_order', { ascending: true });
    rawFields = data;
  }

  // Deduplicate: page-specific fields override global (page_id=null) fields
  // with the same field_name to avoid contradictory info in the prompt
  const fieldMap = new Map<string, KnowledgeField>();
  if (rawFields) {
    for (const f of rawFields) {
      const existing = fieldMap.get(f.field_name);
      // Keep page-specific (has page_id) over global (page_id=null)
      if (!existing || (f.page_id && !existing.page_id)) {
        fieldMap.set(f.field_name, f as KnowledgeField);
      }
    }
  }
  const fields = Array.from(fieldMap.values());

  // 1b. Fetch Customer Profile Summary if profiling is enabled
  let customerSummary = null;
  if (pageConnection.enable_customer_profiling) {
    if (db) {
      const profile = await getCustomerProfileFallback(db, supabase, pageId, senderId);
      customerSummary = profile?.summary ?? null;
    } else {
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('summary')
        .eq('page_id', pageId)
        .eq('sender_id', senderId)
        .maybeSingle();
        
      if (profile?.summary) {
        customerSummary = profile.summary;
      }
    }
  }

  // 1c. Fetch active media assets for the user/tenant
  let chatAssets: any[] = [];
  try {
    let allMedia: any[] = [];
    if (db) {
      allMedia = await getMediaAssetsFallback(db, supabase, userId);
    } else {
      // IMPORTANT: filter only by use_in_chat — ai_auto_send is a legacy field and
      // is intentionally NOT used here so both D1 and Supabase paths behave identically.
      const { data } = await supabase
        .from('media')
        .select('*')
        .eq('user_id', userId)
        .eq('use_in_chat', true);
      allMedia = data || [];
    }

    // Resolve which folders are assigned to this page
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
      console.warn('[Prompt] Failed to fetch folder page assignments:', err);
    }

    // Filter media: keep global ones OR those belonging to assigned folders
    chatAssets = allMedia.filter(m => !m.folder_id || activeFolderIds.includes(m.folder_id));
  } catch (err) {
    console.error('[Prompt] Failed to load media assets for prompt:', err);
  }

  // 2. Build the base prompt
  const parts: string[] = [];

  // Base persona
  if (pageConnection.custom_system_prompt && pageConnection.custom_system_prompt.trim().length > 0) {
    let customPrompt = pageConnection.custom_system_prompt.trim();
    // Replace variable placeholders like {{business_name}}
    if (fields && fields.length > 0) {
      for (const field of fields as KnowledgeField[]) {
        const val = formatFieldValueForPrompt(field);
        
        // Support curly brace format: {{field_name}}
        const placeholderCurly = `{{${field.field_name}}}`;
        customPrompt = customPrompt.replace(new RegExp(escapeRegExp(placeholderCurly), 'g'), val);

        // Support bracket format: [field_name]
        const placeholderBracket = `[${field.field_name}]`;
        customPrompt = customPrompt.replace(new RegExp(escapeRegExp(placeholderBracket), 'g'), val);
      }
    }
    parts.push(customPrompt);
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

  // 2b. Inject Customer Summary
  if (customerSummary) {
    parts.push('## Customer Profile (Internal Memory - FOR REFERENCE ONLY)');
    parts.push('The following summary is in English for internal records only. DO NOT reply in English just because this summary is in English. Always follow the Language Policy.');
    parts.push(customerSummary);
    parts.push('');
  }

  // 3. Inject knowledge fields grouped by category (only if not using custom prompt or if they want to combine)
  // Note: We inject fields even with custom prompts if they don't use placeholders, as a safety net.
  if (fields && fields.length > 0) {
    parts.push('## Business Information');
    parts.push('Use the following verified facts to answer questions:');
    parts.push('');

    // Group by category
    const grouped = groupByCategory(fields as KnowledgeField[]);

    for (const [category, categoryFields] of Object.entries(grouped)) {
      parts.push(`### ${formatCategoryName(category)}`);
      for (const field of categoryFields) {
        const label = field.display_label || formatCategoryName(field.field_name);
        const displayVal = formatFieldValueForPrompt(field);
        parts.push(`- **${label}:** ${displayVal}`);
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

  // 4b. Inject Chat Assets instructions if available
  if (chatAssets && chatAssets.length > 0) {
    parts.push('## Sharing Files & Media');
    parts.push('You have access to the following files/media that you can share with the customer. If they ask for any of these, or if you feel it is highly relevant to answer their query, you MUST append `[SendMedia: name]` (exactly in this format, replacing `name` with the asset alias name) at the very end of your response text. Only send the file if they ask for it or if it directly addresses their question.');
    parts.push('');
    for (const asset of chatAssets) {
      parts.push(`- **Alias:** \`${asset.name}\` (Description: ${asset.description || asset.friendly_name})`);
    }
    parts.push('');
  }

  // 4c. Factual Guardrails (Strict Truthfulness)
  parts.push('## Factual Policy (Strict Truthfulness)');
  parts.push('You MUST only answer using the verified facts provided in the "Business Information" or "Additional Context" sections. DO NOT make up any prices, numbers, contact info, locations, or business details. If a customer asks a question that is not covered by the provided facts, you MUST say that you do not have that information and suggest they contact the business representative directly.');
  parts.push('');

  // 5. Strict Language Mirroring Safeguard
  parts.push('## Language Policy (Strict Mirroring)');
  parts.push('You MUST detect the language and script/style of the customer\'s message and reply in that EXACT same language and script/style.');
  parts.push('');
  parts.push('### Examples of Language Mirroring:');
  parts.push('1. User writes in Bengali Script:');
  parts.push('   User: ভাই, আপনাদের দোকান কখন খোলা থাকে?');
  parts.push('   Assistant: আমাদের দোকান প্রতিদিন সকাল ১০টা থেকে রাত ৮টা পর্যন্ত খোলা থাকে। আপনি যেকোনো সময় আসতে পারেন!');
  parts.push('');
  parts.push('2. User writes in Banglish (Bengali using Latin/English letters):');
  parts.push('   User: bhai, delivery charge koto?');
  parts.push('   Assistant: Bhai, delivery charge hocche dhakar bhitore 60 taka ar dhakar bahire 120 taka.');
  parts.push('');
  parts.push('3. User writes in English:');
  parts.push('   User: Hello, what is the price of this product?');
  parts.push('   Assistant: Hello! The price of this product is 1,200 BDT. Let me know if you would like to order!');
  parts.push('');

  // 6. Strict Plain Text Safeguard (No Markdown)
  parts.push('## Formatting Policy (STRICT PLAIN TEXT)');
  parts.push('You MUST output your reply in STRICT PLAIN TEXT. Messenger and WhatsApp do not support markdown properly. DO NOT use markdown headers (e.g., #, ##, ###), bold markdown (e.g., **text**), bullet point lists (e.g., - item), numbered lists (e.g., 1. item), or horizontal rules (e.g., ---). Respond in natural human paragraphs and plain sentences, using emojis naturally if needed, as if writing a message on a phone.');
  parts.push('');

  if (aiPromptDirective && aiPromptDirective.trim().length > 0) {
    parts.push('## Dynamic Instruction for this message (FOLLOW STRICTLY)');
    parts.push(aiPromptDirective.trim());
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
