import type { ModelPreset } from './openai';

export const GEMINI_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-2.5-flash-image",
    "name": "Nano Banana (Gemini 2.5 Flash Image)",
    "context": "33K",
    "capabilities": "Image"
  },
  {
    "id": "gemini-2.5-flash-lite",
    "name": "Gemini 2.5 Flash Lite",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-2.5-flash-lite-preview-09-2025",
    "name": "Gemini 2.5 Flash Lite Preview 09-2025",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-2.5-pro",
    "name": "Gemini 2.5 Pro",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-2.5-pro-preview",
    "name": "Gemini 2.5 Pro Preview 06-05",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-2.5-pro-preview-05-06",
    "name": "Gemini 2.5 Pro Preview 05-06",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-3-flash-preview",
    "name": "Gemini 3 Flash Preview",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-3-pro-image-preview",
    "name": "Nano Banana Pro (Gemini 3 Pro Image Preview)",
    "context": "66K",
    "capabilities": "Image"
  },
  {
    "id": "gemini-3.1-flash-image-preview",
    "name": "Nano Banana 2 (Gemini 3.1 Flash Image Preview)",
    "context": "131K",
    "capabilities": "Image"
  },
  {
    "id": "gemini-3.1-flash-lite",
    "name": "Gemini 3.1 Flash Lite",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-3.1-flash-lite-preview",
    "name": "Gemini 3.1 Flash Lite Preview",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-3.1-pro-preview",
    "name": "Gemini 3.1 Pro Preview",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-3.1-pro-preview-customtools",
    "name": "Gemini 3.1 Pro Preview Custom Tools",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "gemini-3.5-flash",
    "name": "Gemini 3.5 Flash",
    "context": "1M",
    "capabilities": "Tools"
  }
];

export const GEMINI_EMBEDDING_MODELS: ModelPreset[] = [
  {
    "id": "text-embedding-004",
    "name": "Gemini Text Embedding 004",
    "context": "8K",
    "capabilities": "Embedding"
  }
];
