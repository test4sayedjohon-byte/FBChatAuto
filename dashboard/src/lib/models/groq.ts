import type { ModelPreset } from './openai';

export const GROQ_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "llama-3.3-70b-versatile",
    "name": "Meta Llama 3.3 70B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.1-8b-instant",
    "name": "Meta Llama 3.1 8B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.2-1b-preview",
    "name": "Meta Llama 3.2 1B Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.2-3b-preview",
    "name": "Meta Llama 3.2 3B Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.2-11b-vision-preview",
    "name": "Meta Llama 3.2 11B Vision",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "llama-3.2-90b-vision-preview",
    "name": "Meta Llama 3.2 90B Vision",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mixtral-8x7b-32768",
    "name": "Mixtral 8x7B Instruct",
    "context": "32K",
    "capabilities": "Tools"
  },
  {
    "id": "gemma2-9b-it",
    "name": "Gemma 2 9B Instruct",
    "context": "8K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek-r1-distill-llama-70b",
    "name": "DeepSeek R1 Distill Llama 70B",
    "context": "128K",
    "capabilities": "Reasoning"
  },
  {
    "id": "deepseek-r1-distill-qwen-32b",
    "name": "DeepSeek R1 Distill Qwen 32B",
    "context": "128K",
    "capabilities": "Reasoning"
  }
];

export const GROQ_EMBEDDING_MODELS: ModelPreset[] = [];
