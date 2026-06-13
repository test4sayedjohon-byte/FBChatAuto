// ─── Node Config Helper ──────────────────────────────────────────────
// Pure utility — no React imports. Maps node type to its visual theme
// and validation schemas (I/O types).
// ───────────────────────────────────────────────────────────────────────────
import type { FlowNodeType, NodeColorConfig, FlowNode } from './types';

export const NODE_COLORS: Record<FlowNodeType, NodeColorConfig> = {
  trigger:      { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)',   label: 'Trigger' },
  message:      { border: '#4f46e5', bg: 'rgba(79, 70, 229, 0.12)',   label: 'Text Message' },
  interactive:  { border: '#d946ef', bg: 'rgba(217, 70, 239, 0.12)', label: 'Interactive Choices' },
  delay:        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)',  label: 'Typing Delay' },
  condition:    { border: '#eab308', bg: 'rgba(234, 179, 8, 0.12)',   label: 'Conditional Rule' },
  action:       { border: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Action Block' },
  ai_route:     { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)',  label: 'AI Chat Handover' },
  capture_input:{ border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)',  label: 'Capture Input' },
  lead_webhook: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', label: 'Send Lead (Webhook)' },
  randomizer:   { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', label: 'A/B Split Test' },
  goto_flow:    { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Go-To Flow' },
  ai_agent:     { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', label: 'AI Agent' },
};

// Define valid connection port types
export type PortType = 'control' | 'text' | 'boolean' | 'any';

export interface NodeSchema {
  color: NodeColorConfig;
  acceptedInputs: PortType[];
  getOutputType?: (node: FlowNode, handleId: string) => PortType;
}

export const NODE_CONFIGS: Record<FlowNodeType, NodeSchema> = {
  trigger: {
    color: NODE_COLORS.trigger,
    acceptedInputs: [], // Cannot be target
    getOutputType: () => 'control',
  },
  message: {
    color: NODE_COLORS.message,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'control',
  },
  interactive: {
    color: NODE_COLORS.interactive,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'control',
  },
  delay: {
    color: NODE_COLORS.delay,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'control',
  },
  condition: {
    color: NODE_COLORS.condition,
    acceptedInputs: ['control', 'any'],
    getOutputType: () => 'boolean', // Outputs 'true'/'false' handles
  },
  action: {
    color: NODE_COLORS.action,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'control',
  },
  ai_route: {
    color: NODE_COLORS.ai_route,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'control', // Terminal, theoretically no output
  },
  capture_input: {
    color: NODE_COLORS.capture_input,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'text',
  },
  lead_webhook: {
    color: NODE_COLORS.lead_webhook,
    acceptedInputs: ['control', 'boolean', 'text', 'any'],
    getOutputType: () => 'control',
  },
  randomizer: {
    color: NODE_COLORS.randomizer,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'control',
  },
  goto_flow: {
    color: NODE_COLORS.goto_flow,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'control', // Terminal
  },
  ai_agent: {
    color: NODE_COLORS.ai_agent,
    acceptedInputs: ['control', 'boolean', 'any'],
    getOutputType: () => 'control',
  },
};

/** Returns the default FlowNodeData shape for a given node type. */
export function getDefaultDataForType(type: FlowNodeType): import('./types').FlowNodeData {
  switch (type) {
    case 'trigger':
      return {
        triggerType: 'keyword',
        triggerKeywords: [],
        triggerMatchType: 'any',
        triggerCaseSensitive: false,
      };
    case 'message':
      return { text: 'Hello, thank you for reaching out!' };
    case 'interactive':
      return {
        text: 'What are you interested in?',
        buttons: [
          { type: 'postback', title: 'Pricing', payload: 'pricing' },
          { type: 'postback', title: 'Support', payload: 'support' },
        ],
        whatsappType: 'button',
        whatsappButtons: [
          { id: 'pricing', title: 'Pricing' },
          { id: 'support', title: 'Support' },
        ],
      };
    case 'delay':
      return { delaySeconds: 3, delayType: 'short' };
    case 'condition':
      return { conditionKey: 'user_tag', conditionOperator: 'equals', conditionValue: 'vip' };
    case 'action':
      return { actionType: 'add_tag', actionParams: { tag: 'lead' } };
    case 'ai_route':
      return {};
    case 'capture_input':
      return {
        text: 'What is your email address?',
        captureKey: 'email',
        captureType: 'email',
        validationErrorMessage: 'Invalid email. Please check and reply again.',
      };
    case 'lead_webhook':
      return { webhookUrl: '' };
    case 'randomizer':
      return {};
    case 'goto_flow':
      return { targetFlowId: '' };
    case 'ai_agent':
      return {
        promptInstructions: 'You are a helpful assistant talking to {{name}}. Keep responses short.',
        aiModel: '',
      };
    default:
      return {};
  }
}
