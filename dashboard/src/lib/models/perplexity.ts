import type { ModelPreset } from './openai';

export const PERPLEXITY_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "sonar-reasoning",
    "name": "Sonar Reasoning (Latest)",
    "context": "128K",
    "capabilities": "Search"
  },
  {
    "id": "sonar-reasoning-pro",
    "name": "Sonar Reasoning Pro",
    "context": "128K",
    "capabilities": "Search"
  },
  {
    "id": "sonar",
    "name": "Sonar (Latest)",
    "context": "128K",
    "capabilities": "Search"
  },
  {
    "id": "sonar-pro",
    "name": "Sonar Pro",
    "context": "128K",
    "capabilities": "Search"
  }
];

export const PERPLEXITY_EMBEDDING_MODELS: ModelPreset[] = [];
