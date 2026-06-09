// ─── Inbox / Human Takeover API ─────────────────────────────────────────────

import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { createSupabaseAdmin, getPageConnection } from '../supabase';
import { sendFacebookReply } from '../facebook';
import { sendWhatsAppReply } from '../whatsapp';
import { processDocument } from '../rag';
import { handleAgentChat } from '../agent';
import { processAutopilotConfig } from '../comments/autopilot';
import { runSchedulerJobs } from '../scheduler';

const api = new Hono<AppEnv>();

api.post('/chat/toggle-bot', async (c) => {
  try {
    const { sessionId, botPaused } = await c.req.json();
    const user = c.get('authUser');
    
    if (!user || !user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createSupabaseAdmin(c.env);
    
    // Validate session ownership
    const { data: session } = await supabase.from('chat_sessions').select('user_id').eq('id', sessionId).single();
    if (!session || session.user_id !== user.id) {
      return c.json({ error: 'Session not found or unauthorized' }, 403);
    }
    
    await supabase.from('chat_sessions').update({ bot_paused: botPaused }).eq('id', sessionId);
    
    return c.json({ success: true, botPaused });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.post('/chat/send', async (c) => {
  try {
    const { sessionId, text, pageId, recipientId } = await c.req.json();
    const user = c.get('authUser');
    
    if (!user || !user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createSupabaseAdmin(c.env);

    // 1. Get page connection to get access token AND verify ownership
    const pageConnection = await getPageConnection(supabase, pageId);
    if (!pageConnection || pageConnection.user_id !== user.id) {
      throw new Error('Page not found or unauthorized');
    }

    // 2. Send via Facebook or WhatsApp API
    if (pageConnection.whatsapp_phone_number_id && pageConnection.whatsapp_phone_number_id === pageId) {
      await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id, pageConnection.access_token, recipientId, text);
    } else {
      await sendFacebookReply(pageConnection.access_token, recipientId, text);
    }

    // 3. Save as human agent message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: pageConnection.user_id,
      role: 'human_agent',
      content: text,
      fb_message_id: `manual_${Date.now()}`
    });

    // 4. Fetch existing session metadata to clear trigger flag
    const { data: session } = await supabase.from('chat_sessions').select('metadata').eq('id', sessionId).single();
    const existingMetadata = session?.metadata || {};
    if (existingMetadata.has_trigger) {
      delete existingMetadata.has_trigger;
    }

    // 5. Update session: auto pause bot when human replies
    await supabase.from('chat_sessions').update({ 
      last_message_at: new Date().toISOString(),
      bot_paused: true,
      metadata: existingMetadata
    }).eq('id', sessionId);

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.post('/documents/process', async (c) => {
  try {
    const { documentId, userId } = await c.req.json();
    const authUser = c.get('authUser');
    
    if (!authUser || !authUser.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Prevent cross-tenant operations
    if (userId !== authUser.id) {
      return c.json({ error: 'Unauthorized tenant action' }, 403);
    }

    const supabase = createSupabaseAdmin(c.env);
    
    // 1. Fetch document and verify ownership
    const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single();
    if (!doc || !doc.original_content || doc.user_id !== authUser.id) {
      throw new Error('Document not found, empty, or unauthorized');
    }

    // 2. Get provider chain
    const { getEmbeddingProviderChain } = await import('../ai/provider');
    const providerChain = await getEmbeddingProviderChain(supabase, userId);
    if (providerChain.length === 0) throw new Error('No embedding provider active for this tenant');

    // 3. Process the document
    const result = await processDocument(supabase, providerChain, userId, documentId, doc.original_content);
    
    return c.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Document Process Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.post('/agent/chat', async (c) => {
  try {
    const { messages, channelId, contextType, agentType } = await c.req.json();
    const user = c.get('authUser');
    
    if (!user || !user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const supabase = createSupabaseAdmin(c.env);
    
    // --- Agent Quota Check ---
    const { data: userProfile, error: profileErr } = await supabase
      .from('users')
      .select('agent_monthly_limit, agent_queries_used, agent_extra_queries, agent_usage_month')
      .eq('id', user.id)
      .single();
 
    if (profileErr) throw profileErr;
 
    const currentMonth = new Date().toISOString().slice(0, 7);
    let { agent_monthly_limit = 30, agent_queries_used = 0, agent_extra_queries = 0, agent_usage_month } = userProfile || {};
 
    if (agent_usage_month !== currentMonth) {
      agent_queries_used = 0;
      agent_extra_queries = 0; // Extra queries expire at the end of the month
      agent_usage_month = currentMonth;
    }
 
    if (agent_queries_used < agent_monthly_limit) {
      agent_queries_used++;
    } else if (agent_extra_queries > 0) {
      agent_extra_queries--;
    } else {
      // Limit reached
      return c.json({
        message: {
          role: 'assistant',
          content: "You have reached your monthly AI agent query limit. Please contact the administrator for more queries."
        },
        databaseUpdated: false
      });
    }
 
    // Update DB with new usage
    await supabase.from('users').update({
      agent_queries_used,
      agent_extra_queries,
      agent_usage_month
    }).eq('id', user.id);
    
    // Process the chat
    const { message: responseMessage, databaseUpdated } = await handleAgentChat(supabase, user.id, messages, c.env, channelId, contextType, agentType);
    
    return c.json({ message: responseMessage, databaseUpdated });
  } catch (error: any) {
    console.error('[Agent Chat Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.post('/agent/revert', async (c) => {
  try {
    const { messageId, sessionId, pageId } = await c.req.json();
    const user = c.get('authUser');
    
    if (!user || !user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const supabase = createSupabaseAdmin(c.env);
    
    // 1. Get the target message's created_at timestamp
    const { data: msg, error: msgErr } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('id', messageId)
      .single();
      
    if (msgErr || !msg) {
      return c.json({ error: 'Message not found' }, 404);
    }
    
    const targetTime = msg.created_at;
    
    // 2. Query version_history for all records after targetTime for this page_id
    // Ordered by created_at ASC (earliest first) so we know the state right after targetTime
    let query = supabase
      .from('version_history')
      .select('*')
      .eq('user_id', user.id)
      .gt('created_at', targetTime)
      .order('created_at', { ascending: true });
      
    if (pageId === 'global') {
      query = query.is('page_id', null);
    } else {
      query = query.eq('page_id', pageId);
    }
    
    const { data: history, error: histErr } = await query;
      
    if (histErr) throw histErr;
    
    if (history && history.length > 0) {
      // Group by (entity_type, entity_id) and take the first one (earliest change)
      const earliestChanges: Record<string, typeof history[0]> = {};
      for (const record of history) {
        const key = `${record.entity_type}:${record.entity_id}`;
        if (!earliestChanges[key]) {
          earliestChanges[key] = record;
        }
      }
      
      // Perform rollbacks
      for (const key of Object.keys(earliestChanges)) {
        const record = earliestChanges[key];
        const { entity_type, entity_id, previous_value, field_name } = record;
        
        if (entity_type === 'system_prompt') {
          // Revert system prompt
          if (pageId === 'global') {
            await supabase
              .from('page_connections')
              .update({ custom_system_prompt: previous_value })
              .is('page_id', null)
              .eq('user_id', user.id);
          } else {
            await supabase
              .from('page_connections')
              .update({ custom_system_prompt: previous_value })
              .eq('page_id', pageId)
              .eq('user_id', user.id);
          }
        }
        else if (entity_type === 'quick_answer') {
          if (previous_value === null) {
            // It was inserted after targetTime, so delete it
            await supabase
              .from('knowledge_fields')
              .delete()
              .eq('id', entity_id)
              .eq('user_id', user.id);
          } else {
            // It existed, so restore previous_value
            // Check if it still exists
            const { data: existing } = await supabase
              .from('knowledge_fields')
              .select('id')
              .eq('id', entity_id)
              .maybeSingle();
              
            if (existing) {
              await supabase
                .from('knowledge_fields')
                .update({ field_value: previous_value })
                .eq('id', entity_id);
            } else {
              await supabase
                .from('knowledge_fields')
                .insert({
                  id: entity_id,
                  user_id: user.id,
                  page_id: pageId === 'global' ? null : pageId,
                  field_name: field_name,
                  field_value: previous_value,
                  category: 'general'
                });
            }
          }
        }
        else if (entity_type === 'document') {
          if (previous_value === null) {
            // Delete it
            await supabase
              .from('documents')
              .delete()
              .eq('id', entity_id)
              .eq('user_id', user.id);
          } else {
            // Restore it
            const { data: existing } = await supabase
              .from('documents')
              .select('id')
              .eq('id', entity_id)
              .maybeSingle();
              
            if (existing) {
              await supabase
                .from('documents')
                .update({ original_content: previous_value })
                .eq('id', entity_id);
                
              // Re-process embedding
              const { getEmbeddingProviderChain } = await import('../ai/provider');
              const embedChain = await getEmbeddingProviderChain(supabase, user.id);
              if (embedChain.length > 0) {
                await processDocument(supabase, embedChain, user.id, entity_id, previous_value);
              }
            } else {
              // Re-insert it
              let assignPageId = pageId;
              if (pageId === 'global') {
                // If global, we just need ANY folder. Let's get the first one for this user
                const { data: assign } = await supabase
                  .from('document_folders')
                  .select('id')
                  .eq('user_id', user.id)
                  .limit(1)
                  .maybeSingle();
                
                if (assign) {
                  await supabase
                    .from('documents')
                    .insert({
                      id: entity_id,
                      user_id: user.id,
                      folder_id: assign.id,
                      title: field_name || 'Restored Document',
                      original_content: previous_value,
                      source_type: 'text'
                    });
                    
                  const { getEmbeddingProviderChain } = await import('../ai/provider');
                  const embedChain = await getEmbeddingProviderChain(supabase, user.id);
                  if (embedChain.length > 0) {
                    await processDocument(supabase, embedChain, user.id, entity_id, previous_value);
                  }
                }
              } else {
                const { data: assign } = await supabase
                  .from('folder_page_assignments')
                  .select('folder_id')
                  .eq('page_id', pageId)
                  .limit(1)
                  .maybeSingle();
                  
                if (assign) {
                  await supabase
                    .from('documents')
                    .insert({
                      id: entity_id,
                      user_id: user.id,
                      folder_id: assign.folder_id,
                      title: field_name || 'Restored Document',
                      original_content: previous_value,
                      source_type: 'text'
                    });
                    
                  const { getEmbeddingProviderChain } = await import('../ai/provider');
                  const embedChain = await getEmbeddingProviderChain(supabase, user.id);
                  if (embedChain.length > 0) {
                    await processDocument(supabase, embedChain, user.id, entity_id, previous_value);
                  }
                }
              }
            }
          }
        }
      }
      
      // 3. Delete the version_history entries after targetTime
      let delQuery = supabase
        .from('version_history')
        .delete()
        .eq('user_id', user.id)
        .gt('created_at', targetTime);
        
      if (pageId === 'global') {
        delQuery = delQuery.is('page_id', null);
      } else {
        delQuery = delQuery.eq('page_id', pageId);
      }
      
      await delQuery;
    }
    
    // 4. Delete all chat_messages in this session created after targetTime
    await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId)
      .gt('created_at', targetTime);
      
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Agent Revert Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ─── Admin Impersonation ────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = { user: 0, admin: 1, super_admin: 2 };

api.post('/admin/impersonate', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser?.id) return c.json({ error: 'Unauthorized' }, 401);

    const { targetEmail, redirectTo } = await c.req.json();
    if (!targetEmail) return c.json({ error: 'Missing targetEmail' }, 400);

    const supabase = createSupabaseAdmin(c.env);

    // 1. Verify caller is admin or super_admin
    const { data: caller } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    // 2. Get target user and check privilege escalation
    const { data: target } = await supabase
      .from('users')
      .select('id, role, email')
      .eq('email', targetEmail)
      .single();

    if (!target) return c.json({ error: 'Target user not found' }, 404);

    const callerLevel = ROLE_HIERARCHY[caller.role] ?? 0;
    const targetLevel = ROLE_HIERARCHY[target.role] ?? 0;

    if (targetLevel >= callerLevel) {
      return c.json({
        error: `Cannot impersonate a user with equal or higher role (${target.role})`
      }, 403);
    }

    // 3. Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
      options: {
        redirectTo: redirectTo || 'https://autofb.junoverseai.com',
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[Impersonate] Magic link generation failed:', linkError);
      return c.json({ error: 'Failed to generate login link' }, 500);
    }

    // 4. Log to audit trail
    await supabase.from('admin_audit_log').insert({
      admin_id: authUser.id,
      target_id: target.id,
      action: 'impersonate',
      details: { target_email: targetEmail, target_role: target.role },
    });

    return c.json({
      success: true,
      link: linkData.properties.action_link,
      targetEmail,
    });
  } catch (error: any) {
    console.error('[Impersonate] Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.post('/autopilot-config', async (c) => {
  try {
    const { userId, message } = await c.req.json();
    const authUser = c.get('authUser');
    
    if (!authUser || !authUser.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const tenantId = userId || authUser.id;
    const supabase = createSupabaseAdmin(c.env);
    
    const result = await processAutopilotConfig(supabase, tenantId, message, c.env.DB);
    return c.json(result);
  } catch (error: any) {
    console.error('[Autopilot Route Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.post('/scheduler/run', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const supabase = createSupabaseAdmin(c.env);
    await runSchedulerJobs(supabase);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Scheduler Route Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default api;
