import type { ModelPreset } from './openai';

export const XAI_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "grok-2-1212",
    "name": "Grok 2 (1212)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "grok-2",
    "name": "Grok 2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "grok-2-vision-1212",
    "name": "Grok 2 Vision (1212)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "grok-beta",
    "name": "Grok Beta",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "grok-vision-beta",
    "name": "Grok Vision Beta",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "grok-3",
    "name": "Grok 3",
    "context": "128K",
    "capabilities": "Reasoning, Tools"
  },
  {
    "id": "grok-3-vision",
    "name": "Grok 3 Vision",
    "context": "128K",
    "capabilities": "Vision, Reasoning, Tools"
  }
];

export const XAI_EMBEDDING_MODELS: ModelPreset[] = [];
