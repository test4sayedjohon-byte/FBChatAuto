// ─── Inbox / Human Takeover API ─────────────────────────────────────────────

import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { createSupabaseAdmin, getPageConnection } from '../supabase';
import { sendFacebookReply } from '../facebook';
import { sendWhatsAppReply } from '../whatsapp';
import { processDocument } from '../rag';
import { handleAgentChat } from '../agent';
import { generateBulkContent } from '../agent/bulk-generator';
import { verifyAndDeductCredits } from '../credits';
import { processAutopilotConfig } from '../comments/autopilot';
import { runSchedulerJobs } from '../scheduler';
import { sendCommentReply, likeComment, hideComment, deleteComment } from '../comments/meta-api';
import broadcastsRouter from './broadcasts';

const api = new Hono<AppEnv>();

api.route('/broadcasts', broadcastsRouter);

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

// ─── Super Admin Billing/Purchases API ──────────────────────────────────────

api.post('/super-admin/purchases/:id/approve', async (c) => {
  try {
    const purchaseId = c.req.param('id');
    const { adminNotes } = await c.req.json();
    const user = c.get('authUser');
    
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);

    // Verify Super Admin
    const { data: profile } = await supabase.from('users').select('is_super_admin').eq('id', user.id).single();
    if (!profile?.is_super_admin) return c.json({ error: 'Forbidden' }, 403);

    // Get Purchase
    const { data: purchase, error: purchaseErr } = await supabase.from('purchases').select('*').eq('id', purchaseId).single();
    if (purchaseErr || !purchase) return c.json({ error: 'Purchase not found' }, 404);
    if (purchase.status === 'approved') return c.json({ error: 'Already approved' }, 400);

    // Update Purchase
    // Note: The trg_purchase_approval Postgres trigger will automatically update user limits when status becomes 'approved'.
    const { error: updateErr } = await supabase
      .from('purchases')
      .update({ status: 'approved', admin_notes: adminNotes, updated_at: new Date().toISOString() })
      .eq('id', purchaseId);
    
    if (updateErr) throw updateErr;

    // Log to Billing Ledger
    await supabase.from('billing_ledger').insert({
      id: crypto.randomUUID(),
      user_id: purchase.user_id,
      transaction_type: 'purchase_approved',
      amount: purchase.total_amount,
      currency: purchase.currency,
      description: `Purchase ${purchaseId} approved. Channels: +${purchase.channels_count}, Addons: ${purchase.message_addon || ''}`,
      created_at: new Date().toISOString()
    });

    return c.json({ success: true, message: 'Purchase approved, trigger updated limits.' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.post('/super-admin/purchases/:id/reject', async (c) => {
  try {
    const purchaseId = c.req.param('id');
    const { adminNotes } = await c.req.json();
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);
    const { data: profile } = await supabase.from('users').select('is_super_admin').eq('id', user.id).single();
    if (!profile?.is_super_admin) return c.json({ error: 'Forbidden' }, 403);

    const { error: updateErr } = await supabase
      .from('purchases')
      .update({ status: 'rejected', admin_notes: adminNotes, updated_at: new Date().toISOString() })
      .eq('id', purchaseId);
    
    if (updateErr) throw updateErr;

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.post('/super-admin/telegram/setup', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);

    // Verify Super Admin
    const { data: profile } = await supabase
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.is_super_admin) return c.json({ error: 'Forbidden' }, 403);

    // Get Super Admin settings to retrieve the Bot Token
    const { data: superAdmin } = await supabase
      .from('users')
      .select('settings')
      .eq('is_super_admin', true)
      .limit(1)
      .maybeSingle();

    const settings = (superAdmin?.settings || {}) as any;
    const botToken = settings.telegram_bot_token;

    if (!botToken) {
      return c.json({ error: 'Telegram Bot Token not configured in settings.' }, 400);
    }

    // Determine the webhook URL dynamically based on the incoming request origin
    const requestUrl = new URL(c.req.url);
    const webhookUrl = `${requestUrl.protocol}//${requestUrl.host}/webhook-telegram`;
    console.log(`[Telegram Setup] Setting webhook URL to: ${webhookUrl}`);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const result = (await res.json()) as any;

    if (!result.ok) {
      return c.json({ success: false, error: result.description || 'Telegram API returned error' }, 400);
    }

    return c.json({ success: true, message: 'Webhook registered successfully with Telegram', result });
  } catch (error: any) {
    console.error('[Telegram Setup Error]:', error);
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
      await sendFacebookReply(pageConnection.access_token, recipientId, text, pageConnection.page_id);
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
    const { messages, channelId, contextType, agentType, reasoningMode } = await c.req.json();
    const user = c.get('authUser');
    
    if (!user || !user.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const supabase = createSupabaseAdmin(c.env);
    
    // --- Agent Quota Check ---
    const creditRes = await verifyAndDeductCredits(supabase, user.id, 10);
    if (!creditRes.success) {
      return c.json({
        message: {
          role: 'assistant',
          content: "You have reached your monthly AI credit limit. Please upgrade or contact the administrator."
        },
        databaseUpdated: false
      });
    }

    // Log the transaction in audit logs for visibility and daily cap spend checks
    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action_type: 'agent_chat',
        description: 'Agent Copilot chat interaction',
        tokens_burned: 0,
        token_type: 'text'
      });
    } catch (logErr) {
      console.warn('[Agent Chat] Failed to insert audit log record:', logErr);
    }
    
    // Process the chat
    const { message: responseMessage, databaseUpdated } = await handleAgentChat(
      supabase,
      user.id,
      messages,
      c.env,
      channelId,
      contextType,
      agentType,
      reasoningMode,
      c.env.DB
    );
    
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

    // 1. Verify caller is super_admin
    const { data: caller } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (!caller || caller.role !== 'super_admin') {
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

api.get('/page-posts/:pageId', async (c) => {
  try {
    const pageId = c.req.param('pageId');
    const authUser = c.get('authUser');
    
    if (!authUser || !authUser.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const supabase = createSupabaseAdmin(c.env);
    
    // Fetch the page connection to get the access token and verify ownership
    const { data: pageConnection, error } = await supabase
      .from('page_connections')
      .select('access_token, user_id')
      .eq('page_id', pageId)
      .single();
      
    if (error || !pageConnection) {
      return c.json({ error: 'Page connection not found' }, 404);
    }
    
    // Verify tenant ownership
    if (pageConnection.user_id !== authUser.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    // Fetch posts from Facebook Graph API
    const fbUrl = `https://graph.facebook.com/v25.0/${pageId}/posts?fields=id,message,created_time,full_picture&limit=25&access_token=${pageConnection.access_token}`;
    const fbResponse = await fetch(fbUrl);
    
    if (!fbResponse.ok) {
      const errText = await fbResponse.text();
      throw new Error(`Failed to fetch posts from Facebook: ${errText}`);
    }
    
    const fbData = await fbResponse.json() as any;
    const posts = (fbData.data || []).map((post: any) => ({
      id: post.id,
      message: post.message || '[No text]',
      created_time: post.created_time,
      picture: post.full_picture || null
    }));
    
    return c.json({ posts });
  } catch (error: any) {
    console.error('[Fetch Page Posts Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.post('/comment/reply', async (c) => {
  try {
    const { commentId, pageId, message } = await c.req.json();
    const authUser = c.get('authUser');
    
    if (!authUser || !authUser.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const supabase = createSupabaseAdmin(c.env);
    
    // Fetch the page connection to get the access token and verify ownership
    const { data: pageConnection, error } = await supabase
      .from('page_connections')
      .select('access_token, user_id')
      .eq('page_id', pageId)
      .single();
      
    if (error || !pageConnection) {
      return c.json({ error: 'Page connection not found' }, 404);
    }
    
    // Verify tenant ownership
    if (pageConnection.user_id !== authUser.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Call Facebook Graph API to reply
    const result = await sendCommentReply(pageConnection.access_token, commentId, message);

    // Save to comment_logs / update the action_taken, reply_message, and mark as manual
    await supabase.from('comment_logs')
      .update({
        action_taken: 'replied',
        reply_message: message,
        reply_source: 'manual',
      })
      .eq('comment_id', commentId);

    return c.json({ success: true, result });
  } catch (error: any) {
    console.error('[Comment Reply Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.post('/comment/like', async (c) => {
  try {
    const { commentId, pageId } = await c.req.json();
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);
    
    const supabase = createSupabaseAdmin(c.env);
    const { data: pageConnection, error } = await supabase
      .from('page_connections')
      .select('access_token, user_id')
      .eq('page_id', pageId)
      .single();
      
    if (error || !pageConnection) return c.json({ error: 'Page connection not found' }, 404);
    if (pageConnection.user_id !== authUser.id) return c.json({ error: 'Forbidden' }, 403);

    const result = await likeComment(pageConnection.access_token, commentId);
    return c.json({ success: true, result });
  } catch (error: any) {
    console.error('[Comment Like Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.post('/comment/hide', async (c) => {
  try {
    const { commentId, pageId } = await c.req.json();
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);
    
    const supabase = createSupabaseAdmin(c.env);
    const { data: pageConnection, error } = await supabase
      .from('page_connections')
      .select('access_token, user_id')
      .eq('page_id', pageId)
      .single();
      
    if (error || !pageConnection) return c.json({ error: 'Page connection not found' }, 404);
    if (pageConnection.user_id !== authUser.id) return c.json({ error: 'Forbidden' }, 403);

    const result = await hideComment(pageConnection.access_token, commentId);

    await supabase.from('comment_logs')
      .update({ action_taken: 'hidden' })
      .eq('comment_id', commentId);

    return c.json({ success: true, result });
  } catch (error: any) {
    console.error('[Comment Hide Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.post('/comment/delete', async (c) => {
  try {
    const { commentId, pageId } = await c.req.json();
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);
    
    const supabase = createSupabaseAdmin(c.env);
    const { data: pageConnection, error } = await supabase
      .from('page_connections')
      .select('access_token, user_id')
      .eq('page_id', pageId)
      .single();
      
    if (error || !pageConnection) return c.json({ error: 'Page connection not found' }, 404);
    if (pageConnection.user_id !== authUser.id) return c.json({ error: 'Forbidden' }, 403);

    const result = await deleteComment(pageConnection.access_token, commentId);

    await supabase.from('comment_logs')
      .update({ action_taken: 'trashed' })
      .eq('comment_id', commentId);

    return c.json({ success: true, result });
  } catch (error: any) {
    console.error('[Comment Delete Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

api.get('/post-metrics/:postId', async (c) => {
  try {
    const postId = c.req.param('postId');
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);

    // 1. Fetch the post to determine platform, page_connection_id, and verify ownership
    const { data: post, error: postErr } = await supabase
      .from('scheduled_posts')
      .select('platform, page_connection_id, user_id')
      .eq('meta_post_id', postId)
      .maybeSingle();

    if (postErr || !post) {
      return c.json({ error: 'Post record not found in content database' }, 404);
    }

    if (post.user_id !== authUser.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // 2. Fetch the page connection to get the access token
    const { data: pageConnection, error: connErr } = await supabase
      .from('page_connections')
      .select('access_token, instagram_account_id')
      .eq('page_id', post.page_connection_id)
      .eq('user_id', authUser.id) // Hardening to verify the connection is owned by this user
      .single();

    if (connErr || !pageConnection) {
      return c.json({ error: 'Associated Page connection not found' }, 404);
    }

    let metrics = {
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: null as number | null,
      reach: null as number | null,
      engagement: null as number | null
    };

    if (post.platform === 'facebook') {
      // Fetch Facebook Post metrics: likes, comments summary, shares count
      const fbUrl = `https://graph.facebook.com/v25.0/${postId}?fields=shares,likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${pageConnection.access_token}`;
      const res = await fetch(fbUrl);
      if (res.ok) {
        const data = await res.json() as any;
        metrics.shares = data.shares?.count || 0;
        metrics.likes = data.likes?.summary?.total_count || 0;
        metrics.comments = data.comments?.summary?.total_count || 0;
      }

      // Try fetching FB insights if available
      try {
        const insightsUrl = `https://graph.facebook.com/v25.0/${postId}/insights?metric=post_impressions,post_engaged_users&access_token=${pageConnection.access_token}`;
        const insightsRes = await fetch(insightsUrl);
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json() as any;
          if (insightsData.data) {
            insightsData.data.forEach((item: any) => {
              if (item.name === 'post_impressions') {
                metrics.impressions = item.values?.[0]?.value || 0;
              } else if (item.name === 'post_engaged_users') {
                metrics.reach = item.values?.[0]?.value || 0;
              }
            });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch Facebook post insights:', e);
      }
    } else {
      // Instagram Media metrics
      const igUrl = `https://graph.facebook.com/v25.0/${postId}?fields=like_count,comments_count&access_token=${pageConnection.access_token}`;
      const res = await fetch(igUrl);
      if (res.ok) {
        const data = await res.json() as any;
        metrics.likes = data.like_count || 0;
        metrics.comments = data.comments_count || 0;
      }

      // Try fetching IG insights if available
      try {
        const insightsUrl = `https://graph.facebook.com/v25.0/${postId}/insights?metric=impressions,reach,engagement&access_token=${pageConnection.access_token}`;
        const insightsRes = await fetch(insightsUrl);
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json() as any;
          if (insightsData.data) {
            insightsData.data.forEach((item: any) => {
              if (item.name === 'impressions') {
                metrics.impressions = item.values?.[0]?.value || 0;
              } else if (item.name === 'reach') {
                metrics.reach = item.values?.[0]?.value || 0;
              } else if (item.name === 'engagement') {
                metrics.engagement = item.values?.[0]?.value || 0;
              }
            });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch Instagram media insights:', e);
      }
    }

    return c.json({ metrics });
  } catch (error: any) {
    console.error('[Fetch Post Metrics Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ─── Super Admin Global System Prompts API ────────────────────────────────────

api.get('/admin/global-prompts', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);

    // Verify Super Admin
    const { data: profile } = await supabase.from('users').select('is_super_admin, role').eq('id', user.id).single();
    if (!profile?.is_super_admin && profile?.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { data: prompts, error } = await supabase
      .from('global_system_prompts')
      .select('*')
      .order('key', { ascending: true });

    if (error) throw error;
    return c.json({ prompts });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.put('/admin/global-prompts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);

    // Verify Super Admin
    const { data: profile } = await supabase.from('users').select('is_super_admin, role').eq('id', user.id).single();
    if (!profile?.is_super_admin && profile?.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { prompt_text } = body;

    const updates: any = {};
    if (prompt_text !== undefined) updates.prompt_text = prompt_text;

    const { data: prompt, error } = await supabase
      .from('global_system_prompts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return c.json({ success: true, prompt });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ─── Super Admin Content Prompts API ──────────────────────────────────────────

api.get('/admin/content-prompts', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);
    
    // Verify Super Admin
    const { data: profile } = await supabase.from('users').select('is_super_admin, role').eq('id', user.id).single();
    if (!profile?.is_super_admin && profile?.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { data: prompts, error } = await supabase
      .from('system_content_prompts')
      .select('*')
      .order('sequence_order', { ascending: true });

    if (error) throw error;
    return c.json({ prompts });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.post('/admin/content-prompts', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);
    
    // Verify Super Admin
    const { data: profile } = await supabase.from('users').select('is_super_admin, role').eq('id', user.id).single();
    if (!profile?.is_super_admin && profile?.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { title, prompt_text, image_prompt_text, sequence_order, is_active } = body;

    const { data: prompt, error } = await supabase
      .from('system_content_prompts')
      .insert({
        title,
        prompt_text,
        image_prompt_text,
        sequence_order: sequence_order || 0,
        is_active: is_active !== undefined ? is_active : true
      })
      .select('*')
      .single();

    if (error) throw error;
    return c.json({ success: true, prompt });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.put('/admin/content-prompts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);
    
    // Verify Super Admin
    const { data: profile } = await supabase.from('users').select('is_super_admin, role').eq('id', user.id).single();
    if (!profile?.is_super_admin && profile?.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { title, prompt_text, image_prompt_text, sequence_order, is_active } = body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (prompt_text !== undefined) updates.prompt_text = prompt_text;
    if (image_prompt_text !== undefined) updates.image_prompt_text = image_prompt_text;
    if (sequence_order !== undefined) updates.sequence_order = sequence_order;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: prompt, error } = await supabase
      .from('system_content_prompts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return c.json({ success: true, prompt });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.delete('/admin/content-prompts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const supabase = createSupabaseAdmin(c.env);
    
    // Verify Super Admin
    const { data: profile } = await supabase.from('users').select('is_super_admin, role').eq('id', user.id).single();
    if (!profile?.is_super_admin && profile?.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { error } = await supabase
      .from('system_content_prompts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ─── AI Bulk Content Generation Endpoint ──────────────────────────────────────

api.post('/agent/generate-bulk', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { 
      pageConnectionId, 
      count, 
      generateImages, 
      startDate, 
      frequency,
      preset,
      productIds,
      mediaType,
      imageModel,
      aestheticTheme,
      enableMiddleAi,
      addFirstComment,
      publishStatus,
      themeText,
      postsPerDay,
      postTimes
    } = body;
    
    if (!pageConnectionId || !count || !startDate || !frequency) {
      return c.json({ error: 'Missing required parameters: pageConnectionId, count, startDate, frequency' }, 400);
    }

    const supabase = createSupabaseAdmin(c.env);

    const result = await generateBulkContent(
      supabase,
      user.id,
      pageConnectionId,
      parseInt(count),
      !!generateImages,
      startDate,
      frequency,
      c.env,
      {
        preset,
        productIds,
        mediaType,
        imageModel,
        aestheticTheme,
        enableMiddleAi: !!enableMiddleAi,
        addFirstComment: !!addFirstComment,
        publishStatus,
        themeText,
        postsPerDay: postsPerDay ? parseInt(postsPerDay) : 1,
        postTimes: Array.isArray(postTimes) ? postTimes : []
      },
      c.env.DB
    );

    return c.json(result);
  } catch (error: any) {
    console.error('[Generate Bulk Content Error]:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ─── User Bulk Delete Endpoint ────────────────────────────────────────────────

api.post('/agent/delete-bulk', async (c) => {
  try {
    const user = c.get('authUser');
    if (!user || !user.id) return c.json({ error: 'Unauthorized' }, 401);

    const { pageConnectionId, startTime, endTime, platform } = await c.req.json();
    
    if (!startTime || !endTime) {
      return c.json({ error: 'Missing required time range parameters' }, 400);
    }

    const supabase = createSupabaseAdmin(c.env);

    let query = supabase
      .from('scheduled_posts')
      .delete()
      .eq('user_id', user.id)
      .gte('scheduled_time', new Date(startTime).toISOString())
      .lte('scheduled_time', new Date(endTime).toISOString());

    if (pageConnectionId) {
      query = query.eq('page_connection_id', pageConnectionId);
    }
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { error } = await query;

    if (error) throw error;
    
    return c.json({ success: true, message: `Successfully deleted posts in the selected range.` });
  } catch (error: any) {
    console.error('[Bulk Delete Error]:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default api;
