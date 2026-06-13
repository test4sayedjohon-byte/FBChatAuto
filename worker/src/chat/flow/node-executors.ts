import type { D1Database } from '@cloudflare/workers-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection, ExtendedDMFlowNode } from './types';
import { 
  replaceVariables, 
  sendFacebookButtons, 
  sendFacebookQuickReplies, 
  sendFacebookCarousel,
  sendWhatsAppInteractiveButtons, 
  sendWhatsAppInteractiveList 
} from './helpers';
import { sendFacebookReply, sendFacebookSenderAction, sendFacebookAttachment } from '../../facebook';
import { sendWhatsAppReply } from '../../whatsapp';
import { storeAssistantMessageFallback, getSessionContextFallback } from '../../db';
import { 
  getChatProviderChain,
  getAgentProviderChain,
  getSummarizationProviderChain,
  getVisionProviderChain,
  getImageProviderChain
} from '../../ai/provider';
import { callChatCompletionWithFailover } from '../../ai/client';
import { verifyAndDeductCredits } from '../../credits';

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute MESSAGE node
 */
export async function executeMessageNode(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any>,
  senderName: string | null,
  recipient: any,
  isWhatsApp: boolean,
  commentId?: string
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const { text, mediaUrl, mediaType } = node.data;
  
  const resolvedText = text ? replaceVariables(text, stateData, senderName) : '';
  const resolvedMediaUrl = mediaUrl ? replaceVariables(mediaUrl, stateData, senderName) : '';
  let sendSuccess = true;
  let lastError: string | undefined;

  const isCommentPrivateReply = !!commentId && !isWhatsApp;

  if (isCommentPrivateReply && resolvedMediaUrl && resolvedText) {
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
        { is_flow_message: true, node_id: node.id }
      );
    }
  } catch (err) {
    console.error(`[Flow Engine] Failed to store message node in history:`, err);
  }

  if (sendSuccess) {
    return { success: true, targetHandle: 'default' };
  } else {
    return { success: false, error: lastError || 'Failed to send message' };
  }
}

/**
 * Execute INTERACTIVE node
 */
export async function executeInteractiveNode(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any>,
  senderName: string | null,
  recipient: any,
  isWhatsApp: boolean,
  commentId?: string
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const { text, buttons, quickReplies, whatsappType, whatsappButtons, whatsappList, mediaUrl } = node.data;
  const bodyText = text || 'Please select an option:';
  
  const resolvedBodyText = replaceVariables(bodyText, stateData, senderName);
  const resolvedMediaUrl = mediaUrl ? replaceVariables(mediaUrl, stateData, senderName) : undefined;
  let sendSuccess = true;
  let lastError: string | undefined;

  let optionsLog = '';

  if (isWhatsApp) {
    if (resolvedMediaUrl) {
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
            id: `FLOW_NODE_ID:${node.id}:${row.id || row.title}`,
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
        const btns = (whatsappButtons || (buttons || [])).map((b: any, idx: number) => ({
          id: `FLOW_NODE_ID:${node.id}:${b.payload || b.title || `btn_${idx}`}`,
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
      const formattedReplies = quickReplies.map((qr: any) => ({
        title: replaceVariables(qr.title, stateData, senderName),
        payload: `FLOW_NODE_ID:${node.id}:${qr.payload || qr.title}`
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
      const translatedButtons = quickReplies.slice(0, 3).map((qr: any) => ({
        type: 'postback',
        title: replaceVariables(qr.title, stateData, senderName),
        payload: `FLOW_NODE_ID:${node.id}:${qr.payload || qr.title}`
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
          payload: `FLOW_NODE_ID:${node.id}:${btn.payload || btn.title}`
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
      { is_flow_message: true, node_id: node.id }
    );
  } catch (err) {
    console.error(`[Flow Engine] Failed to store interactive node in history:`, err);
  }

  if (sendSuccess) {
    return { success: true };
  } else {
    return { success: false, error: lastError || 'Failed to send interactive message' };
  }
}

/**
 * Execute CAROUSEL node [NEW]
 */
export async function executeCarouselNode(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any>,
  senderName: string | null,
  recipient: any,
  isWhatsApp: boolean
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const elements = node.data.carouselItems || [];
  if (elements.length === 0) {
    return { success: false, error: 'No items configured in Carousel Node' };
  }

  const resolvedElements = elements.map(el => ({
    title: replaceVariables(el.title, stateData, senderName),
    subtitle: el.subtitle ? replaceVariables(el.subtitle, stateData, senderName) : undefined,
    imageUrl: el.imageUrl ? replaceVariables(el.imageUrl, stateData, senderName) : undefined,
    buttons: (el.buttons || []).map(btn => {
      if (btn.type === 'web_url') {
        return {
          type: 'web_url',
          url: replaceVariables(btn.url || '', stateData, senderName),
          title: replaceVariables(btn.title, stateData, senderName)
        };
      }
      return {
        type: 'postback',
        title: replaceVariables(btn.title, stateData, senderName),
        payload: `FLOW_NODE_ID:${node.id}:${btn.payload || btn.title}`
      };
    })
  }));

  let sendSuccess = true;
  let lastError: string | undefined;

  if (isWhatsApp) {
    // WhatsApp list failover: serialize carousel into a WhatsApp List
    const listRows = resolvedElements.map((el, idx) => ({
      id: `FLOW_NODE_ID:${node.id}:${el.buttons?.[0]?.payload || `item_${idx}`}`,
      title: el.title,
      description: el.subtitle
    }));

    const sections = [{ title: 'Available Products', rows: listRows }];
    sendSuccess = await sendWhatsAppInteractiveList(
      pageConnection.whatsapp_phone_number_id!,
      pageConnection.access_token,
      recipientId,
      'Please view our products list:',
      'View Products',
      sections
    );
    if (!sendSuccess) lastError = 'WhatsApp Carousel List Send Failed';
  } else {
    // Facebook Generic Carousel Template
    sendSuccess = await sendFacebookCarousel(
      pageConnection.access_token,
      recipient,
      resolvedElements,
      pageConnection.page_id
    );
    if (!sendSuccess) lastError = 'Facebook Carousel Send Failed';
  }

  // Store in chat history
  try {
    const logText = `[Product Carousel: ${resolvedElements.map(e => e.title).join(', ')}]`;
    await storeAssistantMessageFallback(
      db,
      supabase,
      sessionId,
      pageConnection.user_id,
      logText,
      null,
      { is_flow_message: true, node_id: node.id, is_carousel: true }
    );
  } catch (_) {}

  if (sendSuccess) {
    return { success: true };
  } else {
    return { success: false, error: lastError || 'Failed to send carousel' };
  }
}

/**
 * Execute DELAY node
 */
export async function executeDelayNode(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any>,
  isWhatsApp: boolean
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const delaySec = node.data.delaySeconds !== undefined ? node.data.delaySeconds : 1;
  
  if (!isWhatsApp) {
    await sendFacebookSenderAction(pageConnection.access_token, recipientId, 'typing_on', pageConnection.page_id);
  }
  
  await sleep(delaySec * 1000);
  
  if (!isWhatsApp) {
    await sendFacebookSenderAction(pageConnection.access_token, recipientId, 'typing_off', pageConnection.page_id);
  }

  return { success: true, targetHandle: 'default' };
}

/**
 * Execute CONDITION node
 */
export async function executeConditionNode(
  node: ExtendedDMFlowNode,
  stateData: Record<string, any>
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const { conditionKey, conditionValue } = node.data;
  const conditionOperator = node.data.conditionOperator as any;
  let matched = false;
  const userVal = stateData[conditionKey || ''] || '';

  if (conditionOperator === 'contains') {
    matched = String(userVal).toLowerCase().includes(String(conditionValue).toLowerCase());
  } else if (conditionOperator === 'exists') {
    matched = userVal !== undefined && userVal !== null && userVal !== '';
  } else if (conditionOperator === 'gt') {
    matched = Number(userVal) > Number(conditionValue);
  } else if (conditionOperator === 'lt') {
    matched = Number(userVal) < Number(conditionValue);
  } else if (conditionOperator === 'gte') {
    matched = Number(userVal) >= Number(conditionValue);
  } else if (conditionOperator === 'lte') {
    matched = Number(userVal) <= Number(conditionValue);
  } else {
    matched = String(userVal) === String(conditionValue);
  }

  const handle = matched ? 'true' : 'false';
  return { success: true, targetHandle: handle };
}

/**
 * Execute ACTION node
 */
export async function executeActionNode(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  stateData: Record<string, any>
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
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
    await supabase.from('chat_session_flows').update({ state_data: stateData }).eq('session_id', sessionId);
    await db.prepare(`UPDATE chat_session_flows SET state_data = ? WHERE session_id = ?`)
      .bind(JSON.stringify(stateData), sessionId)
      .run();
  }

  return { success: true, targetHandle: 'default' };
}

/**
 * Execute CAPTURE INPUT node
 */
export async function executeCaptureInputNode(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any>,
  senderName: string | null,
  recipient: any,
  isWhatsApp: boolean
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const { text, captureKey, captureType, validationErrorMessage } = node.data;
  const resolvedText = text ? replaceVariables(text, stateData, senderName) : 'Please reply with details:';
  let sendSuccess = true;
  let lastError: string | undefined;

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
      { is_flow_message: true, node_id: node.id, is_capture_input: true }
    );
  } catch (err) {
    console.error(`[Flow Engine] Failed to store capture prompt in history:`, err);
  }

  if (!sendSuccess) {
    return { success: false, error: lastError || 'Failed to send capture prompt' };
  }

  // Pause active flow session and flag it as waiting for input
  stateData.waiting_for_input = {
    nodeId: node.id,
    key: captureKey || 'input',
    type: captureType || 'text',
    errorMessage: validationErrorMessage
  };

  await supabase
    .from('chat_session_flows')
    .update({ is_paused: true, state_data: stateData })
    .eq('session_id', sessionId);
  await db
    .prepare(`UPDATE chat_session_flows SET is_paused = 1, state_data = ? WHERE session_id = ?`)
    .bind(JSON.stringify(stateData), sessionId)
    .run();

  return { success: true }; // Does not advance immediately, pauses for input
}

/**
 * Execute LEAD WEBHOOK node
 */
export async function executeLeadWebhookNode(
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  sessionId: string,
  stateData: Record<string, any>,
  senderName: string | null
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const { webhookUrl } = node.data;
  if (webhookUrl) {
    console.log(`[Flow Engine] Webhook triggered. Posting lead to: ${webhookUrl}`);
    
    const email = stateData.email || stateData.email_address || 'not provided';
    const phone = stateData.phone || stateData.phone_number || stateData.whatsapp_num || 'not provided';
    
    const choices: Record<string, any> = {};
    for (const key of Object.keys(stateData)) {
      if (key.startsWith('choice_') || key.startsWith('selected_') || key === 'size' || key === 'color') {
        choices[key] = stateData[key];
      }
    }

    const platform = pageConnection.whatsapp_phone_number_id && pageConnection.is_whatsapp_active
      ? 'whatsapp'
      : (pageConnection.instagram_account_id ? 'instagram' : 'messenger');

    const payload = {
      session_id: sessionId,
      flow_id: node.flow_id,
      timestamp: new Date().toISOString(),
      name: senderName || stateData.name || 'Facebook User',
      platform,
      phone,
      email,
      choices,
      state_data: stateData
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

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

  return { success: true, targetHandle: 'default' };
}

/**
 * Execute RANDOMIZER node
 */
export async function executeRandomizerNode(
  node: ExtendedDMFlowNode
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const isPathA = Math.random() < 0.5;
  const handle = isPathA ? 'path_a' : 'path_b';
  return { success: true, targetHandle: handle };
}

/**
 * Execute AI AGENT node
 */
export async function executeAiAgentNode(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any>,
  senderName: string | null,
  isWhatsApp: boolean
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const { promptInstructions, aiModel } = node.data;
  const resolvedPrompt = promptInstructions 
    ? replaceVariables(promptInstructions, stateData, senderName)
    : 'You are a helpful assistant.';

  let providerChain: any[] = [];
  let cost = 1;
  let serviceName = 'Conversational Model';

  if (aiModel === 'agent') {
    providerChain = await getAgentProviderChain(supabase, pageConnection.user_id, db);
    cost = 10;
    serviceName = 'Agent Model';
  } else if (aiModel === 'summarize') {
    providerChain = await getSummarizationProviderChain(supabase, pageConnection.user_id, db);
    cost = 2;
    serviceName = 'Summarization Model';
  } else if (aiModel === 'vision') {
    providerChain = await getVisionProviderChain(supabase, pageConnection.user_id, db);
    cost = 15;
    serviceName = 'Vision Model';
  } else if (aiModel === 'image_gen') {
    providerChain = await getImageProviderChain(supabase, pageConnection.user_id, db);
    cost = 30;
    serviceName = 'Image Generation Model';
  } else {
    // conversational or fallback/default
    providerChain = await getChatProviderChain(supabase, pageConnection.user_id, db);
    cost = 1;
    serviceName = 'Conversational Model';
  }

  // If no providers are configured or service is blocked
  if (!providerChain || providerChain.length === 0) {
    console.error(`[Flow Engine] AI Agent node: service ${serviceName} is unavailable or unauthorized.`);
    const errorMsg = `This service (${serviceName}) is currently unavailable or you do not have permission to use it.`;
    if (isWhatsApp) {
      await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, recipientId, errorMsg);
    } else {
      await sendFacebookReply(pageConnection.access_token, { id: recipientId }, errorMsg, pageConnection.page_id);
    }
    try {
      await storeAssistantMessageFallback(db, supabase, sessionId, pageConnection.user_id, errorMsg, null, {
        is_flow_message: true,
        node_id: node.id,
        ai_agent_error: true
      });
    } catch (_) {}
    return { success: true, targetHandle: 'default' };
  }

  // Deduct credits
  const creditRes = await verifyAndDeductCredits(supabase, pageConnection.user_id, cost);
  if (!creditRes.success) {
    console.warn(`[Flow Engine] Credit check failed for cost ${cost}: ${creditRes.error}`);
    const errorMsg = "System notice: monthly AI response quota exceeded. This action requires more credits.";
    if (isWhatsApp) {
      await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, recipientId, errorMsg);
    } else {
      await sendFacebookReply(pageConnection.access_token, { id: recipientId }, errorMsg, pageConnection.page_id);
    }
    try {
      await storeAssistantMessageFallback(db, supabase, sessionId, pageConnection.user_id, errorMsg, null, {
        is_flow_message: true,
        node_id: node.id,
        quota_exceeded: true
      });
    } catch (_) {}
    return { success: true, targetHandle: 'default' };
  }

  // Image Generation Handler
  if (aiModel === 'image_gen') {
    const activeImageProvider = providerChain[0];
    let modelToUse = 'flux';
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('image_model')
        .eq('id', pageConnection.user_id)
        .maybeSingle();
      if (userProfile && userProfile.image_model) {
        modelToUse = userProfile.image_model;
      }
    } catch (err) {
      console.warn('[Flow Engine] Image model query failed, using flux:', err);
    }

    let imageUrl = '';
    try {
      const imageRes = await fetch(`${activeImageProvider.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeImageProvider.apiKey}`,
          ...activeImageProvider.extraHeaders
        },
        body: JSON.stringify({
          prompt: resolvedPrompt,
          n: 1,
          size: '1024x1024',
          model: modelToUse
        }),
        signal: AbortSignal.timeout(60_000)
      });

      if (!imageRes.ok) {
        throw new Error(`Status ${imageRes.status}: ${await imageRes.text()}`);
      }

      const imageJson = await imageRes.json() as { data: Array<{ url: string }> };
      imageUrl = imageJson.data?.[0]?.url || '';
    } catch (err) {
      console.error('[Flow Engine] Image generation failed:', err);
    }

    if (!imageUrl) {
      const errorMsg = "I'm sorry, I failed to generate the image.";
      if (isWhatsApp) {
        await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, recipientId, errorMsg);
      } else {
        await sendFacebookReply(pageConnection.access_token, { id: recipientId }, errorMsg, pageConnection.page_id);
      }
      return { success: true, targetHandle: 'default' };
    }

    let sendSuccess = true;
    if (isWhatsApp) {
      const res = await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, recipientId, `Here is your generated image: ${imageUrl}`);
      sendSuccess = res.success;
    } else {
      const res = await sendFacebookAttachment(pageConnection.access_token, { id: recipientId }, 'image', imageUrl, undefined, pageConnection.page_id);
      sendSuccess = res.success;
    }

    try {
      await storeAssistantMessageFallback(db, supabase, sessionId, pageConnection.user_id, `[Generated Image: ${imageUrl}]`, null, {
        is_flow_message: true,
        node_id: node.id,
        ai_image_gen: true
      });
    } catch (_) {}

    if (sendSuccess) {
      return { success: true, targetHandle: 'default' };
    } else {
      return { success: false, error: 'AI Agent node image sending failed' };
    }
  }

  // Load chat history context
  let history: any[] = [];
  try {
    const rows = await getSessionContextFallback(db, supabase, sessionId, 15);
    history = [...(rows || [])]
      .reverse()
      .map((row: any) => {
        if (aiModel === 'vision' && row.metadata?.attachment_urls?.length > 0) {
          const contentArray: any[] = [{ type: 'text', text: row.content || '' }];
          for (const url of row.metadata.attachment_urls) {
            contentArray.push({ type: 'image_url', image_url: { url } });
          }
          return {
            role: (row.role === 'human_agent' ? 'assistant' : row.role) as 'user' | 'assistant',
            content: contentArray
          };
        }
        return {
          role: (row.role === 'human_agent' ? 'assistant' : row.role) as 'user' | 'assistant',
          content: row.content
        };
      });
  } catch (err) {
    console.warn('[Flow Engine] Failed to load history for AI Agent node, proceeding with prompt only:', err);
  }

  // Apply model override for backward compatibility
  if (aiModel && providerChain[0]) {
    if (!['conversational', 'agent', 'summarize', 'vision', 'image_gen'].includes(aiModel)) {
      providerChain[0] = {
        ...providerChain[0],
        modelChat: aiModel
      };
    }
  }

  const systemMessage = { role: 'system', content: resolvedPrompt };
  const finalMessages = [systemMessage, ...history];

  let replyText = "I'm sorry, I encountered an error while processing your request.";
  try {
    const res = await callChatCompletionWithFailover(providerChain, finalMessages);
    replyText = res.choices?.[0]?.message?.content || replyText;
  } catch (err) {
    console.error('[Flow Engine] AI Agent API call failed:', err);
  }

  let sendSuccess = true;
  if (isWhatsApp) {
    const res = await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, recipientId, replyText);
    sendSuccess = res.success;
  } else {
    const res = await sendFacebookReply(pageConnection.access_token, { id: recipientId }, replyText, pageConnection.page_id);
    sendSuccess = res.success;
  }

  try {
    await storeAssistantMessageFallback(db, supabase, sessionId, pageConnection.user_id, replyText, null, {
      is_flow_message: true,
      node_id: node.id,
      ai_agent_runner: true
    });
  } catch (_) {}

  if (sendSuccess) {
    return { success: true, targetHandle: 'default' };
  } else {
    return { success: false, error: 'AI Agent node message sending failed' };
  }
}

/**
 * Execute TELEGRAM NOTIFY node [NEW]
 */
export async function executeTelegramNotifyNode(
  supabase: SupabaseClient,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  stateData: Record<string, any>,
  senderName: string | null
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  let token = node.data.telegramBotToken;
  let chat = node.data.telegramChatId;
  const template = node.data.telegramMessageTemplate || 
    '🔔 *New Lead Captured!*\n👤 Name: {{name}}\n📞 Phone: {{phone}}\n✉️ Email: {{email}}';

  // Fallback to super admin or user profile settings if not provided
  if (!token || !chat) {
    const { data: user } = await supabase
      .from('users')
      .select('settings')
      .eq('id', pageConnection.user_id)
      .single();

    if (user && user.settings) {
      token = token || user.settings.telegram_bot_token;
      chat = chat || user.settings.telegram_chat_id || user.settings.telegram_admin_chat_id;
    }
  }

  if (!token || !chat) {
    console.warn('[Flow Engine] Telegram credentials missing. Skipping notification.');
    return { success: true, targetHandle: 'default' }; // Continue flow without throwing error
  }

  const resolvedText = replaceVariables(template, stateData, senderName);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: resolvedText,
        parse_mode: 'Markdown'
      })
    });
    if (!res.ok) {
      console.warn(`[Flow Engine] Telegram API failed with status ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error('[Flow Engine] Telegram post network error:', err);
  }

  return { success: true, targetHandle: 'default' };
}

/**
 * Execute GOOGLE SHEETS node [NEW]
 */
export async function executeGoogleSheetsNode(
  node: ExtendedDMFlowNode,
  stateData: Record<string, any>,
  senderName: string | null
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const webhookUrl = node.data.googleSheetsWebhookUrl;
  if (!webhookUrl) {
    console.warn('[Flow Engine] Google Sheets Webhook URL missing. Skipping.');
    return { success: true, targetHandle: 'default' };
  }

  const columns = node.data.googleSheetsColumns || {
    "Name": "{{name}}",
    "Phone": "{{phone}}",
    "Email": "{{email}}",
    "Timestamp": "{{timestamp}}"
  };

  const payload: Record<string, string> = {};
  const currentTimestamp = new Date().toISOString();
  const stateWithTime = { ...stateData, timestamp: currentTimestamp };

  for (const [colName, tmpl] of Object.entries(columns)) {
    payload[colName] = replaceVariables(tmpl, stateWithTime, senderName);
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn(`[Flow Engine] Google Sheets post returned status ${res.status}`);
    }
  } catch (err) {
    console.error('[Flow Engine] Google Sheets network error:', err);
  }

  return { success: true, targetHandle: 'default' };
}

/**
 * Execute AIRTABLE node [NEW]
 */
export async function executeAirtableNode(
  node: ExtendedDMFlowNode,
  stateData: Record<string, any>,
  senderName: string | null
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const { airtableApiKey, airtableBaseId, airtableTableName, airtableFields } = node.data;

  if (!airtableApiKey || !airtableBaseId || !airtableTableName) {
    console.warn('[Flow Engine] Airtable config incomplete. Skipping.');
    return { success: true, targetHandle: 'default' };
  }

  const fieldsTemplate = airtableFields || {
    "Name": "{{name}}",
    "Phone": "{{phone}}",
    "Email": "{{email}}"
  };

  const fields: Record<string, any> = {};
  const currentTimestamp = new Date().toISOString();
  const stateWithTime = { ...stateData, timestamp: currentTimestamp };

  for (const [fName, tmpl] of Object.entries(fieldsTemplate)) {
    fields[fName] = replaceVariables(tmpl, stateWithTime, senderName);
  }

  const url = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(airtableTableName)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });
    if (!res.ok) {
      console.warn(`[Flow Engine] Airtable post returned status ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error('[Flow Engine] Airtable network error:', err);
  }

  return { success: true, targetHandle: 'default' };
}

/**
 * Execute LEAD CAPTURE node [NEW]
 */
export async function executeLeadCaptureNode(
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  stateData: Record<string, any>,
  senderName: string | null
): Promise<{ success: boolean; error?: string; targetHandle?: string }> {
  const email = stateData.email || stateData.email_address || null;
  const phone = stateData.phone || stateData.phone_number || stateData.whatsapp_num || null;
  const name = senderName || stateData.name || 'Facebook User';

  const productId = node.data.leadProductId || null;
  const status = node.data.leadStatus || 'pending';

  // Custom details capture: gather all captured quick-choices & custom details
  const details: Record<string, any> = { ...node.data.leadCustomDetails };
  for (const key of Object.keys(stateData)) {
    if (key.startsWith('choice_') || key.startsWith('selected_') || key === 'size' || key === 'color' || key === 'quantity') {
      details[key] = stateData[key];
    }
  }

  const platform = pageConnection.whatsapp_phone_number_id && pageConnection.is_whatsapp_active
    ? 'whatsapp'
    : (pageConnection.instagram_account_id ? 'instagram' : 'messenger');

  try {
    const { error } = await supabase
      .from('leads')
      .insert({
        user_id: pageConnection.user_id,
        session_id: sessionId,
        flow_id: node.flow_id,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        platform,
        product_id: productId,
        details,
        status
      });

    if (error) {
      console.error('[Flow Engine] Supabase insert lead error:', error);
    } else {
      console.log('[Flow Engine] Lead successfully captured to PostgreSQL leads table');
    }
  } catch (err) {
    console.error('[Flow Engine] Database lead capture exception:', err);
  }

  return { success: true, targetHandle: 'default' };
}
