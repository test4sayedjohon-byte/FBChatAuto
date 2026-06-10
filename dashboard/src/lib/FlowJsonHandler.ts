import { supabase } from './supabase';

interface Flow {
  id?: string;
  name: string;
  description: string | null;
  is_active?: boolean;
}

interface FlowNode {
  id: string;
  flow_id: string;
  type: string;
  data: any;
  position: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  flow_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
}

interface FlowExportData {
  version: string;
  flow: {
    name: string;
    description: string | null;
  };
  nodes: Omit<FlowNode, 'flow_id'>[];
  edges: Omit<FlowEdge, 'flow_id'>[];
}

/**
 * Serializes and triggers a download of a flow configuration as a JSON file.
 */
export function exportFlow(flow: Flow, nodes: FlowNode[], edges: FlowEdge[]): void {
  const exportData: FlowExportData = {
    version: '1.0.0',
    flow: {
      name: flow.name,
      description: flow.description
    },
    // Exclude flow_id references so it's a clean template
    nodes: nodes.map(({ id, type, data, position }) => ({ id, type, data, position })),
    edges: edges.map(({ id, source_node_id, target_node_id, source_handle }) => ({
      id,
      source_node_id,
      target_node_id,
      source_handle
    }))
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  const sanitizedName = flow.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  link.download = `flow_${sanitizedName}_export.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates and imports a JSON flow configuration, mapping all IDs to prevent conflicts.
 * Returns the newly created flow ID on success.
 */
export async function importFlow(
  jsonContent: string,
  userId: string
): Promise<{ success: boolean; flowId?: string; error?: string }> {
  try {
    const data = JSON.parse(jsonContent) as FlowExportData;

    // 1. Basic schema validation
    if (!data.flow || !data.flow.name) {
      return { success: false, error: 'Invalid file format: Missing flow metadata.' };
    }
    if (!Array.isArray(data.nodes)) {
      return { success: false, error: 'Invalid file format: Nodes array missing.' };
    }

    const flowName = `${data.flow.name} (Imported)`;
    const newFlowId = crypto.randomUUID();

    // 2. Create new flow record in dm_flows
    const { error: flowErr } = await supabase
      .from('dm_flows')
      .insert({
        id: newFlowId,
        user_id: userId,
        name: flowName,
        description: data.flow.description || null,
        is_active: false // default to inactive so user can review it first
      });

    if (flowErr) throw flowErr;

    // 3. Map Node IDs to prevent database primary key collisions
    const nodeIdMap: Record<string, string> = {};
    const newNodes = data.nodes.map(node => {
      const freshNodeId = crypto.randomUUID();
      nodeIdMap[node.id] = freshNodeId;
      return {
        id: freshNodeId,
        flow_id: newFlowId,
        type: node.type,
        data: node.data || {},
        position: node.position || { x: 0, y: 0 }
      };
    });

    // Save nodes to Supabase
    if (newNodes.length > 0) {
      const { error: nodesErr } = await supabase
        .from('dm_flow_nodes')
        .insert(newNodes);
      
      if (nodesErr) throw nodesErr;
    }

    // 4. Map Edges to use the new node IDs
    if (Array.isArray(data.edges) && data.edges.length > 0) {
      const newEdges = data.edges.map(edge => {
        const sourceId = nodeIdMap[edge.source_node_id];
        const targetId = nodeIdMap[edge.target_node_id];

        if (!sourceId || !targetId) {
          console.warn(`[Flow Import] Skipping orphaned edge ${edge.id}`);
          return null;
        }

        return {
          id: crypto.randomUUID(),
          flow_id: newFlowId,
          source_node_id: sourceId,
          target_node_id: targetId,
          source_handle: edge.source_handle || null
        };
      }).filter(Boolean);

      if (newEdges.length > 0) {
        const { error: edgesErr } = await supabase
          .from('dm_flow_edges')
          .insert(newEdges);

        if (edgesErr) throw edgesErr;
      }
    }

    return { success: true, flowId: newFlowId };
  } catch (err: any) {
    console.error('[Flow Import] Error:', err);
    return { success: false, error: err.message || 'Failed to parse JSON file.' };
  }
}
