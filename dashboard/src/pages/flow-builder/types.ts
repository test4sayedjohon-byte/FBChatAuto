// ─── Flow Builder Shared Types ─────────────────────────────────────────────
// Single source of truth for all type definitions used across flow-builder modules.
// IMPORTANT: Keep this file small and dependency-free (no React imports).
// ───────────────────────────────────────────────────────────────────────────

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  feed_to_ai?: boolean;
}

export type FlowNodeType =
  | 'trigger'
  | 'message'
  | 'interactive'
  | 'delay'
  | 'condition'
  | 'action'
  | 'ai_route'
  | 'capture_input'
  | 'lead_webhook'
  | 'randomizer'
  | 'goto_flow'
  | 'ai_agent';

export interface FlowNodeData {
  // --- Message / Interactive ---
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';

  // --- Messenger buttons ---
  buttons?: Array<{
    type: 'web_url' | 'postback' | 'phone_number';
    title: string;
    url?: string;
    payload?: string;
  }>;

  // --- Quick replies ---
  quickReplies?: Array<{
    title: string;
    payload: string;
  }>;

  // --- WhatsApp ---
  whatsappType?: 'button' | 'list';
  whatsappButtons?: Array<{ id: string; title: string }>;
  whatsappList?: {
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  };

  // --- Delay ---
  delaySeconds?: number;
  delayType?: 'short' | 'long';

  // --- Condition ---
  conditionKey?: string;
  conditionValue?: string;
  conditionOperator?: 'equals' | 'contains' | 'exists';

  // --- Action ---
  actionType?: 'add_tag' | 'remove_tag' | 'set_attribute' | 'pause_bot' | 'resume_bot' | 'trigger_webhook';
  actionParams?: Record<string, any>;

  // --- Capture Input ---
  captureKey?: string;
  captureType?: 'email' | 'phone' | 'text';
  validationErrorMessage?: string;

  // --- Webhook ---
  webhookUrl?: string;

  // --- Goto Flow ---
  targetFlowId?: string;

  // --- AI Agent ---
  promptInstructions?: string;
  aiModel?: string;

  // --- Trigger (new) ---
  triggerType?: 'keyword' | 'comment';
  triggerKeywords?: string[];
  triggerMatchType?: 'any' | 'exact' | 'contains';
  triggerCaseSensitive?: boolean;
  triggerPageConnectionId?: string;
  // Comment triggers
  triggerCommentType?: 'all' | 'keywords' | 'sentiment';
  triggerReplyTemplates?: string[];
  triggerApplyToPostType?: 'global' | 'specific';
  triggerPostId?: string | null;
}

export interface FlowNode {
  id: string;
  flow_id: string;
  type: FlowNodeType;
  data: FlowNodeData;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  flow_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string; // 'default', 'true', 'false', button payload, etc.
}

// Context menu state shape
export interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

// Live linking state
export interface LinkingSource {
  nodeId: string;
  handleId: string;
}

// Node colour config returned by getNodeColors()
export interface NodeColorConfig {
  border: string;
  bg: string;
  label: string;
}
