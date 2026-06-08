import type { ModelPreset } from './openai';

export const COHERE_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "command-r-plus",
    "name": "Command R+ (Latest)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "command-r-plus-08-2024",
    "name": "Command R+ (08-2024)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "command-r",
    "name": "Command R (Latest)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "command-r-08-2024",
    "name": "Command R (08-2024)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "command",
    "name": "Command",
    "context": "4K",
    "capabilities": "Tools"
  },
  {
    "id": "command-light",
    "name": "Command Light",
    "context": "4K",
    "capabilities": "Tools"
  }
];

export const COHERE_EMBEDDING_MODELS: ModelPreset[] = [
  {
    "id": "embed-english-v3.0",
    "name": "Cohere Embed English v3.0",
    "context": "512",
    "capabilities": "Embedding"
  },
  {
    "id": "embed-multilingual-v3.0",
    "name": "Cohere Embed Multilingual v3.0",
    "context": "512",
    "capabilities": "Embedding"
  },
  {
    "id": "embed-english-light-v3.0",
    "name": "Cohere Embed English Light v3.0",
    "context": "512",
    "capabilities": "Embedding"
  },
  {
    "id": "embed-multilingual-light-v3.0",
    "name": "Cohere Embed Multilingual Light v3.0",
    "context": "512",
    "capabilities": "Embedding"
  }
];
