import type { ModelPreset } from './openai';

export const GROQ_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "llama-3.1-8b-instant",
    "name": "Meta Llama 3.1 8B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "llama-3.3-70b-versatile",
    "name": "Meta Llama 3.3 70B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-120b",
    "name": "GPT-OSS 120B",
    "context": "128K",
    "capabilities": "Reasoning"
  },
  {
    "id": "openai/gpt-oss-20b",
    "name": "GPT-OSS 20B",
    "context": "128K",
    "capabilities": "Reasoning"
  },
  {
    "id": "groq/compound",
    "name": "Groq Compound",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "groq/compound-mini",
    "name": "Groq Compound Mini",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "whisper-large-v3",
    "name": "Whisper Large V3",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "whisper-large-v3-turbo",
    "name": "Whisper Large V3 Turbo",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "canopylabs/orpheus-v1-english",
    "name": "Canopy Labs Orpheus V1 English",
    "context": "128K",
    "capabilities": "Speech"
  },
  {
    "id": "canopylabs/orpheus-arabic-saudi",
    "name": "Canopy Labs Orpheus Arabic Saudi",
    "context": "128K",
    "capabilities": "Speech"
  },
  {
    "id": "meta-llama/llama-4-scout-17b-16e-instruct",
    "name": "Llama 4 Scout 17B 16E",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "meta-llama/llama-prompt-guard-2-22m",
    "name": "Llama Prompt Guard 2 22M",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-prompt-guard-2-86m",
    "name": "Prompt Guard 2 86M",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-safeguard-20b",
    "name": "Safety GPT OSS 20B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-32b",
    "name": "Qwen3-32B",
    "context": "128K",
    "capabilities": "Reasoning"
  },
  {
    "id": "openai/gpt-3.5-turbo",
    "name": "OpenAI: GPT-3.5 Turbo",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-3.5-turbo-0613",
    "name": "OpenAI: GPT-3.5 Turbo (older v0613)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-3.5-turbo-16k",
    "name": "OpenAI: GPT-3.5 Turbo 16k",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-3.5-turbo-instruct",
    "name": "OpenAI: GPT-3.5 Turbo Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4",
    "name": "OpenAI: GPT-4",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4-turbo",
    "name": "OpenAI: GPT-4 Turbo",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4-turbo-preview",
    "name": "OpenAI: GPT-4 Turbo Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4.1",
    "name": "OpenAI: GPT-4.1",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4.1-mini",
    "name": "OpenAI: GPT-4.1 Mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4.1-nano",
    "name": "OpenAI: GPT-4.1 Nano",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4o",
    "name": "OpenAI: GPT-4o",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4o-2024-05-13",
    "name": "OpenAI: GPT-4o (2024-05-13)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4o-2024-08-06",
    "name": "OpenAI: GPT-4o (2024-08-06)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4o-2024-11-20",
    "name": "OpenAI: GPT-4o (2024-11-20)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4o-mini",
    "name": "OpenAI: GPT-4o-mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4o-mini-2024-07-18",
    "name": "OpenAI: GPT-4o-mini (2024-07-18)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-4o-mini-search-preview",
    "name": "OpenAI: GPT-4o-mini Search Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o-search-preview",
    "name": "OpenAI: GPT-4o Search Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5",
    "name": "OpenAI: GPT-5",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5-chat",
    "name": "OpenAI: GPT-5 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5-codex",
    "name": "OpenAI: GPT-5 Codex",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5-image",
    "name": "OpenAI: GPT-5 Image",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-image-mini",
    "name": "OpenAI: GPT-5 Image Mini",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-mini",
    "name": "OpenAI: GPT-5 Mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5-nano",
    "name": "OpenAI: GPT-5 Nano",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5-pro",
    "name": "OpenAI: GPT-5 Pro",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.1",
    "name": "OpenAI: GPT-5.1",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.1-chat",
    "name": "OpenAI: GPT-5.1 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.1-codex",
    "name": "OpenAI: GPT-5.1-Codex",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.1-codex-max",
    "name": "OpenAI: GPT-5.1-Codex-Max",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.1-codex-mini",
    "name": "OpenAI: GPT-5.1-Codex-Mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.2",
    "name": "OpenAI: GPT-5.2",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.2-chat",
    "name": "OpenAI: GPT-5.2 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.2-codex",
    "name": "OpenAI: GPT-5.2-Codex",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.2-pro",
    "name": "OpenAI: GPT-5.2 Pro",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.3-chat",
    "name": "OpenAI: GPT-5.3 Chat",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.3-codex",
    "name": "OpenAI: GPT-5.3-Codex",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.4",
    "name": "OpenAI: GPT-5.4",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.4-image-2",
    "name": "OpenAI: GPT-5.4 Image 2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.4-mini",
    "name": "OpenAI: GPT-5.4 Mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.4-nano",
    "name": "OpenAI: GPT-5.4 Nano",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.4-pro",
    "name": "OpenAI: GPT-5.4 Pro",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.5",
    "name": "OpenAI: GPT-5.5",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-5.5-pro",
    "name": "OpenAI: GPT-5.5 Pro",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-audio",
    "name": "OpenAI: GPT Audio",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "openai/gpt-audio-mini",
    "name": "OpenAI: GPT Audio Mini",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "openai/gpt-chat-latest",
    "name": "OpenAI: GPT Chat Latest",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/gpt-oss-120b",
    "name": "OpenAI: gpt-oss-120b",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-120b:free",
    "name": "OpenAI: gpt-oss-120b (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-20b",
    "name": "OpenAI: gpt-oss-20b",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-20b:free",
    "name": "OpenAI: gpt-oss-20b (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-safeguard-20b",
    "name": "OpenAI: gpt-oss-safeguard-20b",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o1",
    "name": "OpenAI: o1",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o1-pro",
    "name": "OpenAI: o1-pro",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o3",
    "name": "OpenAI: o3",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o3-deep-research",
    "name": "OpenAI: o3 Deep Research",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o3-mini",
    "name": "OpenAI: o3 Mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o3-mini-high",
    "name": "OpenAI: o3 Mini High",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o3-pro",
    "name": "OpenAI: o3 Pro",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o4-mini",
    "name": "OpenAI: o4 Mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o4-mini-deep-research",
    "name": "OpenAI: o4 Mini Deep Research",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openai/o4-mini-high",
    "name": "OpenAI: o4 Mini High",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen-2.5-72b-instruct",
    "name": "Qwen2.5 72B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-2.5-7b-instruct",
    "name": "Qwen: Qwen2.5 7B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-2.5-coder-32b-instruct",
    "name": "Qwen2.5 Coder 32B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-plus",
    "name": "Qwen: Qwen-Plus",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-plus-2025-07-28",
    "name": "Qwen: Qwen Plus 0728",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-plus-2025-07-28:thinking",
    "name": "Qwen: Qwen Plus 0728 (thinking)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen2.5-vl-72b-instruct",
    "name": "Qwen: Qwen2.5 VL 72B Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3-14b",
    "name": "Qwen: Qwen3 14B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-235b-a22b",
    "name": "Qwen: Qwen3 235B A22B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-235b-a22b-2507",
    "name": "Qwen: Qwen3 235B A22B Instruct 2507",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-235b-a22b-thinking-2507",
    "name": "Qwen: Qwen3 235B A22B Thinking 2507",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-30b-a3b",
    "name": "Qwen: Qwen3 30B A3B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-30b-a3b-instruct-2507",
    "name": "Qwen: Qwen3 30B A3B Instruct 2507",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-30b-a3b-thinking-2507",
    "name": "Qwen: Qwen3 30B A3B Thinking 2507",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-32b",
    "name": "Qwen: Qwen3 32B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-8b",
    "name": "Qwen: Qwen3 8B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder",
    "name": "Qwen: Qwen3 Coder 480B A35B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder-30b-a3b-instruct",
    "name": "Qwen: Qwen3 Coder 30B A3B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder-flash",
    "name": "Qwen: Qwen3 Coder Flash",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder-next",
    "name": "Qwen: Qwen3 Coder Next",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder-plus",
    "name": "Qwen: Qwen3 Coder Plus",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder:free",
    "name": "Qwen: Qwen3 Coder 480B A35B (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-max",
    "name": "Qwen: Qwen3 Max",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-max-thinking",
    "name": "Qwen: Qwen3 Max Thinking",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-instruct",
    "name": "Qwen: Qwen3 Next 80B A3B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-instruct:free",
    "name": "Qwen: Qwen3 Next 80B A3B Instruct (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-thinking",
    "name": "Qwen: Qwen3 Next 80B A3B Thinking",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-vl-235b-a22b-instruct",
    "name": "Qwen: Qwen3 VL 235B A22B Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3-vl-235b-a22b-thinking",
    "name": "Qwen: Qwen3 VL 235B A22B Thinking",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3-vl-30b-a3b-instruct",
    "name": "Qwen: Qwen3 VL 30B A3B Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3-vl-30b-a3b-thinking",
    "name": "Qwen: Qwen3 VL 30B A3B Thinking",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3-vl-32b-instruct",
    "name": "Qwen: Qwen3 VL 32B Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3-vl-8b-instruct",
    "name": "Qwen: Qwen3 VL 8B Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3-vl-8b-thinking",
    "name": "Qwen: Qwen3 VL 8B Thinking",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.5-122b-a10b",
    "name": "Qwen: Qwen3.5-122B-A10B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.5-27b",
    "name": "Qwen: Qwen3.5-27B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.5-35b-a3b",
    "name": "Qwen: Qwen3.5-35B-A3B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.5-397b-a17b",
    "name": "Qwen: Qwen3.5 397B A17B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.5-9b",
    "name": "Qwen: Qwen3.5-9B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.5-flash-02-23",
    "name": "Qwen: Qwen3.5-Flash",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.5-plus-02-15",
    "name": "Qwen: Qwen3.5 Plus 2026-02-15",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.5-plus-20260420",
    "name": "Qwen: Qwen3.5 Plus 2026-04-20",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.6-27b",
    "name": "Qwen: Qwen3.6 27B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.6-35b-a3b",
    "name": "Qwen: Qwen3.6 35B A3B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.6-flash",
    "name": "Qwen: Qwen3.6 Flash",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.6-max-preview",
    "name": "Qwen: Qwen3.6 Max Preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.6-plus",
    "name": "Qwen: Qwen3.6 Plus",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "qwen/qwen3.7-max",
    "name": "Qwen: Qwen3.7 Max",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.7-plus",
    "name": "Qwen: Qwen3.7 Plus",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "google/gemini-2.5-flash",
    "name": "Google: Gemini 2.5 Flash",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-2.5-flash-image",
    "name": "Google: Nano Banana (Gemini 2.5 Flash Image)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-2.5-flash-lite",
    "name": "Google: Gemini 2.5 Flash Lite",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-2.5-flash-lite-preview-09-2025",
    "name": "Google: Gemini 2.5 Flash Lite Preview 09-2025",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-2.5-pro",
    "name": "Google: Gemini 2.5 Pro",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-2.5-pro-preview",
    "name": "Google: Gemini 2.5 Pro Preview 06-05",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-2.5-pro-preview-05-06",
    "name": "Google: Gemini 2.5 Pro Preview 05-06",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-3-flash-preview",
    "name": "Google: Gemini 3 Flash Preview",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-3-pro-image-preview",
    "name": "Google: Nano Banana Pro (Gemini 3 Pro Image Preview)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3.1-flash-image-preview",
    "name": "Google: Nano Banana 2 (Gemini 3.1 Flash Image Preview)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3.1-flash-lite",
    "name": "Google: Gemini 3.1 Flash Lite",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-3.1-flash-lite-preview",
    "name": "Google: Gemini 3.1 Flash Lite Preview",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-3.1-pro-preview",
    "name": "Google: Gemini 3.1 Pro Preview",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-3.1-pro-preview-customtools",
    "name": "Google: Gemini 3.1 Pro Preview Custom Tools",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-3.5-flash",
    "name": "Google: Gemini 3.5 Flash",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemma-2-27b-it",
    "name": "Google: Gemma 2 27B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-3-12b-it",
    "name": "Google: Gemma 3 12B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "google/gemma-3-27b-it",
    "name": "Google: Gemma 3 27B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "google/gemma-3-4b-it",
    "name": "Google: Gemma 3 4B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "google/gemma-3n-e4b-it",
    "name": "Google: Gemma 3n 4B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-4-26b-a4b-it",
    "name": "Google: Gemma 4 26B A4B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "google/gemma-4-26b-a4b-it:free",
    "name": "Google: Gemma 4 26B A4B  (free)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "google/gemma-4-31b-it",
    "name": "Google: Gemma 4 31B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "google/gemma-4-31b-it:free",
    "name": "Google: Gemma 4 31B (free)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "google/lyria-3-clip-preview",
    "name": "Google: Lyria 3 Clip Preview",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/lyria-3-pro-preview",
    "name": "Google: Lyria 3 Pro Preview",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "mistralai/codestral-2508",
    "name": "Mistral: Codestral 2508",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/devstral-2512",
    "name": "Mistral: Devstral 2 2512",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/ministral-14b-2512",
    "name": "Mistral: Ministral 3 14B 2512",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/ministral-3b-2512",
    "name": "Mistral: Ministral 3 3B 2512",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/ministral-8b-2512",
    "name": "Mistral: Ministral 3 8B 2512",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-large",
    "name": "Mistral Large",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-large-2407",
    "name": "Mistral Large 2407",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-large-2512",
    "name": "Mistral: Mistral Large 3 2512",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-medium-3",
    "name": "Mistral: Mistral Medium 3",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-medium-3-5",
    "name": "Mistral: Mistral Medium 3.5",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-medium-3.1",
    "name": "Mistral: Mistral Medium 3.1",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-nemo",
    "name": "Mistral: Mistral Nemo",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-saba",
    "name": "Mistral: Saba",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-small-24b-instruct-2501",
    "name": "Mistral: Mistral Small 3",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-small-2603",
    "name": "Mistral: Mistral Small 4",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-small-3.1-24b-instruct",
    "name": "Mistral: Mistral Small 3.1 24B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mistral-small-3.2-24b-instruct",
    "name": "Mistral: Mistral Small 3.2 24B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/mixtral-8x22b-instruct",
    "name": "Mistral: Mixtral 8x22B Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistralai/voxtral-small-24b-2507",
    "name": "Mistral: Voxtral Small 24B 2507",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "anthropic/claude-3-haiku",
    "name": "Anthropic: Claude 3 Haiku",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-3.5-haiku",
    "name": "Anthropic: Claude 3.5 Haiku",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-haiku-4.5",
    "name": "Anthropic: Claude Haiku 4.5",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4",
    "name": "Anthropic: Claude Opus 4",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4.1",
    "name": "Anthropic: Claude Opus 4.1",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4.5",
    "name": "Anthropic: Claude Opus 4.5",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4.6",
    "name": "Anthropic: Claude Opus 4.6",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4.6-fast",
    "name": "Anthropic: Claude Opus 4.6 (Fast)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4.7",
    "name": "Anthropic: Claude Opus 4.7",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4.7-fast",
    "name": "Anthropic: Claude Opus 4.7 (Fast)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4.8",
    "name": "Anthropic: Claude Opus 4.8",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-opus-4.8-fast",
    "name": "Anthropic: Claude Opus 4.8 (Fast)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-sonnet-4",
    "name": "Anthropic: Claude Sonnet 4",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-sonnet-4.5",
    "name": "Anthropic: Claude Sonnet 4.5",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "anthropic/claude-sonnet-4.6",
    "name": "Anthropic: Claude Sonnet 4.6",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "meta-llama/llama-3-70b-instruct",
    "name": "Meta: Llama 3 70B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3-8b-instruct",
    "name": "Meta: Llama 3 8B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.1-70b-instruct",
    "name": "Meta: Llama 3.1 70B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.1-8b-instruct",
    "name": "Meta: Llama 3.1 8B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.2-11b-vision-instruct",
    "name": "Meta: Llama 3.2 11B Vision Instruct",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "meta-llama/llama-3.2-1b-instruct",
    "name": "Meta: Llama 3.2 1B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.2-3b-instruct",
    "name": "Meta: Llama 3.2 3B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.2-3b-instruct:free",
    "name": "Meta: Llama 3.2 3B Instruct (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.3-70b-instruct",
    "name": "Meta: Llama 3.3 70B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.3-70b-instruct:free",
    "name": "Meta: Llama 3.3 70B Instruct (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-4-maverick",
    "name": "Meta: Llama 4 Maverick",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "meta-llama/llama-4-scout",
    "name": "Meta: Llama 4 Scout",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "meta-llama/llama-guard-3-8b",
    "name": "Llama Guard 3 8B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-guard-4-12b",
    "name": "Meta: Llama Guard 4 12B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "z-ai/glm-4-32b",
    "name": "Z.ai: GLM 4 32B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.5",
    "name": "Z.ai: GLM 4.5",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.5-air",
    "name": "Z.ai: GLM 4.5 Air",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.5-air:free",
    "name": "Z.ai: GLM 4.5 Air (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.5v",
    "name": "Z.ai: GLM 4.5V",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "z-ai/glm-4.6",
    "name": "Z.ai: GLM 4.6",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.6v",
    "name": "Z.ai: GLM 4.6V",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "z-ai/glm-4.7",
    "name": "Z.ai: GLM 4.7",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.7-flash",
    "name": "Z.ai: GLM 4.7 Flash",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-5",
    "name": "Z.ai: GLM 5",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-5-turbo",
    "name": "Z.ai: GLM 5 Turbo",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-5.1",
    "name": "Z.ai: GLM 5.1",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-5v-turbo",
    "name": "Z.ai: GLM 5V Turbo",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "deepseek/deepseek-chat",
    "name": "DeepSeek: DeepSeek V3",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-chat-v3-0324",
    "name": "DeepSeek: DeepSeek V3 0324",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-chat-v3.1",
    "name": "DeepSeek: DeepSeek V3.1",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-r1",
    "name": "DeepSeek: R1",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-r1-0528",
    "name": "DeepSeek: R1 0528",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-r1-distill-llama-70b",
    "name": "DeepSeek: R1 Distill Llama 70B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-r1-distill-qwen-32b",
    "name": "DeepSeek: R1 Distill Qwen 32B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v3.1-terminus",
    "name": "DeepSeek: DeepSeek V3.1 Terminus",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v3.2",
    "name": "DeepSeek: DeepSeek V3.2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v3.2-exp",
    "name": "DeepSeek: DeepSeek V3.2 Exp",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v4-flash",
    "name": "DeepSeek: DeepSeek V4 Flash",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v4-pro",
    "name": "DeepSeek: DeepSeek V4 Pro",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "name": "NVIDIA: Llama 3.3 Nemotron Super 49B V1.5",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b",
    "name": "NVIDIA: Nemotron 3 Nano 30B A3B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b:free",
    "name": "NVIDIA: Nemotron 3 Nano 30B A3B (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "name": "NVIDIA: Nemotron 3 Nano Omni (free)",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b",
    "name": "NVIDIA: Nemotron 3 Super",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b:free",
    "name": "NVIDIA: Nemotron 3 Super (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b",
    "name": "NVIDIA: Nemotron 3 Ultra",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
    "name": "NVIDIA: Nemotron 3 Ultra (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3.5-content-safety:free",
    "name": "NVIDIA: Nemotron 3.5 Content Safety (free)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "nvidia/nemotron-nano-12b-v2-vl:free",
    "name": "NVIDIA: Nemotron Nano 12B 2 VL (free)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "nvidia/nemotron-nano-9b-v2",
    "name": "NVIDIA: Nemotron Nano 9B V2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-nano-9b-v2:free",
    "name": "NVIDIA: Nemotron Nano 9B V2 (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-01",
    "name": "MiniMax: MiniMax-01",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "minimax/minimax-m1",
    "name": "MiniMax: MiniMax M1",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2",
    "name": "MiniMax: MiniMax M2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2-her",
    "name": "MiniMax: MiniMax M2-her",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2.1",
    "name": "MiniMax: MiniMax M2.1",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2.5",
    "name": "MiniMax: MiniMax M2.5",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2.7",
    "name": "MiniMax: MiniMax M2.7",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m3",
    "name": "MiniMax: MiniMax M3",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "moonshotai/kimi-k2",
    "name": "MoonshotAI: Kimi K2 0711",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2-0905",
    "name": "MoonshotAI: Kimi K2 0905",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2-thinking",
    "name": "MoonshotAI: Kimi K2 Thinking",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2.5",
    "name": "MoonshotAI: Kimi K2.5",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "moonshotai/kimi-k2.6",
    "name": "MoonshotAI: Kimi K2.6",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "moonshotai/kimi-k2.6:free",
    "name": "MoonshotAI: Kimi K2.6 (free)",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openrouter/auto",
    "name": "Auto Router",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/bodybuilder",
    "name": "Body Builder (beta)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/free",
    "name": "Free Models Router",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "openrouter/fusion",
    "name": "OpenRouter: Fusion",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/owl-alpha",
    "name": "Owl Alpha",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/pareto-code",
    "name": "Pareto Code Router",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "amazon/nova-2-lite-v1",
    "name": "Amazon: Nova 2 Lite",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "amazon/nova-lite-v1",
    "name": "Amazon: Nova Lite 1.0",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "amazon/nova-micro-v1",
    "name": "Amazon: Nova Micro 1.0",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "amazon/nova-premier-v1",
    "name": "Amazon: Nova Premier 1.0",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "amazon/nova-pro-v1",
    "name": "Amazon: Nova Pro 1.0",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "arcee-ai/coder-large",
    "name": "Arcee AI: Coder Large",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "arcee-ai/maestro-reasoning",
    "name": "Arcee AI: Maestro Reasoning",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "arcee-ai/trinity-large-thinking",
    "name": "Arcee AI: Trinity Large Thinking",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "arcee-ai/trinity-mini",
    "name": "Arcee AI: Trinity Mini",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "arcee-ai/virtuoso-large",
    "name": "Arcee AI: Virtuoso Large",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-405b",
    "name": "Nous: Hermes 3 405B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-405b:free",
    "name": "Nous: Hermes 3 405B Instruct (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-70b",
    "name": "Nous: Hermes 3 70B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-4-405b",
    "name": "Nous: Hermes 4 405B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-4-70b",
    "name": "Nous: Hermes 4 70B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perplexity/sonar",
    "name": "Perplexity: Sonar",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "perplexity/sonar-deep-research",
    "name": "Perplexity: Sonar Deep Research",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perplexity/sonar-pro",
    "name": "Perplexity: Sonar Pro",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "perplexity/sonar-pro-search",
    "name": "Perplexity: Sonar Pro Search",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "perplexity/sonar-reasoning-pro",
    "name": "Perplexity: Sonar Reasoning Pro",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "aion-labs/aion-1.0",
    "name": "AionLabs: Aion-1.0",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "aion-labs/aion-1.0-mini",
    "name": "AionLabs: Aion-1.0-Mini",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "aion-labs/aion-2.0",
    "name": "AionLabs: Aion-2.0",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "aion-labs/aion-rp-llama-3.1-8b",
    "name": "AionLabs: Aion-RP 1.0 (8B)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "bytedance-seed/seed-1.6",
    "name": "ByteDance Seed: Seed 1.6",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "bytedance-seed/seed-1.6-flash",
    "name": "ByteDance Seed: Seed 1.6 Flash",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "bytedance-seed/seed-2.0-lite",
    "name": "ByteDance Seed: Seed-2.0-Lite",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "bytedance-seed/seed-2.0-mini",
    "name": "ByteDance Seed: Seed-2.0-Mini",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "cohere/command-a",
    "name": "Cohere: Command A",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "cohere/command-r-08-2024",
    "name": "Cohere: Command R (08-2024)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "cohere/command-r-plus-08-2024",
    "name": "Cohere: Command R+ (08-2024)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "cohere/command-r7b-12-2024",
    "name": "Cohere: Command R7B (12-2024)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "sao10k/l3-lunaris-8b",
    "name": "Sao10K: Llama 3 8B Lunaris",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "sao10k/l3.1-70b-hanami-x1",
    "name": "Sao10K: Llama 3.1 70B Hanami x1",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "sao10k/l3.1-euryale-70b",
    "name": "Sao10K: Llama 3.1 Euryale 70B v2.2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "sao10k/l3.3-euryale-70b",
    "name": "Sao10K: Llama 3.3 Euryale 70B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "thedrummer/cydonia-24b-v4.1",
    "name": "TheDrummer: Cydonia 24B V4.1",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "thedrummer/rocinante-12b",
    "name": "TheDrummer: Rocinante 12B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "thedrummer/skyfall-36b-v2",
    "name": "TheDrummer: Skyfall 36B V2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "thedrummer/unslopnemo-12b",
    "name": "TheDrummer: UnslopNemo 12B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "x-ai/grok-4.20",
    "name": "xAI: Grok 4.20",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "x-ai/grok-4.20-multi-agent",
    "name": "xAI: Grok 4.20 Multi-Agent",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "x-ai/grok-4.3",
    "name": "xAI: Grok 4.3",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "x-ai/grok-build-0.1",
    "name": "xAI: Grok Build 0.1",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "inclusionai/ling-2.6-1t",
    "name": "inclusionAI: Ling-2.6-1T",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inclusionai/ling-2.6-flash",
    "name": "inclusionAI: Ling-2.6-flash",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inclusionai/ring-2.6-1t",
    "name": "inclusionAI: Ring-2.6-1T",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "liquid/lfm-2-24b-a2b",
    "name": "LiquidAI: LFM2-24B-A2B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "liquid/lfm-2.5-1.2b-instruct:free",
    "name": "LiquidAI: LFM2.5-1.2B-Instruct (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "liquid/lfm-2.5-1.2b-thinking:free",
    "name": "LiquidAI: LFM2.5-1.2B-Thinking (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "microsoft/phi-4",
    "name": "Microsoft: Phi 4",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "microsoft/phi-4-mini-instruct",
    "name": "Microsoft: Phi 4 Mini Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "microsoft/wizardlm-2-8x22b",
    "name": "WizardLM-2 8x22B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "xiaomi/mimo-v2-flash",
    "name": "Xiaomi: MiMo-V2-Flash",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "xiaomi/mimo-v2.5",
    "name": "Xiaomi: MiMo-V2.5",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "xiaomi/mimo-v2.5-pro",
    "name": "Xiaomi: MiMo-V2.5-Pro",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~anthropic/claude-haiku-latest",
    "name": "Anthropic Claude Haiku Latest",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "~anthropic/claude-opus-latest",
    "name": "Anthropic: Claude Opus Latest",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "~anthropic/claude-sonnet-latest",
    "name": "Anthropic Claude Sonnet Latest",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "ibm-granite/granite-4.0-h-micro",
    "name": "IBM: Granite 4.0 Micro",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "ibm-granite/granite-4.1-8b",
    "name": "IBM: Granite 4.1 8B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inflection/inflection-3-pi",
    "name": "Inflection: Inflection 3 Pi",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inflection/inflection-3-productivity",
    "name": "Inflection: Inflection 3 Productivity",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "morph/morph-v3-fast",
    "name": "Morph: Morph V3 Fast",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "morph/morph-v3-large",
    "name": "Morph: Morph V3 Large",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "poolside/laguna-m.1:free",
    "name": "Poolside: Laguna M.1 (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "poolside/laguna-xs.2:free",
    "name": "Poolside: Laguna XS.2 (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "rekaai/reka-edge",
    "name": "Reka Edge",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "rekaai/reka-flash-3",
    "name": "Reka Flash 3",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "relace/relace-apply-3",
    "name": "Relace: Relace Apply 3",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "relace/relace-search",
    "name": "Relace: Relace Search",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "stepfun/step-3.5-flash",
    "name": "StepFun: Step 3.5 Flash",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "stepfun/step-3.7-flash",
    "name": "StepFun: Step 3.7 Flash",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "tencent/hunyuan-a13b-instruct",
    "name": "Tencent: Hunyuan A13B Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "tencent/hy3-preview",
    "name": "Tencent: Hy3 preview",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~google/gemini-flash-latest",
    "name": "Google Gemini Flash Latest",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "~google/gemini-pro-latest",
    "name": "Google Gemini Pro Latest",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "~openai/gpt-latest",
    "name": "OpenAI GPT Latest",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "~openai/gpt-mini-latest",
    "name": "OpenAI GPT Mini Latest",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "ai21/jamba-large-1.7",
    "name": "AI21: Jamba Large 1.7",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "allenai/olmo-3-32b-think",
    "name": "AllenAI: Olmo 3 32B Think",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthracite-org/magnum-v4-72b",
    "name": "Magnum v4 72B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "baidu/ernie-4.5-vl-424b-a47b",
    "name": "Baidu: ERNIE 4.5 VL 424B A47B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "bytedance/ui-tars-1.5-7b",
    "name": "ByteDance: UI-TARS 7B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "name": "Venice: Uncensored (free)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepcogito/cogito-v2.1-671b",
    "name": "Deep Cogito: Cogito v2.1 671B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "essentialai/rnj-1-instruct",
    "name": "EssentialAI: Rnj 1 Instruct",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "gryphe/mythomax-l2-13b",
    "name": "MythoMax 13B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inception/mercury-2",
    "name": "Inception: Mercury 2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "kwaipilot/kat-coder-pro-v2",
    "name": "Kwaipilot: KAT-Coder-Pro V2",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mancer/weaver",
    "name": "Mancer: Weaver (alpha)",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nex-agi/deepseek-v3.1-nex-n1",
    "name": "Nex AGI: DeepSeek V3.1 Nex N1",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perceptron/perceptron-mk1",
    "name": "Perceptron: Perceptron Mk1",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "prime-intellect/intellect-3",
    "name": "Prime Intellect: INTELLECT-3",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "switchpoint/router",
    "name": "Switchpoint Router",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "undi95/remm-slerp-l2-13b",
    "name": "ReMM SLERP 13B",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "upstage/solar-pro-3",
    "name": "Upstage: Solar Pro 3",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "writer/palmyra-x5",
    "name": "Writer: Palmyra X5",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~moonshotai/kimi-latest",
    "name": "MoonshotAI Kimi Latest",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "ai21/jamba-large-1.7",
    "name": "ai21",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "aion-labs/aion-1.0",
    "name": "aion-labs",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "aion-labs/aion-1.0-mini",
    "name": "aion-labs",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "aion-labs/aion-2.0",
    "name": "aion-labs",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "aion-labs/aion-rp-llama-3.1-8b",
    "name": "aion-labs",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "allenai/olmo-3-32b-think",
    "name": "allenai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "amazon/nova-micro-v1",
    "name": "amazon",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthracite-org/magnum-v4-72b",
    "name": "anthracite-org",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "arcee-ai/coder-large",
    "name": "arcee-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "arcee-ai/maestro-reasoning",
    "name": "arcee-ai",
    "context": "128K",
    "capabilities": "Reasoning"
  },
  {
    "id": "arcee-ai/trinity-large-thinking",
    "name": "arcee-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "arcee-ai/trinity-mini",
    "name": "arcee-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "arcee-ai/virtuoso-large",
    "name": "arcee-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "name": "cognitivecomputations",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "cohere/command-a",
    "name": "cohere",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "cohere/command-r-08-2024",
    "name": "cohere",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "cohere/command-r-plus-08-2024",
    "name": "cohere",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "cohere/command-r7b-12-2024",
    "name": "cohere",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepcogito/cogito-v2.1-671b",
    "name": "deepcogito",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-chat",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-chat-v3-0324",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-chat-v3.1",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-r1",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-r1-0528",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-r1-distill-llama-70b",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-r1-distill-qwen-32b",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v3.1-terminus",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v3.2",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v3.2-exp",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v4-flash",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "deepseek/deepseek-v4-pro",
    "name": "deepseek",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "essentialai/rnj-1-instruct",
    "name": "essentialai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-2-27b-it",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-3n-e4b-it",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "gryphe/mythomax-l2-13b",
    "name": "gryphe",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "ibm-granite/granite-4.0-h-micro",
    "name": "ibm-granite",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "ibm-granite/granite-4.1-8b",
    "name": "ibm-granite",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inception/mercury-2",
    "name": "inception",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inclusionai/ling-2.6-1t",
    "name": "inclusionai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inclusionai/ling-2.6-flash",
    "name": "inclusionai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inclusionai/ring-2.6-1t",
    "name": "inclusionai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inflection/inflection-3-pi",
    "name": "inflection",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "inflection/inflection-3-productivity",
    "name": "inflection",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "kwaipilot/kat-coder-pro-v2",
    "name": "kwaipilot",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "liquid/lfm-2-24b-a2b",
    "name": "liquid",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "liquid/lfm-2.5-1.2b-instruct:free",
    "name": "liquid",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "liquid/lfm-2.5-1.2b-thinking:free",
    "name": "liquid",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mancer/weaver",
    "name": "mancer",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3-70b-instruct",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3-8b-instruct",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.1-70b-instruct",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.1-8b-instruct",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.2-1b-instruct",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.2-3b-instruct",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.2-3b-instruct:free",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.3-70b-instruct",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.3-70b-instruct:free",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-guard-3-8b",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "microsoft/phi-4",
    "name": "microsoft",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "microsoft/phi-4-mini-instruct",
    "name": "microsoft",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "microsoft/wizardlm-2-8x22b",
    "name": "microsoft",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m1",
    "name": "minimax",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2",
    "name": "minimax",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2-her",
    "name": "minimax",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2.1",
    "name": "minimax",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2.5",
    "name": "minimax",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m2.7",
    "name": "minimax",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-nemo",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-small-24b-instruct-2501",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2",
    "name": "moonshotai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2-0905",
    "name": "moonshotai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2-thinking",
    "name": "moonshotai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "morph/morph-v3-fast",
    "name": "morph",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "morph/morph-v3-large",
    "name": "morph",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nex-agi/deepseek-v3.1-nex-n1",
    "name": "nex-agi",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-405b",
    "name": "nousresearch",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-405b:free",
    "name": "nousresearch",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-3-llama-3.1-70b",
    "name": "nousresearch",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-4-405b",
    "name": "nousresearch",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nousresearch/hermes-4-70b",
    "name": "nousresearch",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-nano-30b-a3b:free",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-super-120b-a12b:free",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-nano-9b-v2",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-nano-9b-v2:free",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-3.5-turbo",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-3.5-turbo-0613",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-3.5-turbo-16k",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-3.5-turbo-instruct",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4-turbo-preview",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o-mini-search-preview",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o-search-preview",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-120b",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-120b:free",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-20b",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-20b:free",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-oss-safeguard-20b",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/bodybuilder",
    "name": "openrouter",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/fusion",
    "name": "openrouter",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/owl-alpha",
    "name": "openrouter",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/pareto-code",
    "name": "openrouter",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perplexity/sonar-deep-research",
    "name": "perplexity",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "poolside/laguna-m.1:free",
    "name": "poolside",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "poolside/laguna-xs.2:free",
    "name": "poolside",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "prime-intellect/intellect-3",
    "name": "prime-intellect",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-2.5-72b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-2.5-7b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-2.5-coder-32b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-plus",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-plus-2025-07-28",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen-plus-2025-07-28:thinking",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-14b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-235b-a22b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-235b-a22b-2507",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-235b-a22b-thinking-2507",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-30b-a3b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-30b-a3b-instruct-2507",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-30b-a3b-thinking-2507",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-32b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-8b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder-30b-a3b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder-flash",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder-next",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder-plus",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-coder:free",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-max",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-max-thinking",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-instruct:free",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-next-80b-a3b-thinking",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.6-max-preview",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.7-max",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "rekaai/reka-flash-3",
    "name": "rekaai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "relace/relace-apply-3",
    "name": "relace",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "relace/relace-search",
    "name": "relace",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "sao10k/l3-lunaris-8b",
    "name": "sao10k",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "sao10k/l3.1-70b-hanami-x1",
    "name": "sao10k",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "sao10k/l3.1-euryale-70b",
    "name": "sao10k",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "sao10k/l3.3-euryale-70b",
    "name": "sao10k",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "stepfun/step-3.5-flash",
    "name": "stepfun",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "switchpoint/router",
    "name": "switchpoint",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "tencent/hunyuan-a13b-instruct",
    "name": "tencent",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "tencent/hy3-preview",
    "name": "tencent",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "thedrummer/cydonia-24b-v4.1",
    "name": "thedrummer",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "thedrummer/rocinante-12b",
    "name": "thedrummer",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "thedrummer/skyfall-36b-v2",
    "name": "thedrummer",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "thedrummer/unslopnemo-12b",
    "name": "thedrummer",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "undi95/remm-slerp-l2-13b",
    "name": "undi95",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "upstage/solar-pro-3",
    "name": "upstage",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "writer/palmyra-x5",
    "name": "writer",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "xiaomi/mimo-v2-flash",
    "name": "xiaomi",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "xiaomi/mimo-v2.5-pro",
    "name": "xiaomi",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4-32b",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.5",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.5-air",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.5-air:free",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.6",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.7",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.7-flash",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-5",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-5-turbo",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-5.1",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "amazon/nova-2-lite-v1",
    "name": "amazon",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "amazon/nova-lite-v1",
    "name": "amazon",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "amazon/nova-premier-v1",
    "name": "amazon",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "amazon/nova-pro-v1",
    "name": "amazon",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-3-haiku",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-3.5-haiku",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-haiku-4.5",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4.1",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4.5",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4.6",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4.6-fast",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4.7",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4.7-fast",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4.8",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-opus-4.8-fast",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-sonnet-4",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-sonnet-4.5",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "anthropic/claude-sonnet-4.6",
    "name": "anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "baidu/ernie-4.5-vl-424b-a47b",
    "name": "baidu",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "bytedance-seed/seed-1.6",
    "name": "bytedance-seed",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "bytedance-seed/seed-1.6-flash",
    "name": "bytedance-seed",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "bytedance-seed/seed-2.0-lite",
    "name": "bytedance-seed",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "bytedance-seed/seed-2.0-mini",
    "name": "bytedance-seed",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "bytedance/ui-tars-1.5-7b",
    "name": "bytedance",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-3-12b-it",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-3-27b-it",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-3-4b-it",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-4-26b-a4b-it",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-4-26b-a4b-it:free",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-4-31b-it",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemma-4-31b-it:free",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-3.2-11b-vision-instruct",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "meta-llama/llama-4-maverick",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-4-scout",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "meta-llama/llama-guard-4-12b",
    "name": "meta-llama",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-01",
    "name": "minimax",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "minimax/minimax-m3",
    "name": "minimax",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/codestral-2508",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/devstral-2512",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/ministral-14b-2512",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/ministral-3b-2512",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/ministral-8b-2512",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-large",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-large-2407",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-large-2512",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-medium-3",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-medium-3-5",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-medium-3.1",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-saba",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-small-2603",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-small-3.1-24b-instruct",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mistral-small-3.2-24b-instruct",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/mixtral-8x22b-instruct",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2.5",
    "name": "moonshotai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2.6",
    "name": "moonshotai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "moonshotai/kimi-k2.6:free",
    "name": "moonshotai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3.5-content-safety:free",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-nano-12b-v2-vl:free",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4-turbo",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4.1",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4.1-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4.1-nano",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o-2024-05-13",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o-2024-08-06",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o-2024-11-20",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-4o-mini-2024-07-18",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-chat",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-codex",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-nano",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-pro",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.1",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.1-chat",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.1-codex",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.1-codex-max",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.1-codex-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.2",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.2-chat",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.2-codex",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.2-pro",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.3-chat",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.3-codex",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.4",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.4-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.4-nano",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.4-pro",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.5",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.5-pro",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-chat-latest",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o1",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o1-pro",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o3",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o3-deep-research",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o3-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o3-mini-high",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o3-pro",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o4-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o4-mini-deep-research",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/o4-mini-high",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/free",
    "name": "openrouter",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perceptron/perceptron-mk1",
    "name": "perceptron",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perplexity/sonar",
    "name": "perplexity",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perplexity/sonar-pro",
    "name": "perplexity",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perplexity/sonar-pro-search",
    "name": "perplexity",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "perplexity/sonar-reasoning-pro",
    "name": "perplexity",
    "context": "128K",
    "capabilities": "Reasoning"
  },
  {
    "id": "qwen/qwen2.5-vl-72b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-vl-235b-a22b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-vl-235b-a22b-thinking",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-vl-30b-a3b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-vl-30b-a3b-thinking",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-vl-32b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-vl-8b-instruct",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3-vl-8b-thinking",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.5-122b-a10b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.5-27b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.5-35b-a3b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.5-397b-a17b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.5-9b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.5-flash-02-23",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.5-plus-02-15",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.5-plus-20260420",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.6-27b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.6-35b-a3b",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.6-flash",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.6-plus",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "qwen/qwen3.7-plus",
    "name": "qwen",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "rekaai/reka-edge",
    "name": "rekaai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "stepfun/step-3.7-flash",
    "name": "stepfun",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "x-ai/grok-4.20",
    "name": "x-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "x-ai/grok-4.20-multi-agent",
    "name": "x-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "x-ai/grok-4.3",
    "name": "x-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "x-ai/grok-build-0.1",
    "name": "x-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.5v",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-4.6v",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "z-ai/glm-5v-turbo",
    "name": "z-ai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~anthropic/claude-haiku-latest",
    "name": "~anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~anthropic/claude-opus-latest",
    "name": "~anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~anthropic/claude-sonnet-latest",
    "name": "~anthropic",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~moonshotai/kimi-latest",
    "name": "~moonshotai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~openai/gpt-latest",
    "name": "~openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~openai/gpt-mini-latest",
    "name": "~openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-2.5-flash-image",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3-pro-image-preview",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3.1-flash-image-preview",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-image",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5-image-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-5.4-image-2",
    "name": "openai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openrouter/auto",
    "name": "openrouter",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/lyria-3-clip-preview",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/lyria-3-pro-preview",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "openai/gpt-audio",
    "name": "openai",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "openai/gpt-audio-mini",
    "name": "openai",
    "context": "128K",
    "capabilities": "Audio"
  },
  {
    "id": "google/gemini-2.5-flash",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-2.5-flash-lite",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-2.5-flash-lite-preview-09-2025",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-2.5-pro",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-2.5-pro-preview",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-2.5-pro-preview-05-06",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3-flash-preview",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3.1-flash-lite",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3.1-flash-lite-preview",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3.1-pro-preview",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3.1-pro-preview-customtools",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "google/gemini-3.5-flash",
    "name": "google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "mistralai/voxtral-small-24b-2507",
    "name": "mistralai",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "name": "nvidia",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "xiaomi/mimo-v2.5",
    "name": "xiaomi",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~google/gemini-flash-latest",
    "name": "~google",
    "context": "128K",
    "capabilities": "Tools"
  },
  {
    "id": "~google/gemini-pro-latest",
    "name": "~google",
    "context": "128K",
    "capabilities": "Tools"
  }
];

export const GROQ_EMBEDDING_MODELS: ModelPreset[] = [];
