// ============================================================================
// Dashboard AI Agent Handler
// ============================================================================
// Provides tool-calling AI capabilities for dashboard users to manage their
// pages, prompts, knowledge fields, and documents via natural language.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv, PageConnection } from '../types';
import { callChatCompletion, AIProviderError } from '../ai/client';
import type { ChatMessage, AITool, AIProviderConfig } from '../ai/types';
import { getActiveAgentProvider, getActiveEmbeddingProvider } from '../ai/provider';
import { processDocument } from '../rag';

// Define the available tools for the dashboard agent
const agentTools: AITool[] = [
  {
    type: 'function',
    function: {
      name: 'update_system_prompt',
      description: 'Updates the custom system prompt instructions for a specific Facebook page.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The ID of the Facebook page.' },
          new_prompt: { type: 'string', description: 'The new system prompt instructions.' }
        },
        required: ['page_id', 'new_prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_knowledge_field',
      description: 'Adds a new Quick Answer (key-value knowledge field) to a specific page.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The ID of the Facebook page.' },
          category: { type: 'string', description: 'Category (e.g. general, pricing, policies).' },
          field_name: { type: 'string', description: 'The name of the field.' },
          field_value: { type: 'string', description: 'The value of the field.' }
        },
        required: ['page_id', 'category', 'field_name', 'field_value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_knowledge_field',
      description: 'Updates an existing Quick Answer (knowledge field) value for a specific page.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The ID of the Facebook page.' },
          field_name: { type: 'string', description: 'The exact name of the field to update.' },
          new_field_value: { type: 'string', description: 'The new value for the field.' }
        },
        required: ['page_id', 'field_name', 'new_field_value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_knowledge_field',
      description: 'Deletes an existing Quick Answer (knowledge field) for a specific page.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The ID of the Facebook page.' },
          field_name: { type: 'string', description: 'The exact name of the field to delete.' }
        },
        required: ['page_id', 'field_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: "Searches the user's existing Quick Answers (knowledge fields).",
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The ID of the Facebook page.' },
          query: { type: 'string', description: 'Search term or keyword.' }
        },
        required: ['page_id', 'query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_folders',
      description: 'Lists the Data Sources (document folders) assigned to a specific page.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The ID of the Facebook page.' }
        },
        required: ['page_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_documents',
      description: 'Lists existing Knowledge Base documents in a specific folder so you can check what already exists before creating a new document.',
      parameters: {
        type: 'object',
        properties: {
          folder_id: { type: 'string', description: 'The UUID of the folder to list documents from.' }
        },
        required: ['folder_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_document',
      description: 'Reads the full content of an existing Knowledge Base document by its ID. Use this before updating a document so you can see what is already inside it.',
      parameters: {
        type: 'object',
        properties: {
          document_id: { type: 'string', description: 'The UUID of the document to read.' }
        },
        required: ['document_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_document',
      description: 'Updates (replaces) the full content of an existing Knowledge Base document and re-embeds it. Always call get_document first to read existing content, then append the new content to it before calling this tool.',
      parameters: {
        type: 'object',
        properties: {
          document_id: { type: 'string', description: 'The UUID of the document to update.' },
          new_content: { type: 'string', description: 'The complete new content for the document (existing content + your additions).' }
        },
        required: ['document_id', 'new_content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_document',
      description: 'Creates a brand new Knowledge Base document in a folder. ONLY use this if no relevant document exists. Always check list_documents first — if a relevant doc exists, use get_document + update_document instead.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the document.' },
          content: { type: 'string', description: 'The text content.' },
          folder_id: { type: 'string', description: 'The UUID of the folder.' }
        },
        required: ['title', 'content', 'folder_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_version_history',
      description: 'Lists the recent database version history logs (changes to prompt, quick answers, docs) for a page connection.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The ID of the Facebook page.' },
          limit: { type: 'integer', description: 'Number of history records to fetch (default 10).' }
        },
        required: ['page_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'revert_to_version',
      description: 'Reverts a setting (prompt, quick answer, or document) to a previous value using its version history record ID.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The ID of the Facebook page.' },
          version_id: { type: 'string', description: 'The UUID of the version history record.' }
        },
        required: ['page_id', 'version_id']
      }
    }
  }
];

export async function handleAgentChat(
  supabase: SupabaseClient,
  userId: string,
  messages: ChatMessage[],
  env: AppEnv['Bindings'],
  channelId?: string,
  contextType?: string
): Promise<{ message: ChatMessage; databaseUpdated: boolean }> {
  let databaseUpdated = false;
  // 1. Get the provider. 
  // Priority 1: Environment variables (hardcoded override)
  // Priority 2: Database configured Active Agent
  // Priority 3: Database configured Active Chat
  let provider: AIProviderConfig | null = null;
  
  if (env.AGENT_API_KEY && env.AGENT_MODEL) {
    const isOpenRouter = env.AGENT_MODEL.includes('/');
    provider = {
      id: 'agent_override',
      userId: 'global',
      providerName: isOpenRouter ? 'openrouter' : 'openai',
      displayName: 'Super Admin Agent (Env)',
      baseUrl: isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1',
      apiKey: env.AGENT_API_KEY,
      modelChat: env.AGENT_MODEL,
      modelEmbedding: '',
      maxTokens: 2048,
      temperature: 0.2,
      contextWindow: 15,
      extraHeaders: isOpenRouter ? { 'HTTP-Referer': 'https://autometabot.com', 'X-Title': 'AutometaBot' } : {}
    };
  } else {
    // Check database for active agent provider, falls back to active chat
    provider = await getActiveAgentProvider(supabase, userId);
  }
  
  if (!provider) {
    throw new Error('No AI provider configured.');
  }

  // Fetch user's connected pages to provide context to the agent
  const { data: pages } = await supabase
    .from('page_connections')
    .select('page_id, page_name, instagram_account_id, whatsapp_phone_number_id')
    .eq('user_id', userId);

  let pagesContext = 'The user currently has no connected channels.';
  if (pages && pages.length > 0) {
    pagesContext = 'The user has the following connected channels (use the primary ID as the `page_id` for tools):\n' + pages.map(p => {
      let ids = `Primary ID: ${p.page_id}`;
      if (p.instagram_account_id) ids += `, IG ID: ${p.instagram_account_id}`;
      if (p.whatsapp_phone_number_id) ids = `Primary ID (WhatsApp): ${p.whatsapp_phone_number_id}`;
      return `- Name: "${p.page_name || 'Unnamed Channel'}" | ${ids}`;
    }).join('\n');
    pagesContext += '\n\nIMPORTANT: If the user asks to modify a prompt or knowledge base without specifying the channel, ask them which of these channels they mean. Then use the corresponding Primary ID as the `page_id` argument in your tools.';
  }

  // Filter tools and build custom context boundary rules
  let extraPrompt = '';
  let filteredTools = [...agentTools];

  if (channelId && channelId !== 'global') {
    const targetPage = pages?.find(p => p.page_id === channelId || p.whatsapp_phone_number_id === channelId);
    const pageDisplayName = targetPage ? (targetPage.page_name || channelId) : channelId;
    extraPrompt += `\n\nCRITICAL CONTEXT RESTRICTION: You are strictly locked to the channel "${pageDisplayName}" (ID: ${channelId}). For any tool call that requires a \`page_id\`, you MUST use "${channelId}". Do not ask the user for a channel, and do not use any other page ID.`;
  } else {
    extraPrompt += `\n\nCONTEXT: You are operating in Global mode (All Channels). If a tool call requires a \`page_id\`, select the appropriate channel from the user's connected channels. If it is ambiguous, ask the user to clarify or switch to a specific channel using the dropdown in their chat settings page.`;
  }

  if (contextType && contextType !== 'global') {
    if (contextType === 'system_prompt') {
      filteredTools = agentTools.filter(t => t.function.name === 'update_system_prompt');
      extraPrompt += `\n\nCRITICAL CONTEXT RESTRICTION: You are in the "System Prompt" context. You can ONLY modify the system prompt (using \`update_system_prompt\`). If the user asks you to modify Quick Answers, Data Sources, or documents, do NOT try to do it. Instead, politely inform them that they must change their Context selection in the dropdown to the appropriate option first.`;
    } else if (contextType === 'quick_answers') {
      filteredTools = agentTools.filter(t => [
        'add_knowledge_field',
        'update_knowledge_field',
        'delete_knowledge_field',
        'search_knowledge'
      ].includes(t.function.name));
      extraPrompt += `\n\nCRITICAL CONTEXT RESTRICTION: You are in the "Quick Answers" context. You can ONLY manage quick answers (knowledge fields) using the tools provided. If the user asks to modify the system prompt, folders, or documents, do NOT try to do it. Instead, politely inform them that they must change their Context selection in the dropdown to the appropriate option first.`;
    } else if (contextType === 'knowledge_base') {
      filteredTools = agentTools.filter(t => [
        'list_folders',
        'list_documents',
        'get_document',
        'update_document',
        'create_document'
      ].includes(t.function.name));
      extraPrompt += `\n\nCRITICAL CONTEXT RESTRICTION: You are in the "Knowledge Base" context. You can ONLY manage Data Sources (folders) and the Knowledge Base (documents). If the user asks to modify the system prompt or quick answers, do NOT try to do it. Instead, politely inform them that they must change their Context selection in the dropdown to the appropriate option first.`;
    }
  }

  // Prepend system prompt
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are the Autometa Bot System Agent, a highly capable IDE-like AI engineering assistant. You have full autonomous capability to manage, inspect, modify, and optimize the chatbot settings and knowledge base for the user.

Your goal is to ensure the user's customer-facing chatbot (running on Facebook/WhatsApp) behaves perfectly according to their business rules, factual details, and guidelines.

HOW THE CUSTOMER-FACING BOT ACTUALLY WORKS (READ THIS CAREFULLY):
When a real customer sends a message on Facebook/WhatsApp, the bot builds its context in this exact order:

  [1] System Prompt → ALWAYS injected, every single message. This is the bot's core personality and hard rules.
  [2] Quick Answers → ALWAYS injected, every single message, as a "Business Information" block. Every field is listed out for the AI to read.
  [3] Knowledge Base (RAG) → ONLY injected when the customer's message triggers a semantic search. The system searches the vector database for relevant document chunks and injects only what matches.

This means:
- Quick Answers ARE the permanent memory layer. If you put 50+ fields in, they all get injected every time → token bloat → hallucinations.
- The Knowledge Base is the on-demand retrieval layer. It is searched automatically. You do NOT need to put doc content anywhere else.
- The System Prompt sets the rules. It must stay short and behavior-only.

TERMINOLOGY & DATABASE ARCHITECTURE:
- "System Prompt" (custom_system_prompt in page_connections): Behavioral rules, persona, tone, constraints ONLY. Max 800 words. NEVER put facts, prices, emails, hours, or lists here.
- "Quick Answers" (knowledge_fields table): Short key-value facts always injected into every prompt. Use for instant-recall data: prices, contacts, hours, product names, specs. Each value: 1-3 sentences max. Keep total fields under ~40 to avoid token bloat.
- "Knowledge Base" (documents table / RAG vector store): Long-form content that gets searched and retrieved on demand. Use for: detailed FAQs, policies, catalogs, how-to guides, anything over 5 sentences. The bot retrieves the relevant parts automatically when a customer asks about it — you do NOT need to copy this content into the prompt or Quick Answers.
- "Version History" (version_history table): Logs all changes for undo/revert.

VERSION HISTORY & UNDO PROTOCOL:
If the user asks you to revert, undo, go back, or restore a setting to its previous state:
1. Call list_version_history tool to check the recent logs.
2. Identify the setting they want to revert (e.g. prompt or a quick answer change).
3. Call revert_to_version with its version_id to restore the exact original content.
4. Inform the user you have restored the setting.

CONTENT ROUTING — CLASSIFY FIRST, ACT SECOND. ALWAYS.:
Before writing or saving anything, classify the content into exactly one of these three layers:

LAYER 1 — SYSTEM PROMPT (behavioral rules only):
  Belongs here: Tone, persona, language rules, hard constraints ("never offer refunds"), fallback behavior.
  Does NOT belong here: Any facts, prices, names, emails, hours, product info, or lists.
  Action: Read current prompt first → make ONE surgical edit → save. Never rewrite the whole thing.

LAYER 2 — QUICK ANSWERS (short instant-recall facts):
  Belongs here: Single values the bot must know in every conversation. Price, email, phone, hours, one-liner specs.
  Rule: Each value must fit in 1-3 short sentences. Keep total field count under ~40.
  Action: search_knowledge first → update if exists → add if not. Never add duplicates.
  HARD STOP: If value is longer than 3 sentences → it goes to Layer 3 instead.

LAYER 3 — KNOWLEDGE BASE (on-demand retrieval documents):
  Belongs here: Everything else. Q&A pairs, FAQs, policies, product details, catalogs, guides, anything over 5 sentences.
  How it works: Customers trigger this automatically — the system searches and injects only the relevant parts.
  You do NOT need to copy this content anywhere else. Trust the RAG system.

QUICK DECISION TEST:
  → Rule about bot BEHAVIOR? → Layer 1 (System Prompt)
  → Short single fact, fits in 2 sentences? → Layer 2 (Quick Answer)
  → Everything else? → Layer 3 (Knowledge Base document)

KNOWLEDGE BASE — DOCUMENT CATEGORY MAP:
The Knowledge Base can have multiple documents, each covering a different topic. When adding content, you must match it to the right document. Use this category map to decide:

  CATEGORY: FAQ / General Questions
    Keywords: "if someone asks", "when asked about", "how to answer", "what to say if", Q&A pairs, common questions
    Target document title: "FAQ" or "Frequently Asked Questions"

  CATEGORY: Pricing & Plans
    Keywords: price, cost, fee, plan, subscription, package, tier, rate, discount, offer
    Target document title: "Pricing" or "Pricing Sheet"

  CATEGORY: Products & Services
    Keywords: product, service, item, model, spec, feature, what we sell, what we offer, catalog
    Target document title: "Products & Services" or "Product Catalog"

  CATEGORY: Shipping & Delivery
    Keywords: shipping, delivery, dispatch, courier, tracking, arrive, how long, days
    Target document title: "Shipping & Delivery"

  CATEGORY: Returns, Refunds & Policies
    Keywords: return, refund, exchange, policy, guarantee, warranty, cancel, complaint
    Target document title: "Returns & Refund Policy"

  CATEGORY: Contact & Support
    Keywords: contact, support, help, reach, call, email, office, team, agent
    Target document title: "Contact & Support"

  CATEGORY: Business Info & About
    Keywords: about, who are we, our story, established, mission, vision, background, company
    Target document title: "About Us"

  CATEGORY: Custom / Other
    If content does not clearly fit above categories, create a document with a clear descriptive title matching the topic.

KNOWLEDGE BASE — STRICT DOCUMENT WORKFLOW (follow every step, no shortcuts):
Step 1 → Call list_folders. Get folder IDs assigned to this page.
Step 2 → Call list_documents on each folder. Get all existing document titles + IDs.
Step 3 → Classify what category the new content belongs to (use category map above).
Step 4 → Search the existing document list for a title that matches that category.
  MATCH FOUND → Go to Step 5a.
  NO MATCH → Go to Step 5b.
Step 5a (Append to existing):
  → Call get_document(document_id) to read the full current content.
  → Build the updated content = existing content + a clean separator + the new content.
  → Format it neatly. Use clear section headings. Do not duplicate existing entries.
  → Call update_document(document_id, full_updated_content).
  → Tell the user: "Added to your existing '[Document Title]' document ✓"
Step 5b (Create new document):
  → Choose a clear standard title from the category map above.
  → Format the content cleanly with headings.
  → Call create_document(title, content, folder_id).
  → Tell the user: "Created a new '[Document Title]' document ✓"

ABSOLUTE RULES FOR DOCUMENT MANAGEMENT:
  ✗ NEVER create a new document if a relevant one already exists — always append.
  ✗ NEVER overwrite or lose existing content — always read first, then combine.
  ✗ NEVER create vague document titles like "New Document", "Info", or "Data".
  ✗ NEVER put Q&A pairs, policies, or product details into Quick Answers.
  ✓ ALWAYS use clean formatting with headers and line breaks inside documents.
  ✓ ALWAYS re-embed after updating (update_document handles this automatically).

SYSTEM PROMPT HEALTH:
  - If the current prompt is over 800 words, warn the user and offer to refactor it.
  - The system prompt = persona brief + behavioral rules. Nothing else.
  - Surgical edits only — never rewrite unless explicitly asked.

BEHAVIOR DEBUGGING:
If the bot is misbehaving (e.g., "bot is giving wrong prices"):
  → Check the system prompt for conflicting rules.
  → Add a precise hard constraint using update_system_prompt.
  → Example: "CRITICAL: Never quote a price below $99. Always refer customers to the pricing sheet."

IDE SYNC:
The user sees a live split-screen editor. When you update the database, their tab flashes green automatically.
Always tell the user which tab was updated: Prompt tab / Quick Answers tab / Docs tab.

${pagesContext}
${extraPrompt}`
  };

  let conversation = [systemMessage, ...messages];

  // 2. Call LLM in a loop to support multi-turn tool calling (e.g. search then update)
  let loopCount = 0;
  const maxLoops = 5;

  while (loopCount < maxLoops) {
    let response = await callChatCompletion(provider, conversation, {
      tools: filteredTools.length > 0 ? filteredTools : undefined,
      toolChoice: filteredTools.length > 0 ? 'auto' : undefined
    });

    let message = response.choices[0].message;

    // If no more tool calls, return final text response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        message: {
          role: 'assistant',
          content: message.content ?? ''
        },
        databaseUpdated
      };
    }

    // Otherwise, push tool calls message and execute tools
    conversation.push(message as any);

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== 'function') continue;

      const fnName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      let resultStr = '';

      try {
        console.log(`[Agent] Executing tool: ${fnName}`, args);
        
        if (fnName === 'update_system_prompt') {
          if (args.page_id === 'global') {
            resultStr = `Error: Cannot update system prompt globally. You must specify a valid Facebook page_id.`;
          } else {
            const { error } = await supabase
              .from('page_connections')
              .update({ custom_system_prompt: args.new_prompt })
              .eq('page_id', args.page_id)
              .eq('user_id', userId);
            
            if (error) throw error;
            resultStr = `Successfully updated system prompt for page ${args.page_id}.`;
            databaseUpdated = true;
          }
        } 
        else if (fnName === 'add_knowledge_field') {
          const actualPageId = args.page_id === 'global' ? null : args.page_id;
          
          // First check if it already exists to avoid unique constraint errors
          let query = supabase
            .from('knowledge_fields')
            .select('id')
            .eq('user_id', userId)
            .eq('field_name', args.field_name);
            
          if (actualPageId === null) {
            query = query.is('page_id', null);
          } else {
            query = query.eq('page_id', actualPageId);
          }
          
          const { data: existing } = await query.maybeSingle();

          if (existing) {
            // Upsert / update
            const { error } = await supabase
              .from('knowledge_fields')
              .update({
                category: args.category,
                field_value: args.field_value
              })
              .eq('id', existing.id);
            if (error) throw error;
            resultStr = `Quick Answer '${args.field_name}' already existed, successfully updated its value instead.`;
          } else {
            // Insert
            const { error } = await supabase
              .from('knowledge_fields')
              .insert({
                user_id: userId,
                page_id: actualPageId,
                category: args.category,
                field_name: args.field_name,
                field_value: args.field_value
              });
            if (error) throw error;
            resultStr = `Successfully added Quick Answer '${args.field_name}'.`;
          }
          databaseUpdated = true;
        }
        else if (fnName === 'update_knowledge_field') {
          const actualPageId = args.page_id === 'global' ? null : args.page_id;
          let query = supabase
            .from('knowledge_fields')
            .select('id, field_name')
            .eq('user_id', userId);
            
          if (actualPageId === null) {
            query = query.is('page_id', null);
          } else {
            query = query.eq('page_id', actualPageId);
          }

          const { data: fields } = await query;

          let targetField = null;
          if (fields && fields.length > 0) {
            targetField = fields.find(f => f.field_name.toLowerCase() === args.field_name.toLowerCase());
            if (!targetField) {
              targetField = fields.find(f => 
                f.field_name.toLowerCase().includes(args.field_name.toLowerCase()) ||
                args.field_name.toLowerCase().includes(f.field_name.toLowerCase())
              );
            }
          }

          if (targetField) {
            const { error } = await supabase
              .from('knowledge_fields')
              .update({ field_value: args.new_field_value })
              .eq('id', targetField.id);
            
            if (error) throw error;
            resultStr = `Successfully updated Quick Answer '${targetField.field_name}' to: "${args.new_field_value}".`;
            databaseUpdated = true;
          } else {
            const existingFieldNames = fields ? fields.map(f => `'${f.field_name}'`).join(', ') : 'None';
            resultStr = `Could not find a Quick Answer matching '${args.field_name}'. Existing fields are: ${existingFieldNames}. Please specify the correct name.`;
          }
        }
        else if (fnName === 'delete_knowledge_field') {
          const actualPageId = args.page_id === 'global' ? null : args.page_id;
          let query = supabase
            .from('knowledge_fields')
            .select('id, field_name')
            .eq('user_id', userId);
            
          if (actualPageId === null) {
            query = query.is('page_id', null);
          } else {
            query = query.eq('page_id', actualPageId);
          }

          const { data: fields } = await query;

          let targetField = null;
          if (fields && fields.length > 0) {
            targetField = fields.find(f => f.field_name.toLowerCase() === args.field_name.toLowerCase());
            if (!targetField) {
              targetField = fields.find(f => 
                f.field_name.toLowerCase().includes(args.field_name.toLowerCase()) ||
                args.field_name.toLowerCase().includes(f.field_name.toLowerCase())
              );
            }
          }

          if (targetField) {
            const { error } = await supabase
              .from('knowledge_fields')
              .delete()
              .eq('id', targetField.id);
            
            if (error) throw error;
            resultStr = `Successfully deleted Quick Answer '${targetField.field_name}'.`;
            databaseUpdated = true;
          } else {
            const existingFieldNames = fields ? fields.map(f => `'${f.field_name}'`).join(', ') : 'None';
            resultStr = `Could not find a Quick Answer matching '${args.field_name}' to delete. Existing fields are: ${existingFieldNames}.`;
          }
        }
        else if (fnName === 'search_knowledge') {
          const actualPageId = args.page_id === 'global' ? null : args.page_id;
          let query = supabase
            .from('knowledge_fields')
            .select('field_name, field_value, category')
            .eq('user_id', userId)
            .or(`field_name.ilike.%${args.query}%,field_value.ilike.%${args.query}%`);
            
          if (actualPageId === null) {
            query = query.is('page_id', null);
          } else {
            query = query.eq('page_id', actualPageId);
          }
            
          const { data, error } = await query;
            
          if (error) throw error;
          resultStr = data && data.length > 0 ? JSON.stringify(data) : 'No knowledge fields found.';
        }
        else if (fnName === 'list_folders') {
          if (args.page_id === 'global') {
            const { data, error } = await supabase
              .from('document_folders')
              .select('id, name, description')
              .eq('user_id', userId);
              
            if (error) throw error;
            resultStr = data ? JSON.stringify(data) : 'No folders found.';
          } else {
            const { data, error } = await supabase
              .from('folder_page_assignments')
              .select('folder_id, document_folders(name, description)')
              .eq('user_id', userId)
              .eq('page_id', args.page_id);
              
            if (error) throw error;
            resultStr = data ? JSON.stringify(data) : 'No folders found for this page.';
          }
        }
        else if (fnName === 'list_documents') {
          const { data, error } = await supabase
            .from('documents')
            .select('id, title, source_type, chunk_count, created_at')
            .eq('user_id', userId)
            .eq('folder_id', args.folder_id)
            .order('created_at', { ascending: false });
            
          if (error) throw error;
          resultStr = data && data.length > 0 
            ? `Found ${data.length} document(s) in this folder:\n${JSON.stringify(data)}`
            : 'No documents found in this folder.';
        }
        else if (fnName === 'get_document') {
          const { data, error } = await supabase
            .from('documents')
            .select('id, title, original_content, chunk_count, created_at')
            .eq('id', args.document_id)
            .eq('user_id', userId)
            .single();
            
          if (error) throw error;
          if (!data) {
            resultStr = `Document not found for ID: ${args.document_id}`;
          } else {
            resultStr = `Document title: "${data.title}"\nChunks: ${data.chunk_count}\nContent:\n${data.original_content}`;
          }
        }
        else if (fnName === 'update_document') {
          const { error } = await supabase
            .from('documents')
            .update({ original_content: args.new_content })
            .eq('id', args.document_id)
            .eq('user_id', userId);
            
          if (error) throw error;
          resultStr = `Document updated successfully.`;
          databaseUpdated = true;

          // Re-embed the updated content
          try {
            const embedProvider = await getActiveEmbeddingProvider(supabase, userId);
            if (embedProvider) {
              await processDocument(supabase, embedProvider, userId, args.document_id, args.new_content);
              resultStr += ` Document re-processed and re-embedded successfully.`;
            } else {
              resultStr += ` Warning: No active embedding provider found. Content saved but not re-embedded.`;
            }
          } catch (embedError: any) {
            console.error('[Agent] Re-embedding error:', embedError);
            resultStr += ` Warning: Content saved but failed to re-embed — ${embedError.message}`;
          }
        }
        else if (fnName === 'create_document') {


          const { data, error } = await supabase
            .from('documents')
            .insert({
              user_id: userId,
              folder_id: args.folder_id,
              title: args.title,
              original_content: args.content,
              source_type: 'text'
            })
            .select('id')
            .single();
            
          if (error) throw error;
          resultStr = `Successfully created document with ID: ${data.id}.`;
          databaseUpdated = true;
          
          try {
            const embedProvider = await getActiveEmbeddingProvider(supabase, userId);
            if (embedProvider) {
              await processDocument(supabase, embedProvider, userId, data.id, args.content);
              resultStr += ` Document processed and embedded successfully.`;
            } else {
              resultStr += ` Warning: No active embedding provider found. Document saved but not embedded.`;
            }
          } catch (embedError: any) {
             console.error('[Agent] Embedding error:', embedError);
             resultStr += ` Warning: Document created but failed to embed - ${embedError.message}`;
          }
        }
        else if (fnName === 'list_version_history') {
          const { data, error } = await supabase
            .from('version_history')
            .select('id, entity_type, field_name, previous_value, new_value, changed_by, created_at')
            .eq('user_id', userId)
            .eq('page_id', args.page_id)
            .order('created_at', { ascending: false })
            .limit(args.limit || 10);
            
          if (error) throw error;
          resultStr = data && data.length > 0 ? JSON.stringify(data) : 'No version history logs found for this page connection.';
        }
        else if (fnName === 'revert_to_version') {
          const { data: record, error: recErr } = await supabase
            .from('version_history')
            .select('*')
            .eq('id', args.version_id)
            .eq('user_id', userId)
            .single();
            
          if (recErr || !record) {
            throw new Error(`Version history log not found for ID ${args.version_id}`);
          }
          
          const { entity_type, entity_id, previous_value, field_name } = record;
          
          if (entity_type === 'system_prompt') {
            const { error } = await supabase
              .from('page_connections')
              .update({ custom_system_prompt: previous_value })
              .eq('page_id', args.page_id)
              .eq('user_id', userId);
              
            if (error) throw error;
            resultStr = `Successfully reverted system prompt instructions to: "${previous_value || 'Empty'}"`;
            databaseUpdated = true;
          }
          else if (entity_type === 'quick_answer') {
            if (previous_value === null) {
              const { error } = await supabase
                .from('knowledge_fields')
                .delete()
                .eq('id', entity_id);
                
              if (error) throw error;
              resultStr = `Successfully reverted Quick Answer: deleted '${field_name}' since it was created after this log.`;
            } else {
              const { data: existing } = await supabase
                .from('knowledge_fields')
                .select('id')
                .eq('id', entity_id)
                .maybeSingle();
                
              if (existing) {
                const { error } = await supabase
                  .from('knowledge_fields')
                  .update({ field_value: previous_value })
                  .eq('id', entity_id);
                if (error) throw error;
              } else {
                const { error } = await supabase
                  .from('knowledge_fields')
                  .insert({
                    id: entity_id,
                    user_id: userId,
                    page_id: args.page_id,
                    field_name: field_name,
                    field_value: previous_value,
                    category: 'general'
                  });
                if (error) throw error;
              }
              resultStr = `Successfully reverted Quick Answer '${field_name}' value back to: "${previous_value}"`;
            }
            databaseUpdated = true;
          }
          else if (entity_type === 'document') {
            if (previous_value === null) {
              const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', entity_id);
                
              if (error) throw error;
              resultStr = `Successfully reverted Document: deleted document '${field_name}' since it was created after this log.`;
            } else {
              const { data: existing } = await supabase
                .from('documents')
                .select('id')
                .eq('id', entity_id)
                .maybeSingle();
                
              if (existing) {
                const { error } = await supabase
                  .from('documents')
                  .update({ original_content: previous_value })
                  .eq('id', entity_id);
                if (error) throw error;
                
                const embedProvider = await getActiveEmbeddingProvider(supabase, userId);
                if (embedProvider) {
                  await processDocument(supabase, embedProvider, userId, entity_id, previous_value);
                }
              } else {
                const { data: assign } = await supabase
                  .from('folder_page_assignments')
                  .select('folder_id')
                  .eq('page_id', args.page_id)
                  .limit(1)
                  .maybeSingle();
                  
                if (assign) {
                  const { error } = await supabase
                    .from('documents')
                    .insert({
                      id: entity_id,
                      user_id: userId,
                      folder_id: assign.folder_id,
                      title: field_name || 'Restored Document',
                      original_content: previous_value,
                      source_type: 'text'
                    });
                  if (error) throw error;
                  
                  const embedProvider = await getActiveEmbeddingProvider(supabase, userId);
                  if (embedProvider) {
                    await processDocument(supabase, embedProvider, userId, entity_id, previous_value);
                  }
                }
              }
              resultStr = `Successfully reverted Document '${field_name}' content back to: "${previous_value}"`;
            }
            databaseUpdated = true;
          }
        }
        else {
          resultStr = `Unknown function: ${fnName}`;
        }
      } catch (err: any) {
        console.error(`[Agent] Tool execution error for ${fnName}:`, err);
        resultStr = `Error executing tool: ${err.message}`;
      }

      conversation.push({
        role: 'tool',
        name: fnName,
        content: resultStr,
        tool_call_id: toolCall.id
      });
    }

    loopCount++;
  }

  return {
    message: {
      role: 'assistant',
      content: "I executed the maximum number of automated steps but couldn't get a final response. Please try again."
    },
    databaseUpdated
  };
}
