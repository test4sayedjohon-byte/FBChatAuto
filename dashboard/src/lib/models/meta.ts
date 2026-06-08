import type { ModelPreset } from './openai';

export const META_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "llama-3.3-70b-instruct",
    "name": "Llama 3.3 70B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.1-405b-instruct",
    "name": "Llama 3.1 405B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.1-70b-instruct",
    "name": "Llama 3.1 70B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.1-8b-instruct",
    "name": "Llama 3.1 8B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.2-11b-vision-instruct",
    "name": "Llama 3.2 11B Vision Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "llama-3.2-90b-vision-instruct",
    "name": "Llama 3.2 90B Vision Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "llama-3.2-3b-instruct",
    "name": "Llama 3.2 3B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.2-1b-instruct",
    "name": "Llama-3.2 1B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  }
];

export const META_EMBEDDING_MODELS: ModelPreset[] = [];
