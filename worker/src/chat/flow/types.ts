import type { PageConnection, DMFlow, DMFlowNode, DMFlowEdge, ChatSessionFlow } from '../../types';

export type { PageConnection, DMFlow, DMFlowNode, DMFlowEdge, ChatSessionFlow };

export interface FlowNodeData extends Record<string, any> {
  // message / interactive
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  
  // Custom variable capturing for interactive node
  variableName?: string; 

  buttons?: Array<{
    type: 'web_url' | 'postback' | 'phone_number';
    title: string;
    url?: string;
    payload?: string;
  }>;
  quickReplies?: Array<{
    title: string;
    payload: string;
  }>;
  
  // Carousel items
  carouselItems?: Array<{
    title: string;
    subtitle?: string;
    imageUrl?: string;
    buttons?: Array<{
      type: 'web_url' | 'postback' | 'phone_number';
      title: string;
      url?: string;
      payload?: string;
    }>;
  }>;

  // WhatsApp Interactive
  whatsappType?: 'button' | 'list';
  whatsappButtons?: Array<{
    id: string;
    title: string;
  }>;
  whatsappList?: {
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
  
  // delay
  delaySeconds?: number;
  delayType?: 'short' | 'long';
  
  // condition
  conditionKey?: string;
  conditionValue?: string;
  conditionOperator?: 'equals' | 'contains' | 'exists';
  
  // action
  actionType?: 'add_tag' | 'remove_tag' | 'set_attribute' | 'pause_bot' | 'resume_bot' | 'trigger_webhook';
  actionParams?: Record<string, any>;

  // capture_input
  captureKey?: string;
  captureType?: 'text' | 'email' | 'phone';
  validationErrorMessage?: string;

  // lead_webhook
  webhookUrl?: string;

  // goto_flow
  targetFlowId?: string;

  // ai_agent
  promptInstructions?: string;
  aiModel?: string;

  // telegram_notify
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramMessageTemplate?: string;

  // google_sheets
  googleSheetsWebhookUrl?: string;
  googleSheetsColumns?: Record<string, string>;

  // airtable
  airtableApiKey?: string;
  airtableBaseId?: string;
  airtableTableName?: string;
  airtableFields?: Record<string, string>;

  // lead_capture
  leadProductId?: string;
  leadStatus?: string;
  leadCustomDetails?: Record<string, string>;
}

export type ExtendedDMFlowNode = Omit<DMFlowNode, 'type' | 'data'> & {
  type: DMFlowNode['type'] | 'carousel' | 'telegram_notify' | 'google_sheets' | 'airtable' | 'lead_capture' | 'trigger';
  data: FlowNodeData;
};
