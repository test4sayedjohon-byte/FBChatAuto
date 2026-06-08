import type { ModelPreset } from './openai';

export const TOGETHER_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "name": "Llama 3.3 70B Instruct Turbo",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    "name": "Llama 3.1 8B Instruct Turbo",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek-ai/DeepSeek-V3",
    "name": "DeepSeek V3 (Chat)",
    "context": "64K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek-ai/DeepSeek-R1",
    "name": "DeepSeek R1 (Reasoner)",
    "context": "64K",
    "capabilities": "Reasoning"
  },
  {
    "id": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "name": "Qwen 2.5 Coder 32B Instruct",
    "context": "32K",
    "capabilities": "Tools"
  }
];

export const TOGETHER_EMBEDDING_MODELS: ModelPreset[] = [
  { id: 'togethercomputer/m2-bert-80M-8k-retrieval', name: 'M2-BERT 80M 8K Retrieval', context: '8K', capabilities: 'Embedding' }
];
