import type { D1Database } from '@cloudflare/workers-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection, ExtendedDMFlowNode } from './types';
import { executeNode, advanceFlow, cleanActiveSessionFlow } from './engine';
import { sendFacebookReply } from '../../facebook';
import { sendWhatsAppReply } from '../../whatsapp';
import { storeAssistantMessageFallback } from '../../db';

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
  if (!payload.startsWith('FLOW_NODE_ID:')) {
    return false;
  }

  const parts = payload.split(':');
  const currentNodeId = parts[1];
  const value = parts.slice(2).join(':');

  console.log(`[Flow Engine] Intercepted button/postback interaction for node ${currentNodeId}, value: ${value}`);

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

  // Save option selection to custom variableName if configured [NEW]
  try {
    const { data: node } = await supabase
      .from('dm_flow_nodes')
      .select('data')
      .eq('id', currentNodeId)
      .single();

    const variableName = node?.data?.variableName;
    if (variableName) {
      stateData[variableName] = value;
      console.log(`[Flow Engine] Custom variable saved: ${variableName} = ${value}`);
    }
  } catch (err) {
    console.error(`[Flow Engine] Failed to fetch custom variableName:`, err);
  }

  // Update chat session flow state
  try {
    await supabase.from('chat_session_flows').update({ state_data: stateData }).eq('session_id', sessionId);
    await db.prepare(`UPDATE chat_session_flows SET state_data = ? WHERE session_id = ?`)
      .bind(JSON.stringify(stateData), sessionId)
      .run();
  } catch (_) {}

  // Sync to permanent chat session metadata
  await syncSessionMetadata(db, supabase, sessionId, stateData);

  // Find the edge linked from the clicked button.
  const { data: edges } = await supabase
    .from('dm_flow_edges')
    .select('target_node_id, source_handle')
    .eq('source_node_id', currentNodeId);

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
 * we advance the flow accordingly. Otherwise, we return false (allowing standard AI chatbot to process the input).
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

  const stateData = activeFlow.state_data || {};
  const waitingForInput = stateData.waiting_for_input;

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
      await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, recipientId, cancelMsg);
    } else {
      await sendFacebookReply(pageConnection.access_token, { id: recipientId }, cancelMsg, pageConnection.page_id);
    }
    
    try {
      await storeAssistantMessageFallback(db, supabase, sessionId, pageConnection.user_id, cancelMsg, null, {
        is_flow_message: true,
        node_id: currentNodeId,
        is_escape: true
      });
    } catch (_) {}
    return true;
  }

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
          await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, recipientId, failureMsg);
        } else {
          await sendFacebookReply(pageConnection.access_token, { id: recipientId }, failureMsg, pageConnection.page_id);
        }
        await cleanActiveSessionFlow(db, supabase, sessionId);
        try {
          await storeAssistantMessageFallback(db, supabase, sessionId, pageConnection.user_id, failureMsg, null, {
            is_flow_message: true,
            node_id: nodeId,
            is_validation_failure: true
          });
        } catch (_) {}
        return true;
      }

      stateData.waiting_for_input.attempts = attempts;
      try {
        await supabase.from('chat_session_flows').update({ state_data: stateData }).eq('session_id', sessionId);
        await db.prepare(`UPDATE chat_session_flows SET state_data = ? WHERE session_id = ?`)
          .bind(JSON.stringify(stateData), sessionId)
          .run();
      } catch (_) {}

      const defaultErr = type === 'email' 
        ? "That doesn't look like a valid email. Please try again:" 
        : "That doesn't look like a valid phone number. Please try again:";
      const resolvedError = errorMessage || defaultErr;

      if (isWhatsApp) {
        await sendWhatsAppReply(pageConnection.whatsapp_phone_number_id!, pageConnection.access_token, recipientId, resolvedError);
      } else {
        await sendFacebookReply(pageConnection.access_token, recipient, resolvedError, pageConnection.page_id);
      }

      try {
        await storeAssistantMessageFallback(db, supabase, sessionId, pageConnection.user_id, resolvedError, null, {
          is_flow_message: true,
          node_id: nodeId,
          is_validation_error: true
        });
      } catch (_) {}

      return true; // Wait for retry
    }

    // Input is valid! Save it to stateData
    stateData[key] = trimmedText;
    delete stateData.waiting_for_input;

    try {
      await supabase.from('chat_session_flows').update({ is_paused: false, state_data: stateData }).eq('session_id', sessionId);
      await db.prepare(`UPDATE chat_session_flows SET is_paused = 0, state_data = ? WHERE session_id = ?`)
        .bind(JSON.stringify(stateData), sessionId)
        .run();
    } catch (_) {}

    // Sync to permanent chat session metadata
    await syncSessionMetadata(db, supabase, sessionId, stateData);

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

  if (nErr || !node) {
    return false;
  }

  // 3. Find if the user's text matches any button/quick reply/carousel option
  const { buttons, quickReplies, whatsappButtons, whatsappList, carouselItems } = node.data;
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

  // Check Carousel buttons
  if (!matchedPayload && carouselItems && carouselItems.length > 0) {
    for (const item of carouselItems) {
      const btns = item.buttons || [];
      const match = btns.find((btn: any) => btn.title.trim().toLowerCase() === normalizedText);
      if (match && match.type !== 'web_url') {
        matchedPayload = match.payload || match.title;
        break;
      }
    }
  }

  if (matchedPayload) {
    console.log(`[Flow Engine] Text input "${text}" matched option payload: ${matchedPayload}`);
    const payloadString = `FLOW_NODE_ID:${currentNodeId}:${matchedPayload}`;
    return await handleFlowInteraction(db, supabase, sessionId, payloadString, pageConnection, recipientId);
  }

  return false;
}

/**
 * Syncs the flow state data to the chat session's metadata so that standard AI chatbot can access them.
 */
async function syncSessionMetadata(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  stateData: Record<string, any>
): Promise<void> {
  try {
    let currentMetadata: Record<string, any> = {};

    // 1. Fetch current session metadata
    const d1Result = await db.prepare(`SELECT metadata FROM chat_sessions WHERE id = ?`).bind(sessionId).first<{ metadata: string | null }>();
    if (d1Result && d1Result.metadata) {
      try {
        currentMetadata = JSON.parse(d1Result.metadata);
      } catch (_) {}
    } else {
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('metadata')
        .eq('id', sessionId)
        .maybeSingle();
      if (session && session.metadata) {
        currentMetadata = typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;
      }
    }

    // 2. Merge stateData properties (ignoring internal keys like waiting_for_input)
    const mergedMetadata = { ...currentMetadata };
    for (const [k, v] of Object.entries(stateData)) {
      if (k !== 'waiting_for_input') {
        mergedMetadata[k] = v;
      }
    }

    // 3. Update Supabase
    try {
      await supabase
        .from('chat_sessions')
        .update({ metadata: mergedMetadata })
        .eq('id', sessionId);
    } catch (err) {
      console.warn(`[Flow Engine] Supabase session metadata update failed:`, err);
    }

    // 4. Update D1
    await db.prepare(`UPDATE chat_sessions SET metadata = ? WHERE id = ?`)
      .bind(JSON.stringify(mergedMetadata), sessionId)
      .run();

    console.log(`[Flow Engine] Synced session metadata for session ${sessionId}:`, mergedMetadata);
  } catch (err) {
    console.error(`[Flow Engine] Failed to sync session metadata:`, err);
  }
}
