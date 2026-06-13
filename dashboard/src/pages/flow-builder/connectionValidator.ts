import type { FlowNode, FlowEdge } from './types';
import { NODE_CONFIGS } from './nodeConfig';

/**
 * Checks if adding an edge from source to target would create a cycle.
 * Uses a depth-first search (DFS) to traverse existing edges.
 */
export function wouldCreateLoop(
  edges: FlowEdge[],
  sourceNodeId: string,
  targetNodeId: string
): boolean {
  if (sourceNodeId === targetNodeId) return true;

  // Build adjacency list for fast traversal
  const adj: Record<string, string[]> = {};
  for (const edge of edges) {
    if (!adj[edge.source_node_id]) adj[edge.source_node_id] = [];
    adj[edge.source_node_id].push(edge.target_node_id);
  }

  // DFS to see if targetNodeId can reach sourceNodeId
  const visited = new Set<string>();
  const stack = [targetNodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceNodeId) {
      return true; // Loop detected
    }

    if (!visited.has(current)) {
      visited.add(current);
      const neighbors = adj[current] || [];
      for (const next of neighbors) {
        stack.push(next);
      }
    }
  }

  return false;
}

/**
 * Validates whether the connection between source and target is valid.
 * Enforces strict input/output rules and node-specific constraints.
 */
export function validateConnection(
  sourceNode: FlowNode,
  sourceHandle: string,
  targetNode: FlowNode
): { isValid: boolean; error?: string } {
  // 1. Structural constraints
  if (targetNode.type === 'trigger') {
    return { isValid: false, error: 'Cannot connect to a Trigger block. Triggers can only start a flow.' };
  }

  if (sourceNode.type === 'ai_route' || sourceNode.type === 'goto_flow') {
    return { isValid: false, error: 'Terminal blocks cannot have outgoing connections.' };
  }

  // 2. Strict Input/Output Type Validation
  const sourceConfig = NODE_CONFIGS[sourceNode.type];
  const targetConfig = NODE_CONFIGS[targetNode.type];

  if (!sourceConfig || !targetConfig) {
    return { isValid: true }; // Fallback if config is missing
  }

  const sourceOutputType = sourceConfig.getOutputType ? sourceConfig.getOutputType(sourceNode, sourceHandle) : 'control';
  const acceptedInputs = targetConfig.acceptedInputs || ['any'];

  if (!acceptedInputs.includes('any') && !acceptedInputs.includes(sourceOutputType)) {
    return {
      isValid: false,
      error: `Type mismatch: Cannot connect '${sourceOutputType}' output to a block expecting [${acceptedInputs.join(', ')}].`
    };
  }

  return { isValid: true };
}
