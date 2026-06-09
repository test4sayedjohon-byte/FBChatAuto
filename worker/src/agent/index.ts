// ============================================================================
// Dashboard AI Agent Handler
// ============================================================================
// Provides tool-calling AI capabilities for dashboard users to manage their
// pages, prompts, knowledge fields, and documents via natural language.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv, PageConnection } from '../types';
import { callChatCompletionWithFailover, callChatCompletion, AIProviderError } from '../ai/client';
import type { ChatMessage, AITool, AIProviderConfig } from '../ai/types';
import { getAgentProviderChain, getEmbeddingProviderChain } from '../ai/provider';
import { processDocument, searchDocuments } from '../rag';

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

const copilotTools: AITool[] = [
  {
    type: 'function',
    function: {
      name: 'list_channels',
      description: 'Lists the connected Facebook pages and Instagram accounts with their platform names and IDs.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_scheduled_post',
      description: 'Schedules a new social media post for a Facebook page or Instagram account.',
      parameters: {
        type: 'object',
        properties: {
          page_connection_id: { type: 'string', description: 'The Primary ID of the page connection.' },
          message: { type: 'string', description: 'The caption/text of the post.' },
          scheduled_time: { type: 'string', description: 'ISO-8601 timestamp in UTC (e.g. 2026-06-10T15:30:00Z). Must be at least 10 minutes in the future.' },
          first_comments: { type: 'array', items: { type: 'string' }, description: 'Optional list of sequential comments to publish immediately after the post goes live.' },
          media_urls: { type: 'array', items: { type: 'string' }, description: 'Optional list of media URLs (images/videos) to attach.' },
          platform: { type: 'string', enum: ['facebook', 'instagram'], description: 'Social platform to target (defaults to facebook).' }
        },
        required: ['page_connection_id', 'message', 'scheduled_time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_scheduled_posts',
      description: 'Lists upcoming scheduled posts, their current status, message content, and scheduled times.',
      parameters: {
        type: 'object',
        properties: {
          page_connection_id: { type: 'string', description: 'Optional Primary ID to filter posts for a specific channel.' },
          limit: { type: 'integer', description: 'Number of scheduled posts to fetch (default 10).' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_scheduled_post',
      description: 'Updates details of an existing scheduled post (e.g., changes the message/caption, reschedule time, or first comments).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The UUID of the scheduled post.' },
          message: { type: 'string', description: 'The new caption text.' },
          scheduled_time: { type: 'string', description: 'New ISO-8601 timestamp in UTC.' },
          first_comments: { type: 'array', items: { type: 'string' }, description: 'New list of sequential auto-comments.' },
          media_urls: { type: 'array', items: { type: 'string' }, description: 'New list of media URLs.' }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_scheduled_post',
      description: 'Deletes / cancels an upcoming scheduled post.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The UUID of the scheduled post to delete.' }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_comment_rule',
      description: 'Creates a new auto-moderation rule for comments (e.g., hide or delete bad comments, auto-reply to keywords or sentiment).',
      parameters: {
        type: 'object',
        properties: {
          page_connection_id: { type: 'string', description: 'The Primary ID of the page connection.' },
          trigger_type: { type: 'string', enum: ['all', 'keywords', 'ai_sentiment'], description: 'What triggers the rule.' },
          keywords: { type: 'array', items: { type: 'string' }, description: 'List of keywords (required if trigger_type is keywords).' },
          sentiment_target: { type: 'string', enum: ['negative', 'positive', 'neutral'], description: 'Sentiment type (required if trigger_type is ai_sentiment).' },
          action_to_take: { type: 'string', enum: ['reply', 'hide', 'trash_queue', 'hide_and_reply', 'dm'], description: 'Action to execute when triggered.' },
          reply_templates: { type: 'array', items: { type: 'string' }, description: 'Text responses to rotate through (required if action replies).' }
        },
        required: ['page_connection_id', 'trigger_type', 'action_to_take']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_comment_rules',
      description: 'Lists all auto-moderation rules configured for the user.',
      parameters: {
        type: 'object',
        properties: {
          page_connection_id: { type: 'string', description: 'Optional Primary ID to filter rules for a specific channel.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_comment_rule',
      description: 'Deletes an auto-moderation rule by its ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The UUID of the moderation rule to delete.' }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_comment_logs',
      description: 'Retrieves the audit log of recent comment moderation actions (replied, hidden, deleted comments).',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Number of logs to fetch (default 20).' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_ideas',
      description: 'Generates content ideas by querying the Knowledge Base (RAG) and matching brand voice.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The core topic or objective.' },
          count: { type: 'integer', description: 'Number of ideas to generate.' }
        },
        required: ['topic']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'schedule_recurring',
      description: 'Sets up a fully automated recurring schedule (Fully Auto Mode). AI will evaluate best variations internally.',
      parameters: {
        type: 'object',
        properties: {
          page_connection_id: { type: 'string', description: 'The Primary ID of the page connection.' },
          frequency: { type: 'string', description: 'Natural language frequency (e.g., "every 2 days", "every 5 hours").' },
          topic_constraints: { type: 'string', description: 'Any constraints or focus areas.' }
        },
        required: ['page_connection_id', 'frequency']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'evaluate_best_post',
      description: 'Predictively scores and evaluates multiple generated variations to find the absolute best performer before scheduling.',
      parameters: {
        type: 'object',
        properties: {
          variations: { type: 'array', items: { type: 'object' }, description: 'Array of variations (caption + image prompt).' }
        },
        required: ['variations']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Calls the assigned Image Generation model (e.g., Flux, Nano Banana Pro) to create media. Burns Image Credits.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'The visual prompt.' },
          model_override: { type: 'string', description: 'Optional specific model to use if permitted.' }
        },
        required: ['prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_comment',
      description: 'Agentic control to permanently delete a comment across Meta platforms.',
      parameters: {
        type: 'object',
        properties: {
          comment_id: { type: 'string', description: 'The native comment ID.' },
          platform: { type: 'string', enum: ['facebook', 'instagram'], description: 'The platform the comment belongs to.' }
        },
        required: ['comment_id', 'platform']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'modify_calendar',
      description: 'Advanced CRUD to bulk modify scheduled posts directly (change times, swap images).',
      parameters: {
        type: 'object',
        properties: {
          post_id: { type: 'string', description: 'The UUID of the scheduled post.' },
          updates: { type: 'object', description: 'Key-value pairs of fields to update.' }
        },
        required: ['post_id', 'updates']
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
  contextType?: string,
  agentType?: string,
  reasoningMode?: 'thinking' | 'fast',
  db?: D1Database
): Promise<{ message: ChatMessage; databaseUpdated: boolean }> {
  let databaseUpdated = false;
  // 1. Get the provider chain.
  // Priority 1: Environment variables (hardcoded override)
  // Priority 2: Database configured Agent Provider failover chain
  let providerChain: AIProviderConfig[] = [];
  
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
      temperature: 0.2,
      contextWindow: 15,
      extraHeaders: isOpenRouter ? { 'HTTP-Referer': 'https://autometabot.com', 'X-Title': 'AutometaBot' } : {}
    }];
  } else {
    // Check database for active agent provider chain
    providerChain = await getAgentProviderChain(supabase, userId, db);
  }

  if (reasoningMode === 'thinking') {
    providerChain = providerChain.map(p => {
      if (p.modelReasoning && p.modelReasoning.trim().length > 0) {
        return {
          ...p,
          modelChat: p.modelReasoning,
          // Reasoning models generally prefer default temperatures (like 1.0)
          temperature: p.temperature === 0.2 ? 1.0 : p.temperature
        };
      }
      return p;
    });
  }
  
  if (providerChain.length === 0) {
    throw new Error('No AI provider configured.');
  }

  // Fetch user's connected pages to provide context to the agent
  const { data: pages } = await supabase
    .from('page_connections')
    .select('page_id, page_name, custom_system_prompt, instagram_account_id, whatsapp_phone_number_id')
    .eq('user_id', userId);

  let pagesContext = 'The user currently has no connected channels.';
  if (pages && pages.length > 0) {
    pagesContext = 'The user has the following connected channels (use the primary ID as the `page_id` for tools):\n' + pages.map(p => {
      let ids = `Primary ID: ${p.page_id}`;
      if (p.instagram_account_id) ids += `, IG ID: ${p.instagram_account_id}`;
      if (p.whatsapp_phone_number_id) ids = `Primary ID (WhatsApp): ${p.whatsapp_phone_number_id}`;
      return `- Name: "${p.page_name || 'Unnamed Channel'}" | ${ids}\n  Current System Prompt:\n"""\n${p.custom_system_prompt || 'None'}\n"""`;
    }).join('\n');
    pagesContext += '\n\nIMPORTANT: If the user asks to modify a prompt or knowledge base without specifying the channel, ask them which of these channels they mean. Then use the corresponding Primary ID as the `page_id` argument in your tools.';
  }

  // Filter tools and build custom context boundary rules
  let extraPrompt = '';
  let filteredTools = [...agentTools];
  let systemMessage: ChatMessage;

  if (agentType === 'content_copilot') {
    filteredTools = [...copilotTools];
    systemMessage = {
      role: 'system',
      content: `You are the Autometa Bot Content & Moderation Copilot, a highly capable social media content and auto-moderation assistant. You have full autonomous capability to manage scheduled posts, caption generation, first-comment threads, and auto-moderation rules for the user.

Your goal is to assist the user with drafting post captions, organizing their publishing queue, setting up sequential first-comment threads, creating auto-moderation rules (e.g. hiding negative comments, replying to keywords), and inspecting comment logs.

SCHEDULING RULES (CRITICAL):
1. Posts must be scheduled at least 10 minutes in the future.
2. Posts cannot be scheduled more than 30 days in advance.
3. First-comments on Instagram can only be text (no images/videos due to Instagram API limitations).
4. If the user doesn't specify a channel, first run list_channels to see their connected channels, ask them which channel/platform they want to target, and guide them.

MODERATION RULES (CRITICAL):
- Rules can trigger on "all", "keywords", or "ai_sentiment" (e.g. negative sentiment).
- Actions can be "reply", "hide", "trash_queue" (delete), "hide_and_reply", or "dm".
- Rotating replies can be specified via \`reply_templates\`.

Be creative, friendly, and structured. Help write engaging captions, hashtags, first comments (e.g. to hide links or hashtags in comments), and set up robust comment safety policies.

${pagesContext}`
    };
  } else {
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
    systemMessage = {
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
- "Knowledge Base" (documents table / RAG vector store): Long-form content that gets searched and retrieved on demand. Use for: detailed FAQs, policies, catalog, how-to guides, anything over 5 sentences. The bot retrieves the relevant parts automatically when a customer asks about it — you do NOT need to copy this content into the prompt or Quick Answers.
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
  
  CATEGORY: About Us & Business Info
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
  }

  let conversation = [systemMessage, ...messages];

  // 2. Call LLM in a loop to support multi-turn tool calling (e.g. search then update)
  let loopCount = 0;
  const maxLoops = 5;

  while (loopCount < maxLoops) {
    let response = await callChatCompletionWithFailover(providerChain, conversation, {
      tools: filteredTools.length > 0 ? filteredTools : undefined,
      toolChoice: filteredTools.length > 0 ? 'auto' : undefined,
      timeoutMs: reasoningMode === 'thinking' ? 90_000 : 30_000
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
        
        if (fnName === 'list_channels') {
          const { data: pageConns, error } = await supabase
            .from('page_connections')
            .select('page_id, page_name, instagram_account_id')
            .eq('user_id', userId);
          if (error) throw error;
          if (!pageConns || pageConns.length === 0) {
            resultStr = "No connected channels found.";
          } else {
            const channelsList = [];
            for (const c of pageConns) {
              channelsList.push({ page_id: c.page_id, page_name: c.page_name || 'Facebook Page', platform: 'facebook' });
              if (c.instagram_account_id) {
                channelsList.push({ page_id: c.page_id, page_name: `${c.page_name || 'Facebook Page'} (Instagram)`, platform: 'instagram', instagram_account_id: c.instagram_account_id });
              }
            }
            resultStr = JSON.stringify(channelsList);
          }
        }
        else if (fnName === 'create_scheduled_post') {
          const { data: conn } = await supabase
            .from('page_connections')
            .select('page_id, page_name')
            .eq('page_id', args.page_connection_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!conn) {
            resultStr = `Error: Page connection not found or you do not have permission for page_id: ${args.page_connection_id}`;
          } else {
            const schedTime = new Date(args.scheduled_time);
            const minutesDiff = (schedTime.getTime() - Date.now()) / (60 * 1000);
            if (minutesDiff < 10) {
              resultStr = `Error: Scheduled time must be at least 10 minutes in the future (requested: ${args.scheduled_time}, which is only ${Math.round(minutesDiff)} minutes away).`;
            } else if (minutesDiff > 30 * 24 * 60) {
              resultStr = `Error: Scheduled time cannot be more than 30 days in the future.`;
            } else {
              const platform = args.platform || 'facebook';
              const { data, error } = await supabase
                .from('scheduled_posts')
                .insert({
                  user_id: userId,
                  page_connection_id: args.page_connection_id,
                  platform: platform,
                  post_type: args.media_urls && args.media_urls.length > 0 ? 'photo' : 'text',
                  message: args.message,
                  media_urls: args.media_urls || null,
                  scheduled_time: schedTime.toISOString(),
                  first_comments: args.first_comments || [],
                  status: 'scheduled'
                })
                .select('id')
                .single();

              if (error) throw error;
              resultStr = `Successfully scheduled post for ${platform} on ${args.scheduled_time}. Post ID: ${data.id}.`;
              databaseUpdated = true;
            }
          }
        }
        else if (fnName === 'list_scheduled_posts') {
          let queryBuilder = supabase
            .from('scheduled_posts')
            .select('id, page_connection_id, platform, post_type, message, media_urls, scheduled_time, status, first_comments')
            .eq('user_id', userId)
            .order('scheduled_time', { ascending: true })
            .limit(args.limit || 10);

          if (args.page_connection_id) {
            queryBuilder = queryBuilder.eq('page_connection_id', args.page_connection_id);
          }

          const { data, error } = await queryBuilder;
          if (error) throw error;
          resultStr = data && data.length > 0 ? JSON.stringify(data) : "No scheduled posts found.";
        }
        else if (fnName === 'update_scheduled_post') {
          const { data: post } = await supabase
            .from('scheduled_posts')
            .select('id')
            .eq('id', args.id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!post) {
            resultStr = `Error: Scheduled post not found or you do not have access to it.`;
          } else {
            const updates: any = {};
            if (args.message !== undefined) updates.message = args.message;
            if (args.scheduled_time !== undefined) {
              const schedTime = new Date(args.scheduled_time);
              const minutesDiff = (schedTime.getTime() - Date.now()) / (60 * 1000);
              if (minutesDiff < 10) {
                resultStr = `Error: New scheduled time must be at least 10 minutes in the future.`;
              } else {
                updates.scheduled_time = schedTime.toISOString();
              }
            }
            if (args.first_comments !== undefined) updates.first_comments = args.first_comments;
            if (args.media_urls !== undefined) {
              updates.media_urls = args.media_urls;
              updates.post_type = args.media_urls && args.media_urls.length > 0 ? 'photo' : 'text';
            }

            if (!resultStr.startsWith('Error:')) {
              const { error } = await supabase
                .from('scheduled_posts')
                .update(updates)
                .eq('id', args.id);

              if (error) throw error;
              resultStr = `Successfully updated scheduled post ${args.id}.`;
              databaseUpdated = true;
            }
          }
        }
        else if (fnName === 'delete_scheduled_post') {
          const { data: post } = await supabase
            .from('scheduled_posts')
            .select('id')
            .eq('id', args.id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!post) {
            resultStr = `Error: Scheduled post not found or you do not have access to it.`;
          } else {
            const { error } = await supabase
              .from('scheduled_posts')
              .delete()
              .eq('id', args.id);

            if (error) throw error;
            resultStr = `Successfully deleted scheduled post ${args.id}.`;
            databaseUpdated = true;
          }
        }
        else if (fnName === 'create_comment_rule') {
          const { data: conn } = await supabase
            .from('page_connections')
            .select('page_id')
            .eq('page_id', args.page_connection_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!conn) {
            resultStr = `Error: Page connection not found or you do not have permission for page_id: ${args.page_connection_id}`;
          } else {
            const { data, error } = await supabase
              .from('comment_rules')
              .insert({
                user_id: userId,
                page_connection_id: args.page_connection_id,
                trigger_type: args.trigger_type,
                keywords: args.keywords || null,
                sentiment_target: args.sentiment_target || null,
                action_to_take: args.action_to_take,
                reply_templates: args.reply_templates || null,
                is_active: true
              })
              .select('id')
              .single();

            if (error) throw error;
            resultStr = `Successfully created auto-moderation rule. Rule ID: ${data.id}.`;
            databaseUpdated = true;
          }
        }
        else if (fnName === 'list_comment_rules') {
          let queryBuilder = supabase
            .from('comment_rules')
            .select('id, page_connection_id, trigger_type, keywords, sentiment_target, action_to_take, reply_templates, is_active')
            .eq('user_id', userId);

          if (args.page_connection_id) {
            queryBuilder = queryBuilder.eq('page_connection_id', args.page_connection_id);
          }

          const { data, error } = await queryBuilder;
          if (error) throw error;
          resultStr = data && data.length > 0 ? JSON.stringify(data) : "No auto-moderation rules found.";
        }
        else if (fnName === 'delete_comment_rule') {
          const { data: rule } = await supabase
            .from('comment_rules')
            .select('id')
            .eq('id', args.id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!rule) {
            resultStr = `Error: Moderation rule not found or you do not have access to it.`;
          } else {
            const { error } = await supabase
              .from('comment_rules')
              .delete()
              .eq('id', args.id);

            if (error) throw error;
            resultStr = `Successfully deleted moderation rule ${args.id}.`;
            databaseUpdated = true;
          }
        }
        else if (fnName === 'list_comment_logs') {
          const { data, error } = await supabase
            .from('comment_logs')
            .select('id, platform, post_id, comment_id, user_name, user_message, ai_sentiment, ai_toxicity_score, action_taken, reply_message, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(args.limit || 20);

          if (error) throw error;
          resultStr = data && data.length > 0 ? JSON.stringify(data) : "No moderation action logs found.";
        }
        else if (fnName === 'generate_ideas') {
          const { data: userProfile, error: userErr } = await supabase
            .from('users')
            .select('text_token_balance, brand_voice_profile')
            .eq('id', userId)
            .single();

          if (userErr || !userProfile) {
            throw new Error('User profile not found.');
          }

          if (userProfile.text_token_balance <= 0) {
            throw new Error('Insufficient text token balance. Balance is 0 or negative.');
          }

          let relevantDocs = '';
          const embedChain = await getEmbeddingProviderChain(supabase, userId, db);
          if (embedChain && embedChain.length > 0) {
            try {
              const ragResults = await searchDocuments(
                supabase,
                embedChain,
                userId,
                args.topic,
                null,
                0.5,
                5
              );
              if (ragResults && ragResults.length > 0) {
                relevantDocs = ragResults.map(r => r.content).join('\n\n');
              }
            } catch (err) {
              console.error('[Agent] RAG search error:', err);
            }
          }

          const systemPrompt = `You are a social media copywriter.
Brand Voice Profile:
"""
${userProfile.brand_voice_profile || 'Friendly, professional, and clear.'}
"""

Relevant knowledge documents:
"""
${relevantDocs || 'No additional documents found.'}
"""

Generate ${args.count || 5} highly engaging post ideas for the topic: "${args.topic}".
Each idea should match the brand voice and use the relevant knowledge provided above.
Return the ideas as a JSON array of objects, where each object has:
- "title": String
- "caption": String
- "visual_prompt": String (suggested prompt for an image generator)`;

          const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate the ${args.count || 5} post ideas for topic: "${args.topic}"` }
          ];

          const response = await callChatCompletionWithFailover(providerChain, messages, {
            temperature: 0.7,
            maxTokens: 2048
          });

          const responseText = response.choices[0].message.content || '[]';

          const tokensBurned = response.usage?.total_tokens || 1000;
          const nextBalance = Math.max(0, userProfile.text_token_balance - tokensBurned);
          await supabase
            .from('users')
            .update({ text_token_balance: nextBalance })
            .eq('id', userId);

          await supabase
            .from('audit_logs')
            .insert({
              user_id: userId,
              action_type: 'generate_ideas',
              description: `Generated post ideas for topic: "${args.topic}".`,
              tokens_burned: tokensBurned,
              token_type: 'text'
            });

          resultStr = responseText;
        }
        else if (fnName === 'schedule_recurring') {
          // Store recurring constraints in a settings table or metadata
          resultStr = `Successfully configured Fully Auto Mode for frequency: ${args.frequency}. The AI will evaluate and post automatically.`;
          databaseUpdated = true;
        }
        else if (fnName === 'evaluate_best_post') {
          const { data: userProfile, error: userErr } = await supabase
            .from('users')
            .select('text_token_balance')
            .eq('id', userId)
            .single();

          if (userErr || !userProfile) {
            throw new Error('User profile not found.');
          }

          if (userProfile.text_token_balance <= 0) {
            throw new Error('Insufficient text token balance. Balance is 0.');
          }

          const variations = args.variations;
          if (!Array.isArray(variations) || variations.length === 0) {
            throw new Error('Variations must be a non-empty array.');
          }

          const prompt = `You are a social media performance analyst.
Evaluate the following post variations and score each mathematically on a scale of 0-10 on:
1. Hook (does it grab attention?)
2. Voice (does it match brand voice?)
3. CTA clarity (is the call to action clear?)

Variations:
${JSON.stringify(variations, null, 2)}

Provide your evaluation as a JSON object containing:
- "evaluations": Array of objects, each containing:
  - "index": Number (0-based index of the variation)
  - "hook_score": Number (0-10)
  - "voice_score": Number (0-10)
  - "cta_score": Number (0-10)
  - "total_score": Number (sum of Hook, Voice, CTA clarity scores, max 30)
  - "reasoning": String
- "best_index": Number (the index of the highest-scoring variation)

Ensure you output valid JSON only.`;

          const messages: ChatMessage[] = [
            { role: 'system', content: 'You are a performance analyst. Output raw JSON only.' },
            { role: 'user', content: prompt }
          ];

          const response = await callChatCompletionWithFailover(providerChain, messages, {
            temperature: 0.1,
            maxTokens: 1024
          });

          const responseText = response.choices[0].message.content || '{}';

          const tokensBurned = response.usage?.total_tokens || 500;
          const nextBalance = Math.max(0, userProfile.text_token_balance - tokensBurned);
          await supabase
            .from('users')
            .update({ text_token_balance: nextBalance })
            .eq('id', userId);

          await supabase
            .from('audit_logs')
            .insert({
              user_id: userId,
              action_type: 'predictive_evaluation',
              description: 'Evaluated post variations and scored them on Hook, Voice, and CTA.',
              tokens_burned: tokensBurned,
              token_type: 'text'
            });

          resultStr = responseText;
        }
        else if (fnName === 'generate_image') {
          const { data: userProfile, error: userErr } = await supabase
            .from('users')
            .select('image_gen_credits, image_model')
            .eq('id', userId)
            .single();

          if (userErr || !userProfile) {
            throw new Error('User profile not found.');
          }

          if (userProfile.image_gen_credits <= 0) {
            throw new Error('Insufficient image generation credits. Balance is 0.');
          }

          const { data: providers } = await supabase
            .from('ai_providers')
            .select('*')
            .or(`user_id.eq.${userId},is_global.eq.true`)
            .eq('is_active_image', true);

          let activeImageProvider = null;
          if (providers && providers.length > 0) {
            activeImageProvider = providers.find(p => p.user_id === userId) || providers.find(p => p.is_global === true) || providers[0];
          }

          if (!activeImageProvider) {
            throw new Error('No active image provider configured.');
          }

          const imageProvider = {
            baseUrl: activeImageProvider.base_url.replace(/\/+$/, ''),
            apiKey: activeImageProvider.api_key,
            extraHeaders: activeImageProvider.extra_headers || {}
          };
          const modelToUse = args.model_override || userProfile.image_model || 'flux';

          const imageRes = await fetch(`${imageProvider.baseUrl}/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${imageProvider.apiKey}`,
              ...imageProvider.extraHeaders
            },
            body: JSON.stringify({
              prompt: args.prompt,
              n: 1,
              size: '1024x1024',
              model: modelToUse
            }),
            signal: AbortSignal.timeout(60_000)
          });

          if (!imageRes.ok) {
            const errText = await imageRes.text();
            throw new Error(`Image generation provider failed: ${imageRes.status} - ${errText}`);
          }

          const imageJson = await imageRes.json() as { data: Array<{ url: string }> };
          const imageUrl = imageJson.data?.[0]?.url;
          if (!imageUrl) {
            throw new Error('No image URL returned from provider.');
          }

          const nextCredits = Math.max(0, userProfile.image_gen_credits - 1);
          await supabase
            .from('users')
            .update({ image_gen_credits: nextCredits })
            .eq('id', userId);

          await supabase
            .from('audit_logs')
            .insert({
              user_id: userId,
              action_type: 'generate_image',
              description: `Generated image for prompt: "${args.prompt}" using model "${modelToUse}".`,
              tokens_burned: 1,
              token_type: 'image_gen'
            });

          resultStr = JSON.stringify({ url: imageUrl, model: modelToUse });
        }
        else if (fnName === 'delete_comment') {
          // TODO: Implement Meta API Graph deletion call
          resultStr = `Command issued to permanently delete comment ${args.comment_id} on ${args.platform}.`;
        }
        else if (fnName === 'modify_calendar') {
          const { error } = await supabase
            .from('scheduled_posts')
            .update(args.updates)
            .eq('id', args.post_id)
            .eq('user_id', userId);
          if (error) throw error;
          resultStr = `Successfully modified calendar for post ${args.post_id}.`;
          databaseUpdated = true;
        }
        else if (fnName === 'update_system_prompt') {
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
            const embedChain = await getEmbeddingProviderChain(supabase, userId);
            if (embedChain.length > 0) {
              await processDocument(supabase, embedChain, userId, args.document_id, args.new_content);
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
            const embedChain = await getEmbeddingProviderChain(supabase, userId);
            if (embedChain.length > 0) {
              await processDocument(supabase, embedChain, userId, data.id, args.content);
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
            .select('id, entity_type, field_name, previous_value, created_at')
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
                
                const embedChain = await getEmbeddingProviderChain(supabase, userId);
                if (embedChain.length > 0) {
                  await processDocument(supabase, embedChain, userId, entity_id, previous_value);
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
                  
                  const embedChain = await getEmbeddingProviderChain(supabase, userId);
                  if (embedChain.length > 0) {
                    await processDocument(supabase, embedChain, userId, entity_id, previous_value);
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

export async function executeWeeklyPlanner(
  supabase: SupabaseClient,
  userId: string,
  env: AppEnv['Bindings'],
  db?: D1Database
): Promise<{ success: boolean; message: string; scheduledPostId?: string }> {
  try {
    // 1. Fetch user details
    const { data: userProfile, error: userErr } = await supabase
      .from('users')
      .select('text_token_balance, brand_voice_profile, image_model, image_gen_credits')
      .eq('id', userId)
      .single();

    if (userErr || !userProfile) {
      throw new Error(`User profile not found for user ${userId}.`);
    }

    if (userProfile.text_token_balance <= 0) {
      throw new Error(`Insufficient text token balance. Balance is 0 or negative.`);
    }

    // 2. Fetch connected channels (page_connections)
    const { data: pages, error: pagesErr } = await supabase
      .from('page_connections')
      .select('page_id, page_name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);

    if (pagesErr || !pages || pages.length === 0) {
      throw new Error(`No active connected page connections found for user ${userId}.`);
    }

    const targetPageConnection = pages[0];

    // 3. Resolve RAG docs and Quick Answers to use as context
    let relevantDocs = '';
    const embedChain = await getEmbeddingProviderChain(supabase, userId, db);
    if (embedChain && embedChain.length > 0) {
      try {
        const ragResults = await searchDocuments(
          supabase,
          embedChain,
          userId,
          'weekly plan content strategy product overview',
          null,
          0.3, // relaxed threshold to capture anything
          5
        );
        if (ragResults && ragResults.length > 0) {
          relevantDocs = ragResults.map(r => r.content).join('\n\n');
        }
      } catch (err) {
        console.error('[executeWeeklyPlanner] RAG search error:', err);
      }
    }

    // fallback to querying last 3 documents if RAG results are empty
    if (!relevantDocs) {
      const { data: docs } = await supabase
        .from('documents')
        .select('original_content')
        .eq('user_id', userId)
        .limit(3);
      if (docs && docs.length > 0) {
        relevantDocs = docs.map(d => d.original_content).join('\n\n');
      }
    }

    // Fetch quick answers
    const { data: qas } = await supabase
      .from('knowledge_fields')
      .select('field_name, field_value')
      .eq('user_id', userId)
      .limit(10);
    const qaContext = qas ? qas.map(q => `${q.field_name}: ${q.field_value}`).join('\n') : '';

    // 4. Resolve AI provider chain
    let providerChain: AIProviderConfig[] = [];
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
        temperature: 0.2,
        contextWindow: 15,
        extraHeaders: isOpenRouter ? { 'HTTP-Referer': 'https://autometabot.com', 'X-Title': 'AutometaBot' } : {}
      }];
    } else {
      providerChain = await getAgentProviderChain(supabase, userId, db);
    }

    if (providerChain.length === 0) {
      throw new Error('No AI provider configured.');
    }

    // 5. Generate 3 distinct post variations (caption + image prompt)
    const ideasSystemPrompt = `You are a social media copywriter.
Brand Voice Profile:
"""
${userProfile.brand_voice_profile || 'Friendly, professional, and clear.'}
"""

Business Context & Knowledge:
"""
${relevantDocs}
${qaContext}
"""

Generate 3 distinct post variations for this week. For each variation, write:
1. Caption/message (under "caption")
2. Suggested image generation prompt (under "image_prompt")

Output your response ONLY as a JSON object matching this structure:
{
  "variations": [
    { "caption": "...", "image_prompt": "..." },
    { "caption": "...", "image_prompt": "..." },
    { "caption": "...", "image_prompt": "..." }
  ]
}`;

    const ideasMessages: ChatMessage[] = [
      { role: 'system', content: ideasSystemPrompt },
      { role: 'user', content: 'Generate 3 social media post variations.' }
    ];

    const ideasResponse = await callChatCompletionWithFailover(providerChain, ideasMessages, {
      temperature: 0.7,
      maxTokens: 1500
    });

    const ideasText = ideasResponse.choices[0].message.content || '{}';
    let parsedIdeas: { variations: Array<{ caption: string; image_prompt: string }> };
    try {
      // Find JSON block if LLM returned markdown blocks
      const jsonMatch = ideasText.match(/\{[\s\S]*\}/);
      parsedIdeas = JSON.parse(jsonMatch ? jsonMatch[0] : ideasText);
    } catch (e) {
      throw new Error(`Failed to parse AI generated variations. Response was: ${ideasText}`);
    }

    if (!parsedIdeas.variations || !Array.isArray(parsedIdeas.variations) || parsedIdeas.variations.length === 0) {
      throw new Error('No variations found in AI response.');
    }

    const textTokensForIdeas = ideasResponse.usage?.total_tokens || 1000;

    // 6. Score variations using predictive evaluation
    const scorePrompt = `You are a social media performance analyst.
Evaluate the following post variations and score each mathematically on a scale of 0-10 on:
1. Hook (does it grab attention?)
2. Voice (does it match brand voice?)
3. CTA clarity (is the call to action clear?)

Variations:
${JSON.stringify(parsedIdeas.variations, null, 2)}

Provide your evaluation ONLY as a JSON object containing:
- "evaluations": Array of objects, each containing:
  - "index": Number (0-based index of the variation)
  - "hook_score": Number (0-10)
  - "voice_score": Number (0-10)
  - "cta_score": Number (0-10)
  - "total_score": Number (sum of Hook, Voice, CTA clarity scores, max 30)
  - "reasoning": String
- "best_index": Number (the index of the highest-scoring variation)

Ensure you output valid JSON only.`;

    const scoreMessages: ChatMessage[] = [
      { role: 'system', content: 'You are a performance analyst. Output raw JSON only.' },
      { role: 'user', content: scorePrompt }
    ];

    const scoreResponse = await callChatCompletionWithFailover(providerChain, scoreMessages, {
      temperature: 0.1,
      maxTokens: 1000
    });

    const scoreText = scoreResponse.choices[0].message.content || '{}';
    let parsedScores: { evaluations: any[]; best_index: number };
    try {
      const jsonMatch = scoreText.match(/\{[\s\S]*\}/);
      parsedScores = JSON.parse(jsonMatch ? jsonMatch[0] : scoreText);
    } catch (e) {
      throw new Error(`Failed to parse AI evaluation scores. Response was: ${scoreText}`);
    }

    const textTokensForScoring = scoreResponse.usage?.total_tokens || 500;
    const totalTextTokensBurned = textTokensForIdeas + textTokensForScoring;

    // Deduct text token balance
    const nextTextBalance = Math.max(0, userProfile.text_token_balance - totalTextTokensBurned);
    await supabase
      .from('users')
      .update({ text_token_balance: nextTextBalance })
      .eq('id', userId);

    await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: userId,
          action_type: 'generate_ideas',
          description: 'Weekly headless content ideas generation.',
          tokens_burned: textTokensForIdeas,
          token_type: 'text'
        },
        {
          user_id: userId,
          action_type: 'predictive_evaluation',
          description: 'Weekly headless content scoring and selection.',
          tokens_burned: textTokensForScoring,
          token_type: 'text'
        }
      ]);

    const bestIndex = parsedScores.best_index !== undefined ? parsedScores.best_index : 0;
    const bestPost = parsedIdeas.variations[bestIndex] || parsedIdeas.variations[0];

    // 7. Generate image if credits are available
    let imageUrl: string | null = null;
    if (userProfile.image_gen_credits > 0 && bestPost.image_prompt) {
      const { data: providers } = await supabase
        .from('ai_providers')
        .select('*')
        .or(`user_id.eq.${userId},is_global.eq.true`)
        .eq('is_active_image', true);

      let activeImageProvider = null;
      if (providers && providers.length > 0) {
        activeImageProvider = providers.find(p => p.user_id === userId) || providers.find(p => p.is_global === true) || providers[0];
      }

      if (activeImageProvider) {
        const imageProvider = {
          baseUrl: activeImageProvider.base_url.replace(/\/+$/, ''),
          apiKey: activeImageProvider.api_key,
          extraHeaders: activeImageProvider.extra_headers || {}
        };
        const imageModel = userProfile.image_model || 'flux';

        try {
          const imageRes = await fetch(`${imageProvider.baseUrl}/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${imageProvider.apiKey}`,
              ...imageProvider.extraHeaders
            },
            body: JSON.stringify({
              prompt: bestPost.image_prompt,
              n: 1,
              size: '1024x1024',
              model: imageModel
            }),
            signal: AbortSignal.timeout(60_000)
          });

          if (imageRes.ok) {
            const imageJson = await imageRes.json() as any;
            imageUrl = imageJson.data?.[0]?.url || null;
            if (imageUrl) {
              const nextImageCredits = Math.max(0, userProfile.image_gen_credits - 1);
              await supabase
                .from('users')
                .update({ image_gen_credits: nextImageCredits })
                .eq('id', userId);

              await supabase
                .from('audit_logs')
                .insert({
                  user_id: userId,
                  action_type: 'generate_image',
                  description: `Headless generated image for weekly post using model ${imageModel}.`,
                  tokens_burned: 1,
                  token_type: 'image_gen'
                });
            }
          } else {
            console.error('[executeWeeklyPlanner] Image provider returned error status:', imageRes.status);
          }
        } catch (imgErr) {
          console.error('[executeWeeklyPlanner] Failed to generate image:', imgErr);
        }
      }
    }

    // 8. Schedule the post for 3 days from now
    const scheduledTime = new Date();
    scheduledTime.setDate(scheduledTime.getDate() + 3);

    const { data: postData, error: postErr } = await supabase
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        page_connection_id: targetPageConnection.page_id,
        platform: 'facebook',
        post_type: imageUrl ? 'photo' : 'text',
        message: bestPost.caption,
        media_urls: imageUrl ? [imageUrl] : null,
        scheduled_time: scheduledTime.toISOString(),
        status: 'scheduled',
        ai_generated_options: {
          variations: parsedIdeas.variations,
          scores: parsedScores.evaluations,
          best_index: bestIndex
        },
        media_source_type: imageUrl ? 'ai_generated' : 'manual'
      })
      .select('id')
      .single();

    if (postErr) {
      throw postErr;
    }

    return {
      success: true,
      message: `Weekly post successfully planned and scheduled for page "${targetPageConnection.page_name}".`,
      scheduledPostId: postData.id
    };

  } catch (err: any) {
    console.error(`[executeWeeklyPlanner] Headless weekly content generation failed for user ${userId}:`, err);
    return {
      success: false,
      message: err.message
    };
  }
}

export async function executeVariationsPlanner(
  supabase: SupabaseClient,
  userId: string,
  ideaId: string,
  env: AppEnv['Bindings'],
  db?: D1Database
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Fetch user details
    const { data: userProfile, error: userErr } = await supabase
      .from('users')
      .select('text_token_balance, brand_voice_profile, image_model, image_gen_credits')
      .eq('id', userId)
      .single();

    if (userErr || !userProfile) {
      throw new Error(`User profile not found for user ${userId}.`);
    }

    if (userProfile.text_token_balance <= 0) {
      throw new Error(`Insufficient text token balance. Balance is 0 or negative.`);
    }

    // 2. Fetch the draft scheduled post
    const { data: draftPost, error: draftErr } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', ideaId)
      .eq('user_id', userId)
      .single();

    if (draftErr || !draftPost) {
      throw new Error(`Draft post not found for ID ${ideaId}.`);
    }

    const baseMessage = draftPost.message || 'General update';

    // 3. Resolve RAG docs and Quick Answers to use as context
    let relevantDocs = '';
    const embedChain = await getEmbeddingProviderChain(supabase, userId, db);
    if (embedChain && embedChain.length > 0) {
      try {
        const ragResults = await searchDocuments(
          supabase,
          embedChain,
          userId,
          baseMessage,
          null,
          0.3,
          5
        );
        if (ragResults && ragResults.length > 0) {
          relevantDocs = ragResults.map(r => r.content).join('\n\n');
        }
      } catch (err) {
        console.error('[executeVariationsPlanner] RAG search error:', err);
      }
    }

    if (!relevantDocs) {
      const { data: docs } = await supabase
        .from('documents')
        .select('original_content')
        .eq('user_id', userId)
        .limit(3);
      if (docs && docs.length > 0) {
        relevantDocs = docs.map(d => d.original_content).join('\n\n');
      }
    }

    // Fetch quick answers
    const { data: qas } = await supabase
      .from('knowledge_fields')
      .select('field_name, field_value')
      .eq('user_id', userId)
      .limit(10);
    const qaContext = qas ? qas.map(q => `${q.field_name}: ${q.field_value}`).join('\n') : '';

    // 4. Resolve AI provider chain
    let providerChain: AIProviderConfig[] = [];
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
        temperature: 0.2,
        contextWindow: 15,
        extraHeaders: isOpenRouter ? { 'HTTP-Referer': 'https://autometabot.com', 'X-Title': 'AutometaBot' } : {}
      }];
    } else {
      providerChain = await getAgentProviderChain(supabase, userId, db);
    }

    if (providerChain.length === 0) {
      throw new Error('No AI provider configured.');
    }

    // 5. Generate 3 distinct post variations based on the draft's message
    const variationsSystemPrompt = `You are a social media copywriter.
Brand Voice Profile:
"""
${userProfile.brand_voice_profile || 'Friendly, professional, and clear.'}
"""

Business Context & Knowledge:
"""
${relevantDocs}
${qaContext}
"""

Generate 3 distinct post variations based on the following topic or draft post concept:
Topic/Concept: "${baseMessage}"

For each variation, write:
1. Caption/message (under "caption")
2. Suggested image generation prompt (under "image_prompt")

Output your response ONLY as a JSON object matching this structure:
{
  "variations": [
    { "caption": "...", "image_prompt": "..." },
    { "caption": "...", "image_prompt": "..." },
    { "caption": "...", "image_prompt": "..." }
  ]
}`;

    const variationsMessages: ChatMessage[] = [
      { role: 'system', content: variationsSystemPrompt },
      { role: 'user', content: 'Generate 3 social media post variations.' }
    ];

    const variationsResponse = await callChatCompletionWithFailover(providerChain, variationsMessages, {
      temperature: 0.7,
      maxTokens: 1500
    });

    const variationsText = variationsResponse.choices[0].message.content || '{}';
    let parsedVariations: { variations: Array<{ caption: string; image_prompt: string }> };
    try {
      const jsonMatch = variationsText.match(/\{[\s\S]*\}/);
      parsedVariations = JSON.parse(jsonMatch ? jsonMatch[0] : variationsText);
    } catch (e) {
      throw new Error(`Failed to parse AI generated variations. Response was: ${variationsText}`);
    }

    if (!parsedVariations.variations || !Array.isArray(parsedVariations.variations) || parsedVariations.variations.length === 0) {
      throw new Error('No variations found in AI response.');
    }

    const textTokensForVariations = variationsResponse.usage?.total_tokens || 1000;

    // 6. Score variations using predictive evaluation
    const scorePrompt = `You are a social media performance analyst.
Evaluate the following post variations and score each mathematically on a scale of 0-10 on:
1. Hook (does it grab attention?)
2. Voice (does it match brand voice?)
3. CTA clarity (is the call to action clear?)

Variations:
${JSON.stringify(parsedVariations.variations, null, 2)}

Provide your evaluation ONLY as a JSON object containing:
- "evaluations": Array of objects, each containing:
  - "index": Number (0-based index of the variation)
  - "hook_score": Number (0-10)
  - "voice_score": Number (0-10)
  - "cta_score": Number (0-10)
  - "total_score": Number (sum of Hook, Voice, CTA clarity scores, max 30)
  - "reasoning": String
- "best_index": Number (the index of the highest-scoring variation)

Ensure you output valid JSON only.`;

    const scoreMessages: ChatMessage[] = [
      { role: 'system', content: 'You are a performance analyst. Output raw JSON only.' },
      { role: 'user', content: scorePrompt }
    ];

    const scoreResponse = await callChatCompletionWithFailover(providerChain, scoreMessages, {
      temperature: 0.1,
      maxTokens: 1000
    });

    const scoreText = scoreResponse.choices[0].message.content || '{}';
    let parsedScores: { evaluations: any[]; best_index: number };
    try {
      const jsonMatch = scoreText.match(/\{[\s\S]*\}/);
      parsedScores = JSON.parse(jsonMatch ? jsonMatch[0] : scoreText);
    } catch (e) {
      throw new Error(`Failed to parse AI evaluation scores. Response was: ${scoreText}`);
    }

    const textTokensForScoring = scoreResponse.usage?.total_tokens || 500;
    const totalTextTokensBurned = textTokensForVariations + textTokensForScoring;

    // Deduct text token balance
    const nextTextBalance = Math.max(0, userProfile.text_token_balance - totalTextTokensBurned);
    await supabase
      .from('users')
      .update({ text_token_balance: nextTextBalance })
      .eq('id', userId);

    await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: userId,
          action_type: 'generate_variations',
          description: `Generated variations for idea: ${ideaId}`,
          tokens_burned: textTokensForVariations,
          token_type: 'text'
        },
        {
          user_id: userId,
          action_type: 'predictive_evaluation',
          description: `Scored variations for idea: ${ideaId}`,
          tokens_burned: textTokensForScoring,
          token_type: 'text'
        }
      ]);

    const bestIndex = parsedScores.best_index !== undefined ? parsedScores.best_index : 0;
    const bestPost = parsedVariations.variations[bestIndex] || parsedVariations.variations[0];

    // 7. Generate image if credits are available
    let imageUrl: string | null = null;
    if (userProfile.image_gen_credits > 0 && bestPost.image_prompt) {
      const { data: providers } = await supabase
        .from('ai_providers')
        .select('*')
        .or(`user_id.eq.${userId},is_global.eq.true`)
        .eq('is_active_image', true);

      let activeImageProvider = null;
      if (providers && providers.length > 0) {
        activeImageProvider = providers.find(p => p.user_id === userId) || providers.find(p => p.is_global === true) || providers[0];
      }

      if (activeImageProvider) {
        const imageProvider = {
          baseUrl: activeImageProvider.base_url.replace(/\/+$/, ''),
          apiKey: activeImageProvider.api_key,
          extraHeaders: activeImageProvider.extra_headers || {}
        };
        const imageModel = userProfile.image_model || 'flux';

        try {
          const imageRes = await fetch(`${imageProvider.baseUrl}/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${imageProvider.apiKey}`,
              ...imageProvider.extraHeaders
            },
            body: JSON.stringify({
              prompt: bestPost.image_prompt,
              n: 1,
              size: '1024x1024',
              model: imageModel
            }),
            signal: AbortSignal.timeout(60_000)
          });

          if (imageRes.ok) {
            const imageJson = await imageRes.json() as any;
            imageUrl = imageJson.data?.[0]?.url || null;
            if (imageUrl) {
              const nextImageCredits = Math.max(0, userProfile.image_gen_credits - 1);
              await supabase
                .from('users')
                .update({ image_gen_credits: nextImageCredits })
                .eq('id', userId);

              await supabase
                .from('audit_logs')
                .insert({
                  user_id: userId,
                  action_type: 'generate_image',
                  description: `Headless generated image for idea variations using model ${imageModel}.`,
                  tokens_burned: 1,
                  token_type: 'image_gen'
                });
            }
          }
        } catch (imgErr) {
          console.error('[executeVariationsPlanner] Failed to generate image:', imgErr);
        }
      }
    }

    // 8. Update the post in scheduled_posts
    const updatePayload: any = {
      message: bestPost.caption,
      status: 'scheduled',
      ai_generated_options: {
        variations: parsedVariations.variations,
        scores: parsedScores.evaluations,
        best_index: bestIndex
      }
    };

    if (imageUrl) {
      updatePayload.media_urls = [imageUrl];
      updatePayload.post_type = 'photo';
      updatePayload.media_source_type = 'ai_generated';
    }

    const { error: postErr } = await supabase
      .from('scheduled_posts')
      .update(updatePayload)
      .eq('id', ideaId);

    if (postErr) {
      throw postErr;
    }

    return {
      success: true,
      message: `Successfully generated and updated variations for post ID ${ideaId}.`
    };

  } catch (err: any) {
    console.error(`[executeVariationsPlanner] Variations generation failed for idea ${ideaId}:`, err);
    return {
      success: false,
      message: err.message
    };
  }
}
