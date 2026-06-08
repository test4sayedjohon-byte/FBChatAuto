import type { ModelPreset } from './openai';

export const ANTHROPIC_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "claude-3-5-sonnet-latest",
    "name": "Claude 3.5 Sonnet (Latest)",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "claude-3-5-sonnet-20241022",
    "name": "Claude 3.5 Sonnet (20241022)",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "claude-3-5-haiku-latest",
    "name": "Claude 3.5 Haiku (Latest)",
    "context": "200K",
    "capabilities": "Tools"
  },
  {
    "id": "claude-3-5-haiku-20241022",
    "name": "Claude 3.5 Haiku (20241022)",
    "context": "200K",
    "capabilities": "Tools"
  },
  {
    "id": "claude-3-opus-latest",
    "name": "Claude 3 Opus (Latest)",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "claude-3-opus-20240229",
    "name": "Claude 3 Opus (20240229)",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "claude-3-sonnet-20240229",
    "name": "Claude 3 Sonnet",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "claude-3-haiku-20240307",
    "name": "Claude 3 Haiku",
    "context": "200K",
    "capabilities": "Vision, Tools"
  }
];

export const ANTHROPIC_EMBEDDING_MODELS: ModelPreset[] = [];
