// ============================================================================
// Flow & Automation Engine — Visual DM Flow Runner & State Machine
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection, DMFlow, DMFlowNode, DMFlowEdge, ChatSessionFlow } from '../types';
import { sendFacebookReply, sendFacebookSenderAction, sendFacebookAttachment } from '../facebook';
import { sendWhatsAppReply } from '../whatsapp';
import { storeAssistantMessageFallback, getSessionContextFallback } from '../db';
import { getChatProviderChain, getAllChatProviders } from '../ai/provider';
import { callChatCompletionWithFailover } from '../ai/client';

// Helper: sleep/delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Replaces predefined template variables in a text string.
 */
export function replaceVariables(text: string, stateData: Record<string, any>, senderName?: string | null): string {
  if (!text) return text;
  
  let name = 'there';
  if (senderName) {
    name = senderName.split(' ')[0] || senderName;
  } else if (stateData.first_name) {
    name = stateData.first_name;
  } else if (stateData.name) {
    name = stateData.name;
  }

  const phone = stateData.phone || stateData.phone_number || 'not provided';
  const email = stateData.email || 'not provided';

  // Find last_choice: look for any keys starting with "choice_" and grab the last one
  const choiceKeys = Object.keys(stateData).filter(k => k.startsWith('choice_'));
  const lastChoiceKey = choiceKeys[choiceKeys.length - 1];
  const lastChoice = lastChoiceKey ? stateData[lastChoiceKey] : 'none';

  let resolvedText = text
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{phone\}\}/gi, phone)
    .replace(/\{\{email\}\}/gi, email)
    .replace(/\{\{last_choice\}\}/gi, lastChoice);

  resolvedText = resolvedText.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    if (stateData[trimmedKey] !== undefined && stateData[trimmedKey] !== null) {
      return String(stateData[trimmedKey]);
    }
    return match;
  });

  return resolvedText;
}

/**
 * Sends a Facebook Messenger interactive message with buttons.
 * Supports Generic Template (Image + subtitle + buttons) if mediaUrl is provided.
 */
export async function sendFacebookButtons(
  accessToken: string,
  recipient: { id?: string; comment_id?: string },
  text: string,
  buttons: any[],
  pageId?: string,
  mediaUrl?: string
): Promise<boolean> {
  const url = pageId
    ? `https://graph.facebook.com/v21.0/${pageId}/messages`
    : 'https://graph.facebook.com/v21.0/me/messages';

  let messagePayload: any;

  if (mediaUrl) {
    // Generic Template card (visual image + text + buttons)
    messagePayload = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [
            {
              title: text.length > 80 ? text.substring(0, 77) + '...' : text,
              image_url: mediaUrl,
              subtitle: text.length > 80 ? text : undefined,
              buttons: buttons.map(btn => {
                if (btn.type === 'web_url') {
                  return { type: 'web_url', url: btn.url, title: btn.title };
                } else if (btn.type === 'phone_number') {
                  return { type: 'phone_number', payload: btn.payload, title: btn.title };
                } else {
                  return { type: 'postback', title: btn.title, payload: btn.payload };
                }
              })
            }
          ]
        }
      }
    };
  } else {
    // Standard Button Template
    messagePayload = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons: buttons.map(btn => {
            if (btn.type === 'web_url') {
              return { type: 'web_url', url: btn.url, title: btn.title };
            } else if (btn.type === 'phone_number') {
              return { type: 'phone_number', payload: btn.payload, title: btn.title };
            } else {
              return { type: 'postback', title: btn.title, payload: btn.payload };
            }
          })
        }
      }
    };
  }

  const payload = {
    recipient,
    message: messagePayload,
    messaging_type: 'RESPONSE'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] Facebook buttons send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] Facebook buttons send network error:`, err);
    return false;
  }
}

/**
 * Sends a Facebook Messenger quick reply message.
 */
export async function sendFacebookQuickReplies(
  accessToken: string,
  recipient: { id?: string; comment_id?: string },
  text: string,
  quickReplies: any[],
  pageId?: string
): Promise<boolean> {
  const url = pageId
    ? `https://graph.facebook.com/v21.0/${pageId}/messages`
    : 'https://graph.facebook.com/v21.0/me/messages';

  const payload = {
    recipient,
    messaging_type: 'RESPONSE',
    message: {
      text,
      quick_replies: quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title.substring(0, 20),
        payload: qr.payload
      }))
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] Facebook quick replies send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] Facebook quick replies send network error:`, err);
    return false;
  }
}

/**
 * Sends a WhatsApp Interactive Reply Button message (max 3 buttons).
 */
export async function sendWhatsAppInteractiveButtons(
  phoneNumberId: string,
  accessToken: string,
  recipientPhoneNumber: string,
  text: string,
  buttons: any[]
): Promise<boolean> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhoneNumber,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.slice(0, 3).map(btn => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title.substring(0, 20) }
        }))
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] WhatsApp buttons send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] WhatsApp buttons send network error:`, err);
    return false;
  }
}

/**
 * Sends a WhatsApp Interactive List message (max 10 rows).
 */
export async function sendWhatsAppInteractiveList(
  phoneNumberId: string,
  accessToken: string,
  recipientPhoneNumber: string,
  bodyText: string,
  buttonText: string,
  sections: any[]
): Promise<boolean> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhoneNumber,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText.substring(0, 20),
        sections: sections.map(sec => ({
          title: sec.title.substring(0, 24),
          rows: sec.rows.slice(0, 10).map((row: any) => ({
            id: row.id,
            title: row.title.substring(0, 24),
            description: row.description ? row.description.substring(0, 72) : undefined
          }))
        }))
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[Flow Engine] WhatsApp list send failed:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Flow Engine] WhatsApp list send network error:`, err);
    return false;
  }
}

/**
 * Starts a flow run for a session.
 */
export async function startFlow(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  flowId: string,
  pageConnection: PageConnection,
  recipientId: string,
  commentId?: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Flow Engine] Starting flow ${flowId} for session ${sessionId}`);

  // 1. Fetch flow and all nodes/edges
  const { data: flow, error: fErr } = await supabase.from('dm_flows').select('*').eq('id', flowId).single();
  if (fErr || !flow || !flow.is_active) {
    console.error(`[Flow Engine] Flow ${flowId} not found or inactive`);
    return { success: false, error: 'Flow not found or inactive' };
  }

  const { data: nodes, error: nErr } = await supabase.from('dm_flow_nodes').select('*').eq('flow_id', flowId);
  if (nErr || !nodes || nodes.length === 0) {
    console.error(`[Flow Engine] No nodes found for flow ${flowId}`);
    return { success: false, error: 'No nodes found in flow' };
  }

  const { data: edges } = await supabase.from('dm_flow_edges').select('*').eq('flow_id', flowId);

  // 2. Find start node (node with no incoming edges)
  const incomingNodeIds = new Set((edges || []).map(e => e.target_node_id));
  const startNode = nodes.find(n => !incomingNodeIds.has(n.id)) || nodes[0];

  if (!startNode) {
    console.error(`[Flow Engine] Could not determine starting node`);
    return { success: false, error: 'Could not determine starting node' };
  }

  // 3. Register active flow session in Supabase & D1
  const sessionFlow = {
    session_id: sessionId,
    flow_id: flowId,
    current_node_id: startNode.id,
    state_data: {},
    is_paused: false,
    last_executed_at: new Date().toISOString()
  };

  try {
    await supabase.from('chat_session_flows').upsert(sessionFlow);
  } catch (err) {
    console.warn(`[Failover] Supabase session flow register failed:`, err);
  }

  try {
    await db.prepare(
      `INSERT OR REPLACE INTO chat_session_flows (session_id, flow_id, current_node_id, state_data, is_paused, last_executed_at, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    )
      .bind(sessionId, flowId, startNode.id, '{}', sessionFlow.last_executed_at, sessionFlow.last_executed_at)
      .run();
  } catch (err) {
    console.error(`[D1] D1 session flow register failed:`, err);
  }

  // 4. Force Bot Paused status on chat session so AI chatbot doesn't reply
  try {
    await supabase.from('chat_sessions').update({ bot_paused: true }).eq('id', sessionId);
    await db.prepare(`UPDATE chat_sessions SET bot_paused = 1 WHERE id = ?`).bind(sessionId).run();
  } catch (err) {
    console.error(`[Flow Engine] Error setting session bot_paused:`, err);
  }

  // 5. Execute first node
  return await executeNode(db, supabase, sessionId, startNode.id, pageConnection, recipientId, {}, commentId);
}

/**
 * Executes a single flow node.
 */
export async function executeNode(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  nodeId: string,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any> = {},
  commentId?: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Flow Engine] Executing node ${nodeId} for session ${sessionId}`);

  // Fetch the node and the chat session details in parallel
  const [nodeRes, sessionRes] = await Promise.all([
    supabase.from('dm_flow_nodes').select('*').eq('id', nodeId).single(),
    supabase.from('chat_sessions').select('sender_name').eq('id', sessionId).single()
  ]);

  const node = nodeRes.data;
  if (nodeRes.error || !node) {
    console.error(`[Flow Engine] Node ${nodeId} not found`);
    return { success: false, error: `Node ${nodeId} not found` };
  }
  const senderName = sessionRes.data?.sender_name;

  const flowId = node.flow_id;
  const isWhatsApp = !!pageConnection.whatsapp_phone_number_id && pageConnection.is_whatsapp_active;

  // Recipient for Messenger API calls is ALWAYS the user's PSID (recipientId),
  // except for the very first message started from a comment trigger.
  const recipient = commentId ? { comment_id: commentId } : { id: recipientId };

  // Update current node in DB
  try {
    await supabase.from('chat_session_flows').update({ current_node_id: nodeId, last_executed_at: new Date().toISOString() }).eq('session_id', sessionId);
    await db.prepare(`UPDATE chat_session_flows SET current_node_id = ?, last_executed_at = ? WHERE session_id = ?`)
      .bind(nodeId, new Date().toISOString(), sessionId)
      .run();
  } catch (_) {}

  // Route by type
  switch (node.type) {
    case 'message': {
      const { text, mediaUrl, mediaType } = node.data;
      
      const resolvedText = text ? replaceVariables(text, stateData, senderName) : '';
      const resolvedMediaUrl = mediaUrl ? replaceVariables(mediaUrl, stateData, senderName) : '';
      let sendSuccess = true;
      let lastError: string | undefined;

      const isCommentPrivateReply = !!commentId && !isWhatsApp;

      if (isCommentPrivateReply && resolvedMediaUrl && resolvedText) {
        // Private reply with both image and text -> combine to Generic Template (single message)
        const url = pageConnection.page_id
          ? `https://graph.facebook.com/v21.0/${pageConnection.page_id}/messages`
          : 'https://graph.facebook.com/v21.0/me/messages';

        const payload = {
          recipient: { comment_id: commentId },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'generic',
                elements: [
                  {
                    title: resolvedText.length > 80 ? resolvedText.substring(0, 77) + '...' : resolvedText,
                    image_url: resolvedMediaUrl,
                    subtitle: resolvedText.length > 80 ? resolvedText : undefined
                  }
                ]
              }
            }
          },
          messaging_type: 'RESPONSE'
        };

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${pageConnection.access_token}`
            },
            body: JSON.stringify(payload)
          });
          if (!res.ok) {
            const errText = await res.text();
            console.error(`[Flow Engine] Facebook private template reply failed:`, errText);
            sendSuccess = false;
            lastError = errText;
          }
        } catch (err: any) {
          console.error(`[Flow Engine] Facebook private template reply network error:`, err);
          sendSuccess = false;
          lastError = err.message;
        }
      } else {
        // Send media if configured
        if (resolvedMediaUrl) {
          if (isWhatsApp) {
            const res = await sendWhatsAppReply(
              pageConnection.whatsapp_phone_number_id!,
              pageConnection.access_token,
              recipientId,
              `Attachment: ${resolvedMediaUrl}`
            );
            if (!res.success) {
              sendSuccess = false;
              lastError = res.error;
            }
          } else {
            const res = await sendFacebookAttachment(
              pageConnection.access_token,
              recipient,
              mediaType || 'image',
              resolvedMediaUrl,
              undefined,
              pageConnection.page_id
            );
            if (!res.success) {
              sendSuccess = false;
              lastError = res.error;
            }
          }
        }

        // Send text
        if (resolvedText && sendSuccess) {
          if (isWhatsApp) {
            const res = await sendWhatsAppReply(
              pageConnection.whatsapp_phone_number_id!,
              pageConnection.access_token,
              recipientId,
              resolvedText
            );
            if (!res.success) {
              sendSuccess = false;
              lastError = res.error;
            }
          } else {
            const res = await sendFacebookReply(
              pageConnection.access_token,
              recipient,
              resolvedText,
              pageConnection.page_id
            );
            if (!res.success) {
              sendSuccess = false;
              lastError = res.error;
            }
          }
        }
      }

      // Store in chat history
      try {
        const logText = resolvedMediaUrl 
          ? `${resolvedText || ''} [Media: ${resolvedMediaUrl}]`.trim()
          : resolvedText;
        if (logText) {
          await storeAssistantMessageFallback(
            db,
            supabase,
            sessionId,
            pageConnection.user_id,
            logText,
            null,
            { is_flow_message: true, node_id: nodeId }
          );
        }
      } catch (err) {
        console.error(`[Flow Engine] Failed to store message node in history:`, err);
      }

      if (sendSuccess) {
        // Automatically advance to the default outgoing edge without commentId
        return await advanceFlow(db, supabase, sessionId, nodeId, 'default', pageConnection, recipientId, stateData, undefined);
      } else {
        console.error(`[Flow Engine] Message node sending failed. Ending flow.`);
        await cleanActiveSessionFlow(db, supabase, sessionId);
        return { success: false, error: lastError || 'Failed to send message' };
      }
    }

    case 'interactive': {
      const { text, buttons, quickReplies, whatsappType, whatsappButtons, whatsappList, mediaUrl } = node.data;
      const bodyText = text || 'Please select an option:';
      
      const resolvedBodyText = replaceVariables(bodyText, stateData, senderName);
      const resolvedMediaUrl = mediaUrl ? replaceVariables(mediaUrl, stateData, senderName) : undefined;
      let sendSuccess = true;
      let lastError: string | undefined;

      let optionsLog = '';

      if (isWhatsApp) {
        if (resolvedMediaUrl) {
          // Send visual image card first on WhatsApp
          const res = await sendWhatsAppReply(
            pageConnection.whatsapp_phone_number_id!,
            pageConnection.access_token,
            recipientId,
            `Attachment: ${resolvedMediaUrl}`
          );
          if (!res.success) {
            sendSuccess = false;
            lastError = res.error;
          }
        }

        if (sendSuccess) {
          if (whatsappType === 'list' && whatsappList) {
            const formattedSections = (whatsappList.sections || []).map((sec: any) => ({
              title: replaceVariables(sec.title, stateData, senderName),
              rows: (sec.rows || []).map((row: any) => ({
                id: `FLOW_NODE_ID:${nodeId}:${row.id || row.title}`,
                title: replaceVariables(row.title, stateData, senderName),
                description: row.description ? replaceVariables(row.description, stateData, senderName) : undefined
              }))
            }));
            const res = await sendWhatsAppInteractiveList(
              pageConnection.whatsapp_phone_number_id!,
              pageConnection.access_token,
              recipientId,
              resolvedBodyText,
              whatsappList.buttonText || 'Options',
              formattedSections
            );
            sendSuccess = res;
            if (!res) lastError = 'WhatsApp List Send Failed';
            optionsLog = `\nOptions (List):\n` + formattedSections.map((s: any) => s.title + ': ' + s.rows.map((r: any) => r.title).join(', ')).join('\n');
          } else {
            // Default to reply buttons
            const btns = (whatsappButtons || (buttons || [])).map((b: any, idx: number) => ({
              id: `FLOW_NODE_ID:${nodeId}:${b.payload || b.title || `btn_${idx}`}`,
              title: replaceVariables(b.title, stateData, senderName)
            }));
            const res = await sendWhatsAppInteractiveButtons(
              pageConnection.whatsapp_phone_number_id!,
              pageConnection.access_token,
              recipientId,
              resolvedBodyText,
              btns
            );
            sendSuccess = res;
            if (!res) lastError = 'WhatsApp Buttons Send Failed';
            optionsLog = `\nOptions (Buttons):\n` + btns.map((b: any) => `[${b.title}]`).join(' ');
          }
        }
      } else {
        // Facebook Messenger
        if (quickReplies && quickReplies.length > 0 && !commentId) {
          // Format with payload having node ID prefix to intercept correctly
          const formattedReplies = quickReplies.map((qr: any) => ({
            title: replaceVariables(qr.title, stateData, senderName),
            payload: `FLOW_NODE_ID:${nodeId}:${qr.payload || qr.title}`
          }));
          const res = await sendFacebookQuickReplies(
            pageConnection.access_token,
            recipient,
            resolvedBodyText,
            formattedReplies,
            pageConnection.page_id
          );
          sendSuccess = res;
          if (!res) lastError = 'Facebook Quick Replies Send Failed';
          optionsLog = `\nOptions (Quick Replies):\n` + formattedReplies.map((qr: any) => `[${qr.title}]`).join(' ');
        } else if (quickReplies && quickReplies.length > 0 && commentId) {
          // Comment private reply: translate first 3 quick replies into standard buttons to comply with Meta API validation rules
          const translatedButtons = quickReplies.slice(0, 3).map((qr: any) => ({
            type: 'postback',
            title: replaceVariables(qr.title, stateData, senderName),
            payload: `FLOW_NODE_ID:${nodeId}:${qr.payload || qr.title}`
          }));
          const res = await sendFacebookButtons(
            pageConnection.access_token,
            recipient,
            resolvedBodyText,
            translatedButtons,
            pageConnection.page_id,
            resolvedMediaUrl
          );
          sendSuccess = res;
          if (!res) lastError = 'Facebook Private Reply Buttons Send Failed';
          optionsLog = `\nOptions (Translated Buttons):\n` + translatedButtons.map((btn: any) => `[${btn.title}]`).join(' ');
        } else {
          // Format buttons
          const formattedButtons = (buttons || []).map((btn: any) => {
            if (btn.type === 'web_url') {
              return {
                ...btn,
                title: replaceVariables(btn.title, stateData, senderName)
              };
            }
            return {
              ...btn,
              title: replaceVariables(btn.title, stateData, senderName),
              payload: `FLOW_NODE_ID:${nodeId}:${btn.payload || btn.title}`
            };
          });
          const res = await sendFacebookButtons(
            pageConnection.access_token,
            recipient,
            resolvedBodyText,
            formattedButtons,
            pageConnection.page_id,
            resolvedMediaUrl
          );
          sendSuccess = res;
          if (!res) lastError = 'Facebook Buttons Send Failed';
          optionsLog = `\nOptions (Buttons):\n` + formattedButtons.map((btn: any) => `[${btn.title}]`).join(' ');
        }
      }

      // Store in chat history
      try {
        const mediaLog = resolvedMediaUrl ? ` [Media: ${resolvedMediaUrl}]` : '';
        const logText = `${resolvedBodyText}${mediaLog}${optionsLog}`;
        await storeAssistantMessageFallback(
          db,
          supabase,
          sessionId,
          pageConnection.user_id,
          logText,
          null,
          { is_flow_message: true, node_id: nodeId }
        );
      } catch (err) {
        console.error(`[Flow Engine] Failed to store interactive node in history:`, err);
      }

      if (sendSuccess) {
        return { success: true };
      } else {
        console.error(`[Flow Engine] Interactive node sending failed. Ending flow.`);
        await cleanActiveSessionFlow(db, supabase, sessionId);
        return { success: false, error: lastError || 'Failed to send interactive message' };
      }
    }

    case 'delay': {
      const delaySec = node.data.delaySeconds || 3;
      
      // Simulate typing indicator
      if (!isWhatsApp) {
        await sendFacebookSenderAction(pageConnection.access_token, recipientId, 'typing_on', pageConnection.page_id);
      }
      
      // Delay block execution
      await sleep(delaySec * 1000);
      
      if (!isWhatsApp) {
        await sendFacebookSenderAction(pageConnection.access_token, recipientId, 'typing_off', pageConnection.page_id);
      }

      return await advanceFlow(db, supabase, sessionId, nodeId, 'default', pageConnection, recipientId, stateData, undefined);
    }

    case 'condition': {
      const { conditionKey, conditionValue, conditionOperator } = node.data;
      let matched = false;
      const userVal = stateData[conditionKey || ''] || '';

      if (conditionOperator === 'contains') {
        matched = String(userVal).toLowerCase().includes(String(conditionValue).toLowerCase());
      } else if (conditionOperator === 'exists') {
        matched = userVal !== undefined && userVal !== null && userVal !== '';
      } else {
        // default equals
        matched = String(userVal) === String(conditionValue);
      }

      const handle = matched ? 'true' : 'false';
      return await advanceFlow(db, supabase, sessionId, nodeId, handle, pageConnection, recipientId, stateData, undefined);
    }

    case 'action': {
      const { actionType, actionParams } = node.data;
      console.log(`[Flow Engine] Running action ${actionType} with params`, actionParams);

      if (actionType === 'pause_bot') {
        await supabase.from('chat_sessions').update({ bot_paused: true }).eq('id', sessionId);
        await db.prepare(`UPDATE chat_sessions SET bot_paused = 1 WHERE id = ?`).bind(sessionId).run();
      } else if (actionType === 'resume_bot') {
        await supabase.from('chat_sessions').update({ bot_paused: false }).eq('id', sessionId);
        await db.prepare(`UPDATE chat_sessions SET bot_paused = 0 WHERE id = ?`).bind(sessionId).run();
      } else if (actionType === 'set_attribute' && actionParams) {
        const { key, value } = actionParams;
        stateData[key] = value;
        // Save state data to session flow
        await supabase.from('chat_session_flows').update({ state_data: stateData }).eq('session_id', sessionId);
        await db.prepare(`UPDATE chat_session_flows SET state_data = ? WHERE session_id = ?`)
          .bind(JSON.stringify(stateData), sessionId)
          .run();
      }

      return await advanceFlow(db, supabase, sessionId, nodeId, 'default', pageConnection, recipientId, stateData, undefined);
    }

    case 'ai_route': {
      // Exit flow execution and return control to the chatbot
      console.log(`[Flow Engine] AI Routing reached. Completing flow and resuming AI chatbot`);
      await cleanActiveSessionFlow(db, supabase, sessionId);
      return { success: true };
    }

    case 'capture_input': {
      const { text, captureKey, captureType, validationErrorMessage } = node.data;
      const resolvedText = text ? replaceVariables(text, stateData, senderName) : 'Please reply with details:';
      let sendSuccess = true;
      let lastError: string | undefined;

      // 1. Send the text prompt to the user
      if (isWhatsApp) {
        const res = await sendWhatsAppReply(
          pageConnection.whatsapp_phone_number_id!,
          pageConnection.access_token,
          recipientId,
          resolvedText
        );
        sendSuccess = res.success;
        lastError = res.error;
      } else {
        const res = await sendFacebookReply(
          pageConnection.access_token,
          recipient,
          resolvedText,
          pageConnection.page_id
        );
        sendSuccess = res.success;
        lastError = res.error;
      }

      // Store in chat history
      try {
        await storeAssistantMessageFallback(
          db,
          supabase,
          sessionId,
          pageConnection.user_id,
          resolvedText,
          null,
          { is_flow_message: true, node_id: nodeId, is_capture_input: true }
        );
      } catch (err) {
        console.error(`[Flow Engine] Failed to store capture prompt in history:`, err);
      }

      if (!sendSuccess) {
        console.error(`[Flow Engine] Capture input node sending failed. Ending flow.`);
        await cleanActiveSessionFlow(db, supabase, sessionId);
        return { success: false, error: lastError || 'Failed to send capture prompt' };
      }

      // 2. Pause the active flow session and flag it as waiting for input
      stateData.waiting_for_input = {
        nodeId,
        key: captureKey || 'input',
        type: captureType || 'text',
        errorMessage: validationErrorMessage
      };

      try {
        await supabase
          .from('chat_session_flows')
          .update({ is_paused: true, state_data: stateData })
          .eq('session_id', sessionId);
        await db
          .prepare(`UPDATE chat_session_flows SET is_paused = 1, state_data = ? WHERE session_id = ?`)
          .bind(JSON.stringify(stateData), sessionId)
          .run();
      } catch (err) {
        console.error(`[Flow Engine] Capture input pause save failed:`, err);
      }

      return { success: true };
    }

    case 'lead_webhook': {
      const { webhookUrl } = node.data;
      if (webhookUrl) {
        console.log(`[Flow Engine] Webhook triggered. Posting lead to: ${webhookUrl}`);
        
        // Resolve email/phone
        const email = stateData.email || stateData.email_address || 'not provided';
        const phone = stateData.phone || stateData.phone_number || stateData.whatsapp_num || 'not provided';
        
        // Find captured choices (any state key starting with choice_)
        const choices: Record<string, any> = {};
        for (const key of Object.keys(stateData)) {
          if (key.startsWith('choice_')) {
            choices[key] = stateData[key];
          }
        }

        const platform = pageConnection.whatsapp_phone_number_id && pageConnection.is_whatsapp_active
          ? 'whatsapp'
          : (pageConnection.instagram_account_id ? 'instagram' : 'messenger');

        const payload = {
          session_id: sessionId,
          flow_id: flowId,
          timestamp: new Date().toISOString(),
          name: senderName || stateData.name || 'Facebook User',
          platform,
          phone,
          email,
          choices,
          state_data: stateData
        };

        // Fire and forget (with quick timeout so it doesn't block execution)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!res.ok) {
            console.warn(`[Flow Webhook] Webhook returned status: ${res.status}`);
          }
        } catch (err) {
          clearTimeout(timeoutId);
          console.error(`[Flow Webhook] Webhook post failed:`, err);
        }
      }

      // Advance flow immediately
      return await advanceFlow(db, supabase, sessionId, nodeId, 'default', pageConnection, recipientId, stateData, undefined);
    }

    case 'randomizer': {
      const isPathA = Math.random() < 0.5;
      const handle = isPathA ? 'path_a' : 'path_b';
      console.log(`[Flow Engine] Randomizer split routing to handle: ${handle}`);
      return await advanceFlow(db, supabase, sessionId, nodeId, handle, pageConnection, recipientId, stateData, undefined);
    }

    case 'goto_flow': {
      const { targetFlowId } = node.data;
      if (targetFlowId) {
        console.log(`[Flow Engine] Goto flow transitioning to: ${targetFlowId}`);
        // Fetch new target flow nodes
        const { data: nodes, error: nodeErr } = await supabase
          .from('dm_flow_nodes')
          .select('*')
          .eq('flow_id', targetFlowId);

        if (!nodeErr && nodes && nodes.length > 0) {
          const { data: edges } = await supabase.from('dm_flow_edges').select('*').eq('flow_id', targetFlowId);
          const incomingNodeIds = new Set((edges || []).map(e => e.target_node_id));
          const startNode = nodes.find(n => !incomingNodeIds.has(n.id)) || nodes[0];

          if (startNode) {
            // Update active session flow
            const lastExec = new Date().toISOString();
            await supabase.from('chat_session_flows').upsert({
              session_id: sessionId,
              flow_id: targetFlowId,
              current_node_id: startNode.id,
              state_data: stateData,
              is_paused: false,
              last_executed_at: lastExec
            });

            await db.prepare(
              `INSERT OR REPLACE INTO chat_session_flows (session_id, flow_id, current_node_id, state_data, is_paused, last_executed_at, created_at)
               VALUES (?, ?, ?, ?, 0, ?, ?)`
            )
              .bind(sessionId, targetFlowId, startNode.id, JSON.stringify(stateData), lastExec, lastExec)
              .run();

            // Execute first node of new flow!
            return await executeNode(db, supabase, sessionId, startNode.id, pageConnection, recipientId, stateData, commentId);
          }
        }
      }
      
      // Target flow not configured or invalid, clean up session
      console.warn(`[Flow Engine] Invalid goto flow transition target: ${targetFlowId}`);
      await cleanActiveSessionFlow(db, supabase, sessionId);
      return { success: false, error: `Invalid goto flow target ${targetFlowId}` };
    }

    case 'ai_agent': {
      const { promptInstructions, aiModel } = node.data;
      const resolvedPrompt = promptInstructions 
        ? replaceVariables(promptInstructions, stateData, senderName)
        : 'You are a helpful assistant.';

      const providerChain = await getChatProviderChain(supabase, pageConnection.user_id, db);
      if (!providerChain || providerChain.length === 0) {
        console.error('[Flow Engine] AI Agent node: No AI providers configured.');
        await cleanActiveSessionFlow(db, supabase, sessionId);
        return { success: false, error: 'No AI providers configured' };
      }

      // Load conversation history (past 15 messages)
      let history: any[] = [];
      try {
        const rows = await getSessionContextFallback(db, supabase, sessionId, 15);
        history = [...(rows || [])]
          .reverse()
          .map((row: any) => ({
            role: (row.role === 'human_agent' ? 'assistant' : row.role) as 'user' | 'assistant',
            content: row.content
          }));
      } catch (err) {
        console.warn('[Flow Engine] Failed to load history for AI Agent node, proceeding with prompt only:', err);
      }

      // If a specific model override is requested, apply it
      if (aiModel && providerChain[0]) {
        providerChain[0] = {
          ...providerChain[0],
          modelChat: aiModel
        };
      }

      const messages = [
        { role: 'system', content: resolvedPrompt },
        ...history
      ];

      let reply = "I'm sorry, I couldn't process your request.";
      let lastError: string | undefined;

      try {
        const response = await callChatCompletionWithFailover(providerChain, messages);
        reply = response.choices?.[0]?.message?.content || reply;
      } catch (err: any) {
        console.error('[Flow Engine] AI Agent node LLM call failed:', err);
        lastError = err.message;
      }

      let sendSuccess = true;
      if (isWhatsApp) {
        const res = await sendWhatsAppReply(
          pageConnection.whatsapp_phone_number_id!,
          pageConnection.access_token,
          recipientId,
          reply
        );
        if (!res.success) {
          sendSuccess = false;
          lastError = res.error;
        }
      } else {
        const res = await sendFacebookReply(
          pageConnection.access_token,
          recipient,
          reply,
          pageConnection.page_id
        );
        if (!res.success) {
          sendSuccess = false;
          lastError = res.error;
        }
      }

      // Store in chat history
      try {
        await storeAssistantMessageFallback(
          db,
          supabase,
          sessionId,
          pageConnection.user_id,
          reply,
          null,
          { is_flow_message: true, node_id: nodeId, is_ai_agent: true }
        );
      } catch (err) {
        console.error(`[Flow Engine] Failed to store AI Agent node reply in history:`, err);
      }

      if (sendSuccess) {
        return await advanceFlow(db, supabase, sessionId, nodeId, 'default', pageConnection, recipientId, stateData, undefined);
      } else {
        console.error(`[Flow Engine] AI Agent node sending failed. Ending flow.`);
        await cleanActiveSessionFlow(db, supabase, sessionId);
        return { success: false, error: lastError || 'Failed to send AI Agent reply' };
      }
    }

    default: {
      console.warn(`[Flow Engine] Unknown node type: ${node.type}`);
      await cleanActiveSessionFlow(db, supabase, sessionId);
      return { success: false, error: `Unknown node type ${node.type}` };
    }
  }
}

/**
 * Finds the outgoing edge for a given source node and handle, and executes the target node.
 */
async function advanceFlow(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  sourceNodeId: string,
  handle: string,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any>,
  commentId?: string
): Promise<{ success: boolean; error?: string }> {
  // Query edges
  const { data: edges } = await supabase
    .from('dm_flow_edges')
    .select('target_node_id')
    .eq('source_node_id', sourceNodeId)
    .eq('source_handle', handle);

  const nextEdge = edges?.[0];
  if (nextEdge) {
    return await executeNode(db, supabase, sessionId, nextEdge.target_node_id, pageConnection, recipientId, stateData, commentId);
  } else {
    // No target connection, flow finishes naturally
    console.log(`[Flow Engine] Flow completed. Restoring standard AI controls.`);
    await cleanActiveSessionFlow(db, supabase, sessionId);
    return { success: true };
  }
}

/**
 * Clears the active flow session state and resumes the AI bot.
 */
async function cleanActiveSessionFlow(db: D1Database, supabase: SupabaseClient, sessionId: string): Promise<void> {
  try {
    await supabase.from('chat_session_flows').delete().eq('session_id', sessionId);
    await db.prepare(`DELETE FROM chat_session_flows WHERE session_id = ?`).bind(sessionId).run();
  } catch (_) {}

  try {
    await supabase.from('chat_sessions').update({ bot_paused: false }).eq('id', sessionId);
    await db.prepare(`UPDATE chat_sessions SET bot_paused = 0 WHERE id = ?`).bind(sessionId).run();
  } catch (_) {}
}

/**
 * Handles incoming webhook postback/button interaction to advance active flow.
 */
export async function handleFlowInteraction(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  payload: string,
  pageConnection: PageConnection,
  recipientId: string
): Promise<boolean> {
  // Postback format: FLOW_NODE_ID:[node_id]:[button_value]
  if (!payload.startsWith('FLOW_NODE_ID:')) {
    return false;
  }

  const parts = payload.split(':');
  const currentNodeId = parts[1];
  const value = parts.slice(2).join(':');

  console.log(`[Flow Engine] Intercepted button interaction for node ${currentNodeId}, value: ${value}`);

  // Fetch active session flow
  const { data: activeFlow } = await supabase
    .from('chat_session_flows')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (!activeFlow || activeFlow.current_node_id !== currentNodeId) {
    console.warn(`[Flow Engine] Mismatched flow interaction. Active node is ${activeFlow?.current_node_id || 'none'}, received ${currentNodeId}`);
    return false;
  }

  // Update captured state data with the button tap value
  const stateData = activeFlow.state_data || {};
  stateData[`choice_${currentNodeId}`] = value;

  // Find the edge linked from the clicked button.
  // We search for edges where source_handle matches the value or button payload
  const { data: edges } = await supabase
    .from('dm_flow_edges')
    .select('target_node_id, source_handle')
    .eq('source_node_id', currentNodeId);

  // Match edge target
  const matchedEdge = (edges || []).find(e => e.source_handle === value || e.source_handle === `button_${value}`);
  const targetNodeId = matchedEdge?.target_node_id || edges?.[0]?.target_node_id;

  if (targetNodeId) {
    const res = await executeNode(db, supabase, sessionId, targetNodeId, pageConnection, recipientId, stateData);
    if (!res.success) {
      console.error(`[Flow Engine] Error transitioning in handleFlowInteraction: ${res.error}`);
    }
  } else {
    console.log(`[Flow Engine] No target edge found. Ending flow.`);
    await cleanActiveSessionFlow(db, supabase, sessionId);
  }

  return true;
}

/**
 * Handles text input when a flow is active.
 * If the user types a message that matches one of the button/quick reply options of the current interactive node,
 * we advance the flow accordingly and return true.
 * Otherwise, we return false (allowing standard AI chatbot to process the input).
 */
export async function handleFlowTextInput(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  text: string,
  pageConnection: PageConnection,
  recipientId: string
): Promise<boolean> {
  console.log(`[Flow Engine] Evaluating text input "${text}" for session ${sessionId}`);

  // 1. Fetch active session flow
  const { data: activeFlow, error: fErr } = await supabase
    .from('chat_session_flows')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (fErr || !activeFlow || !activeFlow.current_node_id) {
    return false;
  }

  // Escape keyword check
  const trimmedLower = text.trim().toLowerCase();
  const escapeKeywords = ['exit', 'cancel', 'stop', 'human', 'agent'];
  if (escapeKeywords.includes(trimmedLower)) {
    console.log(`[Flow Engine] Escape keyword "${trimmedLower}" matched. Ending flow.`);
    const currentNodeId = activeFlow.current_node_id;
    await cleanActiveSessionFlow(db, supabase, sessionId);
    const cancelMsg = "Flow stopped. How can I help you?";
    const isWhatsApp = !!pageConnection.whatsapp_phone_number_id && pageConnection.is_whatsapp_active;
    if (isWhatsApp) {
      await sendWhatsAppReply(
        pageConnection.whatsapp_phone_number_id!,
        pageConnection.access_token,
        recipientId,
        cancelMsg
      );
    } else {
      await sendFacebookReply(
        pageConnection.access_token,
        { id: recipientId },
        cancelMsg,
        pageConnection.page_id
      );
    }
    try {
      await storeAssistantMessageFallback(
        db,
        supabase,
        sessionId,
        pageConnection.user_id,
        cancelMsg,
        null,
        { is_flow_message: true, node_id: currentNodeId, is_escape: true }
      );
    } catch (_) {}
    return true;
  }

  const stateData = activeFlow.state_data || {};
  const waitingForInput = stateData.waiting_for_input;

  if (activeFlow.is_paused) {
    if (!waitingForInput) {
      return false;
    }
    
    // We are waiting for text input capture!
    const { nodeId, key, type, errorMessage } = waitingForInput;
    const trimmedText = text.trim();
    let isValid = false;

    if (type === 'email') {
      isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedText);
    } else if (type === 'phone') {
      isValid = /^\+?[0-9\s\-()]{7,20}$/.test(trimmedText);
    } else {
      // 'text'
      isValid = trimmedText.length > 0;
    }

    const isWhatsApp = !!pageConnection.whatsapp_phone_number_id && pageConnection.is_whatsapp_active;
    const recipient = { id: recipientId };

    if (!isValid) {
      const attempts = (waitingForInput.attempts || 0) + 1;

      if (attempts >= 3) {
        const failureMsg = "We couldn't validate your input after 3 attempts. Flow stopped. How can I help you?";
        if (isWhatsApp) {
          await sendWhatsAppReply(
            pageConnection.whatsapp_phone_number_id!,
            pageConnection.access_token,
            recipientId,
            failureMsg
          );
        } else {
          await sendFacebookReply(
            pageConnection.access_token,
            { id: recipientId },
            failureMsg,
            pageConnection.page_id
          );
        }
        await cleanActiveSessionFlow(db, supabase, sessionId);
        try {
          await storeAssistantMessageFallback(
            db,
            supabase,
            sessionId,
            pageConnection.user_id,
            failureMsg,
            null,
            { is_flow_message: true, node_id: nodeId, is_validation_failure: true }
          );
        } catch (_) {}
        return true;
      }

      // Update attempts count in stateData
      stateData.waiting_for_input.attempts = attempts;
      try {
        await supabase
          .from('chat_session_flows')
          .update({ state_data: stateData })
          .eq('session_id', sessionId);
        await db
          .prepare(`UPDATE chat_session_flows SET state_data = ? WHERE session_id = ?`)
          .bind(JSON.stringify(stateData), sessionId)
          .run();
      } catch (err) {
        console.error(`[Flow Engine] Capture input attempts save failed:`, err);
      }

      // Send error message and re-prompt
      const defaultErr = type === 'email' 
        ? "That doesn't look like a valid email. Please try again:" 
        : "That doesn't look like a valid phone number. Please try again:";
      const resolvedError = errorMessage || defaultErr;

      if (isWhatsApp) {
        await sendWhatsAppReply(
          pageConnection.whatsapp_phone_number_id!,
          pageConnection.access_token,
          recipientId,
          resolvedError
        );
      } else {
        await sendFacebookReply(
          pageConnection.access_token,
          recipient,
          resolvedError,
          pageConnection.page_id
        );
      }

      // Store validation error in chat history
      try {
        await storeAssistantMessageFallback(
          db,
          supabase,
          sessionId,
          pageConnection.user_id,
          resolvedError,
          null,
          { is_flow_message: true, node_id: nodeId, is_validation_error: true }
        );
      } catch (_) {}

      return true; // Intercepted, but did not advance (waiting for correction)
    }

    // Input is valid! Save it to stateData
    stateData[key] = trimmedText;
    delete stateData.waiting_for_input;

    // Save stateData and mark as not paused in DB
    try {
      await supabase
        .from('chat_session_flows')
        .update({ is_paused: false, state_data: stateData })
        .eq('session_id', sessionId);
      await db
        .prepare(`UPDATE chat_session_flows SET is_paused = 0, state_data = ? WHERE session_id = ?`)
        .bind(JSON.stringify(stateData), sessionId)
        .run();
    } catch (err) {
      console.error(`[Flow Engine] Capture input save success failed:`, err);
    }

    // Advance flow to default handle
    const res = await advanceFlow(db, supabase, sessionId, nodeId, 'default', pageConnection, recipientId, stateData);
    if (!res.success) {
      console.error(`[Flow Engine] Error advancing after capture input: ${res.error}`);
    }
    return true; // Intercepted and advanced!
  }

  const currentNodeId = activeFlow.current_node_id;

  // 2. Fetch the current node
  const { data: node, error: nErr } = await supabase
    .from('dm_flow_nodes')
    .select('*')
    .eq('id', currentNodeId)
    .single();

  if (nErr || !node || node.type !== 'interactive') {
    return false;
  }

  // 3. Find if the user's text matches any button/quick reply option (case-insensitive)
  const { buttons, quickReplies, whatsappButtons, whatsappList } = node.data;
  const normalizedText = text.trim().toLowerCase();

  let matchedPayload: string | null = null;

  // Check Facebook buttons
  if (buttons && buttons.length > 0) {
    const match = buttons.find((btn: any) => btn.title.trim().toLowerCase() === normalizedText);
    if (match && match.type !== 'web_url') {
      matchedPayload = match.payload || match.title;
    }
  }

  // Check Facebook quick replies
  if (!matchedPayload && quickReplies && quickReplies.length > 0) {
    const match = quickReplies.find((qr: any) => qr.title.trim().toLowerCase() === normalizedText);
    if (match) {
      matchedPayload = match.payload || match.title;
    }
  }

  // Check WhatsApp buttons
  if (!matchedPayload && whatsappButtons && whatsappButtons.length > 0) {
    const match = whatsappButtons.find((btn: any) => btn.title.trim().toLowerCase() === normalizedText);
    if (match) {
      matchedPayload = match.id || match.title;
    }
  }

  // Check WhatsApp list sections
  if (!matchedPayload && whatsappList && whatsappList.sections) {
    for (const sec of whatsappList.sections) {
      const rows = sec.rows || [];
      const match = rows.find((r: any) => r.title.trim().toLowerCase() === normalizedText);
      if (match) {
        matchedPayload = match.id || match.title;
        break;
      }
    }
  }

  if (matchedPayload) {
    console.log(`[Flow Engine] Text input "${text}" matched option payload: ${matchedPayload}`);
    // Simulate button click by forwarding to handleFlowInteraction
    const payloadString = `FLOW_NODE_ID:${currentNodeId}:${matchedPayload}`;
    return await handleFlowInteraction(db, supabase, sessionId, payloadString, pageConnection, recipientId);
  }

  return false;
}
