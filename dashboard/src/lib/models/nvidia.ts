import type { ModelPreset } from './openai';

export const NVIDIA_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "meta/llama-3.3-70b-instruct",
    "name": "Llama 3.3 70B Instruct (NVIDIA NIM)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta/llama-3.1-405b-instruct",
    "name": "Llama 3.1 405B Instruct (NVIDIA NIM)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta/llama-3.1-70b-instruct",
    "name": "Llama 3.1 70B Instruct (NVIDIA NIM)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta/llama-3.1-8b-instruct",
    "name": "Llama 3.1 8B Instruct (NVIDIA NIM)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "name": "Llama 3.3 Nemotron Super 49B v1.5",
    "context": "131K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b",
    "name": "Nemotron 3 Nano 30B A3B",
    "context": "262K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b:free",
    "name": "Nemotron 3 Nano 30B A3B (Free)",
    "context": "256K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b",
    "name": "Nemotron 3 Super 120B",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b",
    "name": "Nemotron 3 Ultra 550B",
    "context": "1M",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-nano-9b-v2",
    "name": "Nemotron Nano 9B V2",
    "context": "131K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-4-340b-instruct",
    "name": "Nemotron 4 340B Instruct",
    "context": "4K",
    "capabilities": "Tools"
  }
];

export const NVIDIA_EMBEDDING_MODELS: ModelPreset[] = [
  {
    "id": "nvidia/embed-qa-4",
    "name": "NVIDIA Embed QA 4",
    "context": "8K",
    "capabilities": "Embedding"
  },
  {
    "id": "nvidia/embeddings-nv-embed-qa-4",
    "name": "NV Embed QA 4",
    "context": "8K",
    "capabilities": "Embedding"
  }
];
