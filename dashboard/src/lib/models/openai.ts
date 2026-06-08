export interface ModelPreset {
  id: string;
  name: string;
  context: string;
  capabilities: string;
  isFree?: boolean;
}

export const OPENAI_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "gpt-3.5-turbo",
    "name": "GPT-3.5 Turbo",
    "context": "16K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-3.5-turbo-0613",
    "name": "GPT-3.5 Turbo (older v0613)",
    "context": "4K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-3.5-turbo-16k",
    "name": "GPT-3.5 Turbo 16k",
    "context": "16K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-3.5-turbo-instruct",
    "name": "GPT-3.5 Turbo Instruct",
    "context": "4K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-4",
    "name": "GPT-4",
    "context": "8K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-4-turbo",
    "name": "GPT-4 Turbo",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4-turbo-preview",
    "name": "GPT-4 Turbo Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-4.1",
    "name": "GPT-4.1",
    "context": "1M",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4.1-mini",
    "name": "GPT-4.1 Mini",
    "context": "1M",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4.1-nano",
    "name": "GPT-4.1 Nano",
    "context": "1M",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4o",
    "name": "GPT-4o",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4o-2024-05-13",
    "name": "GPT-4o (2024-05-13)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4o-2024-08-06",
    "name": "GPT-4o (2024-08-06)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4o-2024-11-20",
    "name": "GPT-4o (2024-11-20)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4o-mini",
    "name": "GPT-4o-mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4o-mini-2024-07-18",
    "name": "GPT-4o-mini (2024-07-18)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-4o-mini-search-preview",
    "name": "GPT-4o-mini Search Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-4o-search-preview",
    "name": "GPT-4o Search Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-5",
    "name": "GPT-5",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5-chat",
    "name": "GPT-5 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5-codex",
    "name": "GPT-5 Codex",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5-image",
    "name": "GPT-5 Image",
    "context": "400K",
    "capabilities": "Image"
  },
  {
    "id": "gpt-5-image-mini",
    "name": "GPT-5 Image Mini",
    "context": "400K",
    "capabilities": "Image"
  },
  {
    "id": "gpt-5-mini",
    "name": "GPT-5 Mini",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5-nano",
    "name": "GPT-5 Nano",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5-pro",
    "name": "GPT-5 Pro",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.1",
    "name": "GPT-5.1",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.1-chat",
    "name": "GPT-5.1 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.1-codex",
    "name": "GPT-5.1-Codex",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.1-codex-max",
    "name": "GPT-5.1-Codex-Max",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.1-codex-mini",
    "name": "GPT-5.1-Codex-Mini",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.2",
    "name": "GPT-5.2",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.2-chat",
    "name": "GPT-5.2 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.2-codex",
    "name": "GPT-5.2-Codex",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.2-pro",
    "name": "GPT-5.2 Pro",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.3-chat",
    "name": "GPT-5.3 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.3-codex",
    "name": "GPT-5.3-Codex",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.4",
    "name": "GPT-5.4",
    "context": "1.1M",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.4-image-2",
    "name": "GPT-5.4 Image 2",
    "context": "272K",
    "capabilities": "Image"
  },
  {
    "id": "gpt-5.4-mini",
    "name": "GPT-5.4 Mini",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.4-nano",
    "name": "GPT-5.4 Nano",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.4-pro",
    "name": "GPT-5.4 Pro",
    "context": "1.1M",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.5",
    "name": "GPT-5.5",
    "context": "1.1M",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-5.5-pro",
    "name": "GPT-5.5 Pro",
    "context": "1.1M",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-audio",
    "name": "GPT Audio",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "gpt-audio-mini",
    "name": "GPT Audio Mini",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "gpt-chat-latest",
    "name": "GPT Chat Latest",
    "context": "400K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "gpt-oss-120b",
    "name": "gpt-oss-120b",
    "context": "131K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-oss-20b",
    "name": "gpt-oss-20b",
    "context": "131K",
    "capabilities": "Tools"
  },
  {
    "id": "gpt-oss-safeguard-20b",
    "name": "gpt-oss-safeguard-20b",
    "context": "131K",
    "capabilities": "Tools"
  },
  {
    "id": "o1",
    "name": "o1",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o1-pro",
    "name": "o1-pro",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o3",
    "name": "o3",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o3-deep-research",
    "name": "o3 Deep Research",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o3-mini",
    "name": "o3 Mini",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o3-mini-high",
    "name": "o3 Mini High",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o3-pro",
    "name": "o3 Pro",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o4-mini",
    "name": "o4 Mini",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o4-mini-deep-research",
    "name": "o4 Mini Deep Research",
    "context": "200K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "o4-mini-high",
    "name": "o4 Mini High",
    "context": "200K",
    "capabilities": "Vision, Tools"
  }
];

export const OPENAI_EMBEDDING_MODELS: ModelPreset[] = [
  {
    "id": "text-embedding-3-small",
    "name": "Text Embedding 3 (Small)",
    "context": "8K",
    "capabilities": "Embedding"
  },
  {
    "id": "text-embedding-3-large",
    "name": "Text Embedding 3 (Large)",
    "context": "8K",
    "capabilities": "Embedding"
  },
  {
    "id": "text-embedding-ada-002",
    "name": "ADA-002",
    "context": "8K",
    "capabilities": "Embedding"
  }
];
