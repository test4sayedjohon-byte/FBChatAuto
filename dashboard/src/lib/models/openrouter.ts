import type { ModelPreset } from './openai';

export const OPENROUTER_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "openai/gpt-3.5-turbo",
    "name": "OpenAI: GPT-3.5 Turbo",
    "context": "16K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-3.5-turbo-0613",
    "name": "OpenAI: GPT-3.5 Turbo (older v0613)",
    "context": "4K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-3.5-turbo-16k",
    "name": "OpenAI: GPT-3.5 Turbo 16k",
    "context": "16K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-3.5-turbo-instruct",
    "name": "OpenAI: GPT-3.5 Turbo Instruct",
    "context": "4K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4",
    "name": "OpenAI: GPT-4",
    "context": "8K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4-turbo",
    "name": "OpenAI: GPT-4 Turbo",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4-turbo-preview",
    "name": "OpenAI: GPT-4 Turbo Preview",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4.1",
    "name": "OpenAI: GPT-4.1",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4.1-mini",
    "name": "OpenAI: GPT-4.1 Mini",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4.1-nano",
    "name": "OpenAI: GPT-4.1 Nano",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4o",
    "name": "OpenAI: GPT-4o",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4o-2024-05-13",
    "name": "OpenAI: GPT-4o (2024-05-13)",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4o-2024-08-06",
    "name": "OpenAI: GPT-4o (2024-08-06)",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4o-2024-11-20",
    "name": "OpenAI: GPT-4o (2024-11-20)",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4o-mini",
    "name": "OpenAI: GPT-4o-mini",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4o-mini-2024-07-18",
    "name": "OpenAI: GPT-4o-mini (2024-07-18)",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4o-mini-search-preview",
    "name": "OpenAI: GPT-4o-mini Search Preview",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-4o-search-preview",
    "name": "OpenAI: GPT-4o Search Preview",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5",
    "name": "OpenAI: GPT-5",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5-chat",
    "name": "OpenAI: GPT-5 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5-codex",
    "name": "OpenAI: GPT-5 Codex",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5-image",
    "name": "OpenAI: GPT-5 Image",
    "context": "400K",
    "capabilities": "Image",
    "isFree": false
  },
  {
    "id": "openai/gpt-5-image-mini",
    "name": "OpenAI: GPT-5 Image Mini",
    "context": "400K",
    "capabilities": "Image",
    "isFree": false
  },
  {
    "id": "openai/gpt-5-mini",
    "name": "OpenAI: GPT-5 Mini",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5-nano",
    "name": "OpenAI: GPT-5 Nano",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5-pro",
    "name": "OpenAI: GPT-5 Pro",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.1",
    "name": "OpenAI: GPT-5.1",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.1-chat",
    "name": "OpenAI: GPT-5.1 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.1-codex",
    "name": "OpenAI: GPT-5.1-Codex",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.1-codex-max",
    "name": "OpenAI: GPT-5.1-Codex-Max",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.1-codex-mini",
    "name": "OpenAI: GPT-5.1-Codex-Mini",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.2",
    "name": "OpenAI: GPT-5.2",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.2-chat",
    "name": "OpenAI: GPT-5.2 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.2-codex",
    "name": "OpenAI: GPT-5.2-Codex",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.2-pro",
    "name": "OpenAI: GPT-5.2 Pro",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.3-chat",
    "name": "OpenAI: GPT-5.3 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.3-codex",
    "name": "OpenAI: GPT-5.3-Codex",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.4",
    "name": "OpenAI: GPT-5.4",
    "context": "1.1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.4-image-2",
    "name": "OpenAI: GPT-5.4 Image 2",
    "context": "272K",
    "capabilities": "Image",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.4-mini",
    "name": "OpenAI: GPT-5.4 Mini",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.4-nano",
    "name": "OpenAI: GPT-5.4 Nano",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.4-pro",
    "name": "OpenAI: GPT-5.4 Pro",
    "context": "1.1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.5",
    "name": "OpenAI: GPT-5.5",
    "context": "1.1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-5.5-pro",
    "name": "OpenAI: GPT-5.5 Pro",
    "context": "1.1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-audio",
    "name": "OpenAI: GPT Audio",
    "context": "128K",
    "capabilities": "Audio",
    "isFree": false
  },
  {
    "id": "openai/gpt-audio-mini",
    "name": "OpenAI: GPT Audio Mini",
    "context": "128K",
    "capabilities": "Audio",
    "isFree": false
  },
  {
    "id": "openai/gpt-chat-latest",
    "name": "OpenAI: GPT Chat Latest",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-oss-120b",
    "name": "OpenAI: gpt-oss-120b",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-oss-120b:free",
    "name": "OpenAI: gpt-oss-120b (free)",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "openai/gpt-oss-20b",
    "name": "OpenAI: gpt-oss-20b",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/gpt-oss-20b:free",
    "name": "OpenAI: gpt-oss-20b (free)",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "openai/gpt-oss-safeguard-20b",
    "name": "OpenAI: gpt-oss-safeguard-20b",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openai/o1",
    "name": "OpenAI: o1",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o1-pro",
    "name": "OpenAI: o1-pro",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o3",
    "name": "OpenAI: o3",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o3-deep-research",
    "name": "OpenAI: o3 Deep Research",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o3-mini",
    "name": "OpenAI: o3 Mini",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o3-mini-high",
    "name": "OpenAI: o3 Mini High",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o3-pro",
    "name": "OpenAI: o3 Pro",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o4-mini",
    "name": "OpenAI: o4 Mini",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o4-mini-deep-research",
    "name": "OpenAI: o4 Mini Deep Research",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openai/o4-mini-high",
    "name": "OpenAI: o4 Mini High",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen-2.5-72b-instruct",
    "name": "Qwen2.5 72B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen-2.5-7b-instruct",
    "name": "Qwen: Qwen2.5 7B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen-2.5-coder-32b-instruct",
    "name": "Qwen2.5 Coder 32B Instruct",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen-plus",
    "name": "Qwen: Qwen-Plus",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen-plus-2025-07-28",
    "name": "Qwen: Qwen Plus 0728",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen-plus-2025-07-28:thinking",
    "name": "Qwen: Qwen Plus 0728 (thinking)",
    "context": "1M",
    "capabilities": "Reasoning",
    "isFree": false
  },
  {
    "id": "qwen/qwen2.5-vl-72b-instruct",
    "name": "Qwen: Qwen2.5 VL 72B Instruct",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-14b",
    "name": "Qwen: Qwen3 14B",
    "context": "132K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-235b-a22b",
    "name": "Qwen: Qwen3 235B A22B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-235b-a22b-2507",
    "name": "Qwen: Qwen3 235B A22B Instruct 2507",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-235b-a22b-thinking-2507",
    "name": "Qwen: Qwen3 235B A22B Thinking 2507",
    "context": "262K",
    "capabilities": "Reasoning",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-30b-a3b",
    "name": "Qwen: Qwen3 30B A3B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-30b-a3b-instruct-2507",
    "name": "Qwen: Qwen3 30B A3B Instruct 2507",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-30b-a3b-thinking-2507",
    "name": "Qwen: Qwen3 30B A3B Thinking 2507",
    "context": "131K",
    "capabilities": "Reasoning",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-32b",
    "name": "Qwen: Qwen3 32B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-8b",
    "name": "Qwen: Qwen3 8B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-coder",
    "name": "Qwen: Qwen3 Coder 480B A35B",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-coder-30b-a3b-instruct",
    "name": "Qwen: Qwen3 Coder 30B A3B Instruct",
    "context": "160K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-coder-flash",
    "name": "Qwen: Qwen3 Coder Flash",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-coder-next",
    "name": "Qwen: Qwen3 Coder Next",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-coder-plus",
    "name": "Qwen: Qwen3 Coder Plus",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-coder:free",
    "name": "Qwen: Qwen3 Coder 480B A35B (free)",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "qwen/qwen3-max",
    "name": "Qwen: Qwen3 Max",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-max-thinking",
    "name": "Qwen: Qwen3 Max Thinking",
    "context": "262K",
    "capabilities": "Reasoning",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-instruct",
    "name": "Qwen: Qwen3 Next 80B A3B Instruct",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-instruct:free",
    "name": "Qwen: Qwen3 Next 80B A3B Instruct (free)",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-thinking",
    "name": "Qwen: Qwen3 Next 80B A3B Thinking",
    "context": "262K",
    "capabilities": "Reasoning",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-vl-235b-a22b-instruct",
    "name": "Qwen: Qwen3 VL 235B A22B Instruct",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-vl-235b-a22b-thinking",
    "name": "Qwen: Qwen3 VL 235B A22B Thinking",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-vl-30b-a3b-instruct",
    "name": "Qwen: Qwen3 VL 30B A3B Instruct",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-vl-30b-a3b-thinking",
    "name": "Qwen: Qwen3 VL 30B A3B Thinking",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-vl-32b-instruct",
    "name": "Qwen: Qwen3 VL 32B Instruct",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-vl-8b-instruct",
    "name": "Qwen: Qwen3 VL 8B Instruct",
    "context": "256K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3-vl-8b-thinking",
    "name": "Qwen: Qwen3 VL 8B Thinking",
    "context": "256K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.5-122b-a10b",
    "name": "Qwen: Qwen3.5-122B-A10B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.5-27b",
    "name": "Qwen: Qwen3.5-27B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.5-35b-a3b",
    "name": "Qwen: Qwen3.5-35B-A3B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.5-397b-a17b",
    "name": "Qwen: Qwen3.5 397B A17B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.5-9b",
    "name": "Qwen: Qwen3.5-9B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.5-flash-02-23",
    "name": "Qwen: Qwen3.5-Flash",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.5-plus-02-15",
    "name": "Qwen: Qwen3.5 Plus 2026-02-15",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.5-plus-20260420",
    "name": "Qwen: Qwen3.5 Plus 2026-04-20",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.6-27b",
    "name": "Qwen: Qwen3.6 27B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.6-35b-a3b",
    "name": "Qwen: Qwen3.6 35B A3B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.6-flash",
    "name": "Qwen: Qwen3.6 Flash",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.6-max-preview",
    "name": "Qwen: Qwen3.6 Max Preview",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.6-plus",
    "name": "Qwen: Qwen3.6 Plus",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.7-max",
    "name": "Qwen: Qwen3.7 Max",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "qwen/qwen3.7-plus",
    "name": "Qwen: Qwen3.7 Plus",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-2.5-flash",
    "name": "Google: Gemini 2.5 Flash",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-2.5-flash-image",
    "name": "Google: Nano Banana (Gemini 2.5 Flash Image)",
    "context": "33K",
    "capabilities": "Image",
    "isFree": false
  },
  {
    "id": "google/gemini-2.5-flash-lite",
    "name": "Google: Gemini 2.5 Flash Lite",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-2.5-flash-lite-preview-09-2025",
    "name": "Google: Gemini 2.5 Flash Lite Preview 09-2025",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-2.5-pro",
    "name": "Google: Gemini 2.5 Pro",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-2.5-pro-preview",
    "name": "Google: Gemini 2.5 Pro Preview 06-05",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-2.5-pro-preview-05-06",
    "name": "Google: Gemini 2.5 Pro Preview 05-06",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-3-flash-preview",
    "name": "Google: Gemini 3 Flash Preview",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-3-pro-image-preview",
    "name": "Google: Nano Banana Pro (Gemini 3 Pro Image Preview)",
    "context": "66K",
    "capabilities": "Image",
    "isFree": false
  },
  {
    "id": "google/gemini-3.1-flash-image-preview",
    "name": "Google: Nano Banana 2 (Gemini 3.1 Flash Image Preview)",
    "context": "131K",
    "capabilities": "Image",
    "isFree": false
  },
  {
    "id": "google/gemini-3.1-flash-lite",
    "name": "Google: Gemini 3.1 Flash Lite",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-3.1-flash-lite-preview",
    "name": "Google: Gemini 3.1 Flash Lite Preview",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-3.1-pro-preview",
    "name": "Google: Gemini 3.1 Pro Preview",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-3.1-pro-preview-customtools",
    "name": "Google: Gemini 3.1 Pro Preview Custom Tools",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemini-3.5-flash",
    "name": "Google: Gemini 3.5 Flash",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemma-2-27b-it",
    "name": "Google: Gemma 2 27B",
    "context": "8K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemma-3-12b-it",
    "name": "Google: Gemma 3 12B",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "google/gemma-3-27b-it",
    "name": "Google: Gemma 3 27B",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "google/gemma-3-4b-it",
    "name": "Google: Gemma 3 4B",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "google/gemma-3n-e4b-it",
    "name": "Google: Gemma 3n 4B",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "google/gemma-4-26b-a4b-it",
    "name": "Google: Gemma 4 26B A4B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "google/gemma-4-26b-a4b-it:free",
    "name": "Google: Gemma 4 26B A4B  (free)",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": true
  },
  {
    "id": "google/gemma-4-31b-it",
    "name": "Google: Gemma 4 31B",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "google/gemma-4-31b-it:free",
    "name": "Google: Gemma 4 31B (free)",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": true
  },
  {
    "id": "google/lyria-3-clip-preview",
    "name": "Google: Lyria 3 Clip Preview",
    "context": "1M",
    "capabilities": "Audio",
    "isFree": false
  },
  {
    "id": "google/lyria-3-pro-preview",
    "name": "Google: Lyria 3 Pro Preview",
    "context": "1M",
    "capabilities": "Audio",
    "isFree": false
  },
  {
    "id": "mistralai/codestral-2508",
    "name": "Mistral: Codestral 2508",
    "context": "256K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/devstral-2512",
    "name": "Mistral: Devstral 2 2512",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/ministral-14b-2512",
    "name": "Mistral: Ministral 3 14B 2512",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/ministral-3b-2512",
    "name": "Mistral: Ministral 3 3B 2512",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/ministral-8b-2512",
    "name": "Mistral: Ministral 3 8B 2512",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-large",
    "name": "Mistral Large",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-large-2407",
    "name": "Mistral Large 2407",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-large-2512",
    "name": "Mistral: Mistral Large 3 2512",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-medium-3",
    "name": "Mistral: Mistral Medium 3",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-medium-3-5",
    "name": "Mistral: Mistral Medium 3.5",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-medium-3.1",
    "name": "Mistral: Mistral Medium 3.1",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-nemo",
    "name": "Mistral: Mistral Nemo",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-saba",
    "name": "Mistral: Saba",
    "context": "33K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-small-24b-instruct-2501",
    "name": "Mistral: Mistral Small 3",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-small-2603",
    "name": "Mistral: Mistral Small 4",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-small-3.1-24b-instruct",
    "name": "Mistral: Mistral Small 3.1 24B",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mistral-small-3.2-24b-instruct",
    "name": "Mistral: Mistral Small 3.2 24B",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/mixtral-8x22b-instruct",
    "name": "Mistral: Mixtral 8x22B Instruct",
    "context": "66K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "mistralai/voxtral-small-24b-2507",
    "name": "Mistral: Voxtral Small 24B 2507",
    "context": "32K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-3-haiku",
    "name": "Anthropic: Claude 3 Haiku",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-3.5-haiku",
    "name": "Anthropic: Claude 3.5 Haiku",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-haiku-4.5",
    "name": "Anthropic: Claude Haiku 4.5",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4",
    "name": "Anthropic: Claude Opus 4",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4.1",
    "name": "Anthropic: Claude Opus 4.1",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4.5",
    "name": "Anthropic: Claude Opus 4.5",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4.6",
    "name": "Anthropic: Claude Opus 4.6",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4.6-fast",
    "name": "Anthropic: Claude Opus 4.6 (Fast)",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4.7",
    "name": "Anthropic: Claude Opus 4.7",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4.7-fast",
    "name": "Anthropic: Claude Opus 4.7 (Fast)",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4.8",
    "name": "Anthropic: Claude Opus 4.8",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-opus-4.8-fast",
    "name": "Anthropic: Claude Opus 4.8 (Fast)",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-sonnet-4",
    "name": "Anthropic: Claude Sonnet 4",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-sonnet-4.5",
    "name": "Anthropic: Claude Sonnet 4.5",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "anthropic/claude-sonnet-4.6",
    "name": "Anthropic: Claude Sonnet 4.6",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3-70b-instruct",
    "name": "Meta: Llama 3 70B Instruct",
    "context": "8K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3-8b-instruct",
    "name": "Meta: Llama 3 8B Instruct",
    "context": "8K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3.1-70b-instruct",
    "name": "Meta: Llama 3.1 70B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3.1-8b-instruct",
    "name": "Meta: Llama 3.1 8B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3.2-11b-vision-instruct",
    "name": "Meta: Llama 3.2 11B Vision Instruct",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3.2-1b-instruct",
    "name": "Meta: Llama 3.2 1B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3.2-3b-instruct",
    "name": "Meta: Llama 3.2 3B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3.2-3b-instruct:free",
    "name": "Meta: Llama 3.2 3B Instruct (free)",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "meta-llama/llama-3.3-70b-instruct",
    "name": "Meta: Llama 3.3 70B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-3.3-70b-instruct:free",
    "name": "Meta: Llama 3.3 70B Instruct (free)",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "meta-llama/llama-4-maverick",
    "name": "Meta: Llama 4 Maverick",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-4-scout",
    "name": "Meta: Llama 4 Scout",
    "context": "10M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-guard-3-8b",
    "name": "Llama Guard 3 8B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "meta-llama/llama-guard-4-12b",
    "name": "Meta: Llama Guard 4 12B",
    "context": "164K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-4-32b",
    "name": "Z.ai: GLM 4 32B",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-4.5",
    "name": "Z.ai: GLM 4.5",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-4.5-air",
    "name": "Z.ai: GLM 4.5 Air",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-4.5-air:free",
    "name": "Z.ai: GLM 4.5 Air (free)",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "z-ai/glm-4.5v",
    "name": "Z.ai: GLM 4.5V",
    "context": "66K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-4.6",
    "name": "Z.ai: GLM 4.6",
    "context": "203K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-4.6v",
    "name": "Z.ai: GLM 4.6V",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-4.7",
    "name": "Z.ai: GLM 4.7",
    "context": "203K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-4.7-flash",
    "name": "Z.ai: GLM 4.7 Flash",
    "context": "203K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-5",
    "name": "Z.ai: GLM 5",
    "context": "203K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-5-turbo",
    "name": "Z.ai: GLM 5 Turbo",
    "context": "203K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-5.1",
    "name": "Z.ai: GLM 5.1",
    "context": "203K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "z-ai/glm-5v-turbo",
    "name": "Z.ai: GLM 5V Turbo",
    "context": "203K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-chat",
    "name": "DeepSeek: DeepSeek V3",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-chat-v3-0324",
    "name": "DeepSeek: DeepSeek V3 0324",
    "context": "164K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-chat-v3.1",
    "name": "DeepSeek: DeepSeek V3.1",
    "context": "164K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-r1",
    "name": "DeepSeek: R1",
    "context": "164K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-r1-0528",
    "name": "DeepSeek: R1 0528",
    "context": "164K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-r1-distill-llama-70b",
    "name": "DeepSeek: R1 Distill Llama 70B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-r1-distill-qwen-32b",
    "name": "DeepSeek: R1 Distill Qwen 32B",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-v3.1-terminus",
    "name": "DeepSeek: DeepSeek V3.1 Terminus",
    "context": "164K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-v3.2",
    "name": "DeepSeek: DeepSeek V3.2",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-v3.2-exp",
    "name": "DeepSeek: DeepSeek V3.2 Exp",
    "context": "164K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-v4-flash",
    "name": "DeepSeek: DeepSeek V4 Flash",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "deepseek/deepseek-v4-pro",
    "name": "DeepSeek: DeepSeek V4 Pro",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "name": "NVIDIA: Llama 3.3 Nemotron Super 49B V1.5",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b",
    "name": "NVIDIA: Nemotron 3 Nano 30B A3B",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b:free",
    "name": "NVIDIA: Nemotron 3 Nano 30B A3B (free)",
    "context": "256K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "name": "NVIDIA: Nemotron 3 Nano Omni (free)",
    "context": "256K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b",
    "name": "NVIDIA: Nemotron 3 Super",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b:free",
    "name": "NVIDIA: Nemotron 3 Super (free)",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b",
    "name": "NVIDIA: Nemotron 3 Ultra",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
    "name": "NVIDIA: Nemotron 3 Ultra (free)",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "nvidia/nemotron-3.5-content-safety:free",
    "name": "NVIDIA: Nemotron 3.5 Content Safety (free)",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": true
  },
  {
    "id": "nvidia/nemotron-nano-12b-v2-vl:free",
    "name": "NVIDIA: Nemotron Nano 12B 2 VL (free)",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": true
  },
  {
    "id": "nvidia/nemotron-nano-9b-v2",
    "name": "NVIDIA: Nemotron Nano 9B V2",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nvidia/nemotron-nano-9b-v2:free",
    "name": "NVIDIA: Nemotron Nano 9B V2 (free)",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "minimax/minimax-01",
    "name": "MiniMax: MiniMax-01",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "minimax/minimax-m1",
    "name": "MiniMax: MiniMax M1",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "minimax/minimax-m2",
    "name": "MiniMax: MiniMax M2",
    "context": "205K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "minimax/minimax-m2-her",
    "name": "MiniMax: MiniMax M2-her",
    "context": "66K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "minimax/minimax-m2.1",
    "name": "MiniMax: MiniMax M2.1",
    "context": "205K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "minimax/minimax-m2.5",
    "name": "MiniMax: MiniMax M2.5",
    "context": "205K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "minimax/minimax-m2.7",
    "name": "MiniMax: MiniMax M2.7",
    "context": "205K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "minimax/minimax-m3",
    "name": "MiniMax: MiniMax M3",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "moonshotai/kimi-k2",
    "name": "MoonshotAI: Kimi K2 0711",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "moonshotai/kimi-k2-0905",
    "name": "MoonshotAI: Kimi K2 0905",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "moonshotai/kimi-k2-thinking",
    "name": "MoonshotAI: Kimi K2 Thinking",
    "context": "262K",
    "capabilities": "Reasoning",
    "isFree": false
  },
  {
    "id": "moonshotai/kimi-k2.5",
    "name": "MoonshotAI: Kimi K2.5",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "moonshotai/kimi-k2.6",
    "name": "MoonshotAI: Kimi K2.6",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "moonshotai/kimi-k2.6:free",
    "name": "MoonshotAI: Kimi K2.6 (free)",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": true
  },
  {
    "id": "openrouter/auto",
    "name": "Auto Router",
    "context": "2M",
    "capabilities": "Image",
    "isFree": false
  },
  {
    "id": "openrouter/bodybuilder",
    "name": "Body Builder (beta)",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openrouter/free",
    "name": "Free Models Router",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "openrouter/fusion",
    "name": "OpenRouter: Fusion",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openrouter/owl-alpha",
    "name": "Owl Alpha",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "openrouter/pareto-code",
    "name": "Pareto Code Router",
    "context": "2M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "amazon/nova-2-lite-v1",
    "name": "Amazon: Nova 2 Lite",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "amazon/nova-lite-v1",
    "name": "Amazon: Nova Lite 1.0",
    "context": "300K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "amazon/nova-micro-v1",
    "name": "Amazon: Nova Micro 1.0",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "amazon/nova-premier-v1",
    "name": "Amazon: Nova Premier 1.0",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "amazon/nova-pro-v1",
    "name": "Amazon: Nova Pro 1.0",
    "context": "300K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "arcee-ai/coder-large",
    "name": "Arcee AI: Coder Large",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "arcee-ai/maestro-reasoning",
    "name": "Arcee AI: Maestro Reasoning",
    "context": "131K",
    "capabilities": "Reasoning",
    "isFree": false
  },
  {
    "id": "arcee-ai/trinity-large-thinking",
    "name": "Arcee AI: Trinity Large Thinking",
    "context": "262K",
    "capabilities": "Reasoning",
    "isFree": false
  },
  {
    "id": "arcee-ai/trinity-mini",
    "name": "Arcee AI: Trinity Mini",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "arcee-ai/virtuoso-large",
    "name": "Arcee AI: Virtuoso Large",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-405b",
    "name": "Nous: Hermes 3 405B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-405b:free",
    "name": "Nous: Hermes 3 405B Instruct (free)",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-70b",
    "name": "Nous: Hermes 3 70B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nousresearch/hermes-4-405b",
    "name": "Nous: Hermes 4 405B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nousresearch/hermes-4-70b",
    "name": "Nous: Hermes 4 70B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "perplexity/sonar",
    "name": "Perplexity: Sonar",
    "context": "127K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "perplexity/sonar-deep-research",
    "name": "Perplexity: Sonar Deep Research",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "perplexity/sonar-pro",
    "name": "Perplexity: Sonar Pro",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "perplexity/sonar-pro-search",
    "name": "Perplexity: Sonar Pro Search",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "perplexity/sonar-reasoning-pro",
    "name": "Perplexity: Sonar Reasoning Pro",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "aion-labs/aion-1.0",
    "name": "AionLabs: Aion-1.0",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "aion-labs/aion-1.0-mini",
    "name": "AionLabs: Aion-1.0-Mini",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "aion-labs/aion-2.0",
    "name": "AionLabs: Aion-2.0",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "aion-labs/aion-rp-llama-3.1-8b",
    "name": "AionLabs: Aion-RP 1.0 (8B)",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "bytedance-seed/seed-1.6",
    "name": "ByteDance Seed: Seed 1.6",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "bytedance-seed/seed-1.6-flash",
    "name": "ByteDance Seed: Seed 1.6 Flash",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "bytedance-seed/seed-2.0-lite",
    "name": "ByteDance Seed: Seed-2.0-Lite",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "bytedance-seed/seed-2.0-mini",
    "name": "ByteDance Seed: Seed-2.0-Mini",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "cohere/command-a",
    "name": "Cohere: Command A",
    "context": "256K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "cohere/command-r-08-2024",
    "name": "Cohere: Command R (08-2024)",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "cohere/command-r-plus-08-2024",
    "name": "Cohere: Command R+ (08-2024)",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "cohere/command-r7b-12-2024",
    "name": "Cohere: Command R7B (12-2024)",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "sao10k/l3-lunaris-8b",
    "name": "Sao10K: Llama 3 8B Lunaris",
    "context": "8K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "sao10k/l3.1-70b-hanami-x1",
    "name": "Sao10K: Llama 3.1 70B Hanami x1",
    "context": "16K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "sao10k/l3.1-euryale-70b",
    "name": "Sao10K: Llama 3.1 Euryale 70B v2.2",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "sao10k/l3.3-euryale-70b",
    "name": "Sao10K: Llama 3.3 Euryale 70B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "thedrummer/cydonia-24b-v4.1",
    "name": "TheDrummer: Cydonia 24B V4.1",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "thedrummer/rocinante-12b",
    "name": "TheDrummer: Rocinante 12B",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "thedrummer/skyfall-36b-v2",
    "name": "TheDrummer: Skyfall 36B V2",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "thedrummer/unslopnemo-12b",
    "name": "TheDrummer: UnslopNemo 12B",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "x-ai/grok-4.20",
    "name": "xAI: Grok 4.20",
    "context": "2M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "x-ai/grok-4.20-multi-agent",
    "name": "xAI: Grok 4.20 Multi-Agent",
    "context": "2M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "x-ai/grok-4.3",
    "name": "xAI: Grok 4.3",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "x-ai/grok-build-0.1",
    "name": "xAI: Grok Build 0.1",
    "context": "256K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "inclusionai/ling-2.6-1t",
    "name": "inclusionAI: Ling-2.6-1T",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "inclusionai/ling-2.6-flash",
    "name": "inclusionAI: Ling-2.6-flash",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "inclusionai/ring-2.6-1t",
    "name": "inclusionAI: Ring-2.6-1T",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "liquid/lfm-2-24b-a2b",
    "name": "LiquidAI: LFM2-24B-A2B",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "liquid/lfm-2.5-1.2b-instruct:free",
    "name": "LiquidAI: LFM2.5-1.2B-Instruct (free)",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "liquid/lfm-2.5-1.2b-thinking:free",
    "name": "LiquidAI: LFM2.5-1.2B-Thinking (free)",
    "context": "33K",
    "capabilities": "Reasoning",
    "isFree": true
  },
  {
    "id": "microsoft/phi-4",
    "name": "Microsoft: Phi 4",
    "context": "16K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "microsoft/phi-4-mini-instruct",
    "name": "Microsoft: Phi 4 Mini Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "microsoft/wizardlm-2-8x22b",
    "name": "WizardLM-2 8x22B",
    "context": "66K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "xiaomi/mimo-v2-flash",
    "name": "Xiaomi: MiMo-V2-Flash",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "xiaomi/mimo-v2.5",
    "name": "Xiaomi: MiMo-V2.5",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "xiaomi/mimo-v2.5-pro",
    "name": "Xiaomi: MiMo-V2.5-Pro",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "~anthropic/claude-haiku-latest",
    "name": "Anthropic Claude Haiku Latest",
    "context": "200K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "~anthropic/claude-opus-latest",
    "name": "Anthropic: Claude Opus Latest",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "~anthropic/claude-sonnet-latest",
    "name": "Anthropic Claude Sonnet Latest",
    "context": "1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "ibm-granite/granite-4.0-h-micro",
    "name": "IBM: Granite 4.0 Micro",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "ibm-granite/granite-4.1-8b",
    "name": "IBM: Granite 4.1 8B",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "inflection/inflection-3-pi",
    "name": "Inflection: Inflection 3 Pi",
    "context": "8K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "inflection/inflection-3-productivity",
    "name": "Inflection: Inflection 3 Productivity",
    "context": "8K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "morph/morph-v3-fast",
    "name": "Morph: Morph V3 Fast",
    "context": "82K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "morph/morph-v3-large",
    "name": "Morph: Morph V3 Large",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "poolside/laguna-m.1:free",
    "name": "Poolside: Laguna M.1 (free)",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "poolside/laguna-xs.2:free",
    "name": "Poolside: Laguna XS.2 (free)",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "rekaai/reka-edge",
    "name": "Reka Edge",
    "context": "16K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "rekaai/reka-flash-3",
    "name": "Reka Flash 3",
    "context": "66K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "relace/relace-apply-3",
    "name": "Relace: Relace Apply 3",
    "context": "256K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "relace/relace-search",
    "name": "Relace: Relace Search",
    "context": "256K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "stepfun/step-3.5-flash",
    "name": "StepFun: Step 3.5 Flash",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "stepfun/step-3.7-flash",
    "name": "StepFun: Step 3.7 Flash",
    "context": "256K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "tencent/hunyuan-a13b-instruct",
    "name": "Tencent: Hunyuan A13B Instruct",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "tencent/hy3-preview",
    "name": "Tencent: Hy3 preview",
    "context": "262K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "~google/gemini-flash-latest",
    "name": "Google Gemini Flash Latest",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "~google/gemini-pro-latest",
    "name": "Google Gemini Pro Latest",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "~openai/gpt-latest",
    "name": "OpenAI GPT Latest",
    "context": "1.1M",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "~openai/gpt-mini-latest",
    "name": "OpenAI GPT Mini Latest",
    "context": "400K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "ai21/jamba-large-1.7",
    "name": "AI21: Jamba Large 1.7",
    "context": "256K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "allenai/olmo-3-32b-think",
    "name": "AllenAI: Olmo 3 32B Think",
    "context": "66K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "anthracite-org/magnum-v4-72b",
    "name": "Magnum v4 72B",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "baidu/ernie-4.5-vl-424b-a47b",
    "name": "Baidu: ERNIE 4.5 VL 424B A47B",
    "context": "131K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "bytedance/ui-tars-1.5-7b",
    "name": "ByteDance: UI-TARS 7B",
    "context": "128K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "name": "Venice: Uncensored (free)",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": true
  },
  {
    "id": "deepcogito/cogito-v2.1-671b",
    "name": "Deep Cogito: Cogito v2.1 671B",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "essentialai/rnj-1-instruct",
    "name": "EssentialAI: Rnj 1 Instruct",
    "context": "33K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "gryphe/mythomax-l2-13b",
    "name": "MythoMax 13B",
    "context": "4K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "inception/mercury-2",
    "name": "Inception: Mercury 2",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "kwaipilot/kat-coder-pro-v2",
    "name": "Kwaipilot: KAT-Coder-Pro V2",
    "context": "256K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "mancer/weaver",
    "name": "Mancer: Weaver (alpha)",
    "context": "8K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "nex-agi/deepseek-v3.1-nex-n1",
    "name": "Nex AGI: DeepSeek V3.1 Nex N1",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "perceptron/perceptron-mk1",
    "name": "Perceptron: Perceptron Mk1",
    "context": "33K",
    "capabilities": "Vision, Tools",
    "isFree": false
  },
  {
    "id": "prime-intellect/intellect-3",
    "name": "Prime Intellect: INTELLECT-3",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "switchpoint/router",
    "name": "Switchpoint Router",
    "context": "131K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "undi95/remm-slerp-l2-13b",
    "name": "ReMM SLERP 13B",
    "context": "6K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "upstage/solar-pro-3",
    "name": "Upstage: Solar Pro 3",
    "context": "128K",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "writer/palmyra-x5",
    "name": "Writer: Palmyra X5",
    "context": "1M",
    "capabilities": "Tools",
    "isFree": false
  },
  {
    "id": "~moonshotai/kimi-latest",
    "name": "MoonshotAI Kimi Latest",
    "context": "262K",
    "capabilities": "Vision, Tools",
    "isFree": false
  }
];

export const OPENROUTER_EMBEDDING_MODELS: ModelPreset[] = [
  {
    "id": "openai/text-embedding-3-small",
    "name": "OpenAI Text Embedding 3 (Small)",
    "context": "8K",
    "capabilities": "Embedding"
  },
  {
    "id": "openai/text-embedding-3-large",
    "name": "OpenAI Text Embedding 3 (Large)",
    "context": "8K",
    "capabilities": "Embedding"
  }
];
