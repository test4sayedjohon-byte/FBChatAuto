import type { D1Database } from '@cloudflare/workers-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection, ExtendedDMFlowNode } from './types';
import * as executors from './node-executors';
import { getCustomerProfileFallback } from '../../db';

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

  const node = nodeRes.data as ExtendedDMFlowNode | null;
  if (nodeRes.error || !node) {
    console.error(`[Flow Engine] Node ${nodeId} not found`);
    return { success: false, error: `Node ${nodeId} not found` };
  }
  const senderName = sessionRes.data?.sender_name || null;

  const isWhatsApp = !!pageConnection.whatsapp_phone_number_id && !!pageConnection.is_whatsapp_active;
  const recipient = commentId ? { comment_id: commentId } : { id: recipientId };

  // Load customer profile to populate stateData with AI intent score and level
  try {
    const profile = await getCustomerProfileFallback(db, supabase, pageConnection.page_id, recipientId);
    if (profile) {
      stateData.lead_score = profile.lead_score ?? stateData.lead_score;
      stateData.intent_level = profile.intent_level ?? stateData.intent_level;
      if (profile.metadata) {
        const meta = typeof profile.metadata === 'string' ? JSON.parse(profile.metadata) : profile.metadata;
        stateData.short_description = meta.short_description ?? stateData.short_description;
      }
    }
  } catch (e) {
    console.warn('[Flow Engine] Error fetching customer profile for flow state:', e);
  }

  // Update current node in DB
  try {
    await supabase.from('chat_session_flows').update({ current_node_id: nodeId, last_executed_at: new Date().toISOString() }).eq('session_id', sessionId);
    await db.prepare(`UPDATE chat_session_flows SET current_node_id = ?, last_executed_at = ? WHERE session_id = ?`)
      .bind(nodeId, new Date().toISOString(), sessionId)
      .run();
  } catch (_) {}

  let executionResult: { success: boolean; error?: string; targetHandle?: string };

  switch (node.type) {
    case 'trigger':
      executionResult = { success: true, targetHandle: 'default' };
      break;

    case 'message':
      executionResult = await executors.executeMessageNode(
        db, supabase, sessionId, node, pageConnection, recipientId, stateData, senderName, recipient, isWhatsApp, commentId
      );
      break;

    case 'interactive':
      executionResult = await executors.executeInteractiveNode(
        db, supabase, sessionId, node, pageConnection, recipientId, stateData, senderName, recipient, isWhatsApp, commentId
      );
      break;

    case 'carousel':
      executionResult = await executors.executeCarouselNode(
        db, supabase, sessionId, node, pageConnection, recipientId, stateData, senderName, recipient, isWhatsApp
      );
      break;

    case 'delay':
      executionResult = await executors.executeDelayNode(
        db, supabase, sessionId, node, pageConnection, recipientId, stateData, isWhatsApp
      );
      break;

    case 'condition':
      executionResult = await executors.executeConditionNode(node, stateData);
      break;

    case 'action':
      executionResult = await executors.executeActionNode(
        db, supabase, sessionId, node, stateData
      );
      break;

    case 'capture_input':
      executionResult = await executors.executeCaptureInputNode(
        db, supabase, sessionId, node, pageConnection, recipientId, stateData, senderName, recipient, isWhatsApp
      );
      break;

    case 'lead_webhook':
      executionResult = await executors.executeLeadWebhookNode(
        node, pageConnection, sessionId, stateData, senderName
      );
      break;

    case 'randomizer':
      executionResult = await executors.executeRandomizerNode(node);
      break;

    case 'goto_flow':
      // Handled directly inside the executor due to recursion/transition needs
      return await executeGotoFlow(db, supabase, sessionId, node, pageConnection, recipientId, stateData, commentId);

    case 'ai_agent':
      executionResult = await executors.executeAiAgentNode(
        db, supabase, sessionId, node, pageConnection, recipientId, stateData, senderName, isWhatsApp
      );
      break;

    case 'telegram_notify':
      executionResult = await executors.executeTelegramNotifyNode(
        supabase, node, pageConnection, stateData, senderName
      );
      break;

    case 'google_sheets':
      executionResult = await executors.executeGoogleSheetsNode(
        node, stateData, senderName
      );
      break;

    case 'airtable':
      executionResult = await executors.executeAirtableNode(
        node, stateData, senderName
      );
      break;

    case 'lead_capture':
      executionResult = await executors.executeLeadCaptureNode(
        supabase, sessionId, node, pageConnection, stateData, senderName
      );
      break;

    case 'ai_route':
      console.log(`[Flow Engine] AI Routing reached. Completing flow and resuming AI chatbot`);
      await cleanActiveSessionFlow(db, supabase, sessionId);
      return { success: true };

    default:
      console.warn(`[Flow Engine] Unknown node type: ${(node as any).type}`);
      await cleanActiveSessionFlow(db, supabase, sessionId);
      return { success: false, error: `Unknown node type ${(node as any).type}` };
  }

  if (!executionResult.success) {
    console.error(`[Flow Engine] Node execution failed. Ending flow. Error: ${executionResult.error}`);
    await cleanActiveSessionFlow(db, supabase, sessionId);
    return { success: false, error: executionResult.error };
  }

  if (executionResult.targetHandle) {
    return await advanceFlow(
      db, supabase, sessionId, nodeId, executionResult.targetHandle, pageConnection, recipientId, stateData, commentId
    );
  }

  return { success: true };
}

/**
 * Special handler for GOTO FLOW transition
 */
async function executeGotoFlow(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  node: ExtendedDMFlowNode,
  pageConnection: PageConnection,
  recipientId: string,
  stateData: Record<string, any>,
  commentId?: string
): Promise<{ success: boolean; error?: string }> {
  const { targetFlowId } = node.data;
  if (!targetFlowId) {
    console.warn(`[Flow Engine] Invalid goto flow transition target: null`);
    await cleanActiveSessionFlow(db, supabase, sessionId);
    return { success: false, error: 'Invalid goto flow target null' };
  }

  console.log(`[Flow Engine] Goto flow transitioning to: ${targetFlowId}`);
  const { data: nodes, error: nodeErr } = await supabase
    .from('dm_flow_nodes')
    .select('*')
    .eq('flow_id', targetFlowId);

  if (!nodeErr && nodes && nodes.length > 0) {
    const { data: edges } = await supabase.from('dm_flow_edges').select('*').eq('flow_id', targetFlowId);
    const incomingNodeIds = new Set((edges || []).map(e => e.target_node_id));
    const startNode = nodes.find(n => !incomingNodeIds.has(n.id)) || nodes[0];

    if (startNode) {
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

      return await executeNode(db, supabase, sessionId, startNode.id, pageConnection, recipientId, stateData, commentId);
    }
  }

  console.warn(`[Flow Engine] Invalid goto flow transition target: ${targetFlowId}`);
  await cleanActiveSessionFlow(db, supabase, sessionId);
  return { success: false, error: `Invalid goto flow target ${targetFlowId}` };
}

/**
 * Finds the outgoing edge for a given source node and handle, and executes the target node.
 */
export async function advanceFlow(
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
  const { data: edges } = await supabase
    .from('dm_flow_edges')
    .select('target_node_id')
    .eq('source_node_id', sourceNodeId)
    .eq('source_handle', handle);

  const nextEdge = edges?.[0];
  if (nextEdge) {
    return await executeNode(db, supabase, sessionId, nextEdge.target_node_id, pageConnection, recipientId, stateData, commentId);
  } else {
    console.log(`[Flow Engine] Flow completed. Restoring standard AI controls.`);
    await cleanActiveSessionFlow(db, supabase, sessionId);
    return { success: true };
  }
}

/**
 * Clears the active flow session state and resumes the AI bot.
 */
export async function cleanActiveSessionFlow(db: D1Database, supabase: SupabaseClient, sessionId: string): Promise<void> {
  try {
    await supabase.from('chat_session_flows').delete().eq('session_id', sessionId);
    await db.prepare(`DELETE FROM chat_session_flows WHERE session_id = ?`).bind(sessionId).run();
  } catch (_) {}

  try {
    await supabase.from('chat_sessions').update({ bot_paused: false }).eq('id', sessionId);
    await db.prepare(`UPDATE chat_sessions SET bot_paused = 0 WHERE id = ?`).bind(sessionId).run();
  } catch (_) {}
}
