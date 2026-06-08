# AI Provider Model Catalog for Agent Integration

Generated: 2026-06-08 01:01:58Z

This file is designed for an AI agent that needs to build provider dropdowns, model dropdowns, endpoint mappings, and capability filters. It focuses on the two official sources you gave me — OpenRouter and Groq — and organizes the data so it is easy to parse both by humans and by code.

## Scope

- Provider 1: [OpenRouter models](https://openrouter.ai/models)
- Provider 2: [Groq supported models](https://console.groq.com/docs/models)
- Date freshness: live OpenRouter catalog fetched from the public models API during generation; Groq model/support details compiled from official docs pages reviewed during generation.
- Important: provider catalogs change frequently. Your agent should treat this file as a high-quality snapshot and, where possible, refresh from the official endpoints listed below.

## Fast integration summary

### OpenRouter

- Website catalog: [https://openrouter.ai/models](https://openrouter.ai/models)
- Base API URL: `https://openrouter.ai/api/v1`
- Public models list: `GET https://openrouter.ai/api/v1/models`
- Model endpoint details template: `GET https://openrouter.ai/api/v1/models/{author}/{slug}/endpoints` or use the exact `links.details` field returned by the models API
- Main use: unified access to many upstream providers through one API key and one normalized schema
- Live model count in this snapshot: **341**
- Live provider count in this snapshot: **57**

### Groq

- Supported models page: [https://console.groq.com/docs/models](https://console.groq.com/docs/models)
- OpenAI-compatible base URL: `https://api.groq.com/openai/v1`
- Active models list endpoint: `GET https://api.groq.com/openai/v1/models` (requires Groq API key)
- Main use: very fast hosted inference with OpenAI-compatible endpoints plus Groq-specific docs for chat, responses, vision, speech-to-text, and TTS

## Endpoint map

| Provider | Purpose | Method + path / URL | Notes | Source |
| --- | --- | --- | --- | --- |
| OpenRouter | Base API | `https://openrouter.ai/api/v1` | Unified router for many providers | [API overview](https://openrouter.ai/docs/api/reference/overview) |
| OpenRouter | List models | `GET https://openrouter.ai/api/v1/models` | Public live model metadata | [Models guide](https://openrouter.ai/docs/guides/overview/models) |
| OpenRouter | List endpoints for one model | `GET https://openrouter.ai/api/v1/models/{author}/{slug}/endpoints` | Exact endpoint URL is also returned in each model object as `links.details` | [Endpoint docs](https://openrouter.ai/docs/api/api-reference/endpoints/list-endpoints) |
| OpenRouter | Chat completions | `POST https://openrouter.ai/api/v1/chat/completions` | OpenAI-style chat interface | [Quickstart](https://openrouter.ai/docs/quickstart) |
| OpenRouter | Embeddings | `POST https://openrouter.ai/api/v1/embeddings` | Official embeddings docs exist; use for embedding-capable models | [Embeddings docs](https://openrouter.ai/docs/api/reference/embeddings) |
| Groq | Base API | `https://api.groq.com/openai/v1` | OpenAI-compatible base URL | [OpenAI compatibility](https://console.groq.com/docs/openai) |
| Groq | List active models | `GET https://api.groq.com/openai/v1/models` | Requires Groq API key | [Groq models docs](https://console.groq.com/docs/models) |
| Groq | Chat completions | `POST https://api.groq.com/openai/v1/chat/completions` | Main text / multimodal chat endpoint | [API reference](https://console.groq.com/docs/api-reference) |
| Groq | Responses API | `POST https://api.groq.com/openai/v1/responses` | OpenAI-compatible Responses API | [Responses API docs](https://console.groq.com/docs/responses-api) |
| Groq | Speech to text: transcriptions | `POST https://api.groq.com/openai/v1/audio/transcriptions` | Whisper models | [Speech-to-text docs](https://console.groq.com/docs/speech-to-text) |
| Groq | Speech to text: translations | `POST https://api.groq.com/openai/v1/audio/translations` | Translate audio to English text | [Speech-to-text docs](https://console.groq.com/docs/speech-to-text) |
| Groq | Text to speech | `POST https://api.groq.com/openai/v1/audio/speech` | Orpheus TTS models | [TTS docs](https://console.groq.com/docs/text-to-speech) |

## Groq compatibility notes your agent should know

- Groq uses the OpenAI-compatible base URL `https://api.groq.com/openai/v1`. [Source](https://console.groq.com/docs/openai)
- Groq docs explicitly list unsupported OpenAI request fields in the compatibility guide: `logprobs`, `logit_bias`, `top_logprobs`, `messages[].name`, and `n` values other than `1`. [Source](https://console.groq.com/docs/openai)
- Groq Responses API currently does **not** support `previous_response_id`, `store`, `truncation`, `include`, `safety_identifier`, `prompt_cache_key`, or reusable `prompt`s. [Source](https://console.groq.com/docs/responses-api)
- Groq docs reviewed in this run do **not** present a dedicated embeddings product page or embeddings model list. Your agent should therefore mark Groq embeddings as **not documented in the reviewed official pages** unless refreshed from newer official docs. [Models](https://console.groq.com/docs/models) [API reference](https://console.groq.com/docs/api-reference)

## OpenRouter live catalog summary

### By high-level category

| Category | Count |
| --- | ---: |
| chat | 168 |
| multimodal-chat | 145 |
| embedding | 0 |
| image-generation | 7 |
| video-generation | 0 |
| audio-generation | 4 |
| speech-to-text-or-audio-understanding | 17 |
| other | 0 |

### By provider

| Provider | Model count | Breakdown |
| --- | ---: | --- |
| openai | 62 | audio-generation=2, chat=13, image-generation=3, multimodal-chat=44 |
| qwen | 49 | chat=28, multimodal-chat=21 |
| google | 26 | audio-generation=2, chat=2, image-generation=3, multimodal-chat=7, speech-to-text-or-audio-understanding=12 |
| mistralai | 19 | chat=2, multimodal-chat=16, speech-to-text-or-audio-understanding=1 |
| anthropic | 15 | multimodal-chat=15 |
| meta-llama | 14 | chat=10, multimodal-chat=4 |
| z-ai | 13 | chat=10, multimodal-chat=3 |
| deepseek | 12 | chat=12 |
| nvidia | 12 | chat=9, multimodal-chat=2, speech-to-text-or-audio-understanding=1 |
| minimax | 8 | chat=6, multimodal-chat=2 |
| moonshotai | 6 | chat=3, multimodal-chat=3 |
| openrouter | 6 | chat=4, image-generation=1, multimodal-chat=1 |
| amazon | 5 | chat=1, multimodal-chat=4 |
| arcee-ai | 5 | chat=5 |
| nousresearch | 5 | chat=5 |
| perplexity | 5 | chat=1, multimodal-chat=4 |
| aion-labs | 4 | chat=4 |
| bytedance-seed | 4 | multimodal-chat=4 |
| cohere | 4 | chat=4 |
| sao10k | 4 | chat=4 |
| thedrummer | 4 | chat=4 |
| x-ai | 4 | multimodal-chat=4 |
| inclusionai | 3 | chat=3 |
| liquid | 3 | chat=3 |
| microsoft | 3 | chat=3 |
| xiaomi | 3 | chat=2, speech-to-text-or-audio-understanding=1 |
| ~anthropic | 3 | multimodal-chat=3 |
| ibm-granite | 2 | chat=2 |
| inflection | 2 | chat=2 |
| morph | 2 | chat=2 |
| poolside | 2 | chat=2 |
| rekaai | 2 | chat=1, multimodal-chat=1 |
| relace | 2 | chat=2 |
| stepfun | 2 | chat=1, multimodal-chat=1 |
| tencent | 2 | chat=2 |
| ~google | 2 | speech-to-text-or-audio-understanding=2 |
| ~openai | 2 | multimodal-chat=2 |
| ai21 | 1 | chat=1 |
| allenai | 1 | chat=1 |
| anthracite-org | 1 | chat=1 |
| baidu | 1 | multimodal-chat=1 |
| bytedance | 1 | multimodal-chat=1 |
| cognitivecomputations | 1 | chat=1 |
| deepcogito | 1 | chat=1 |
| essentialai | 1 | chat=1 |
| gryphe | 1 | chat=1 |
| inception | 1 | chat=1 |
| kwaipilot | 1 | chat=1 |
| mancer | 1 | chat=1 |
| nex-agi | 1 | chat=1 |
| perceptron | 1 | multimodal-chat=1 |
| prime-intellect | 1 | chat=1 |
| switchpoint | 1 | chat=1 |
| undi95 | 1 | chat=1 |
| upstage | 1 | chat=1 |
| writer | 1 | chat=1 |
| ~moonshotai | 1 | multimodal-chat=1 |

### Notes about OpenRouter embeddings discovery

- Probe: `https://openrouter.ai/api/v1/embeddings/models` → status `200`; content-type `application/json`; preview `{"data":[{"id":"google/gemini-embedding-2","canonical_slug":"google/gemini-embedding-2","hugging_face_id":null,"name":"G`
- Probe: `https://openrouter.ai/api/v1/models?modality=embeddings` → status `200`; content-type `application/json`; preview `{"data":[{"id":"nvidia/nemotron-3.5-content-safety:free","canonical_slug":"nvidia/nemotron-3.5-content-safety-20260604",`
- Probe: `https://openrouter.ai/api/v1/models?modalities=embeddings` → status `200`; content-type `application/json`; preview `{"data":[{"id":"nvidia/nemotron-3.5-content-safety:free","canonical_slug":"nvidia/nemotron-3.5-content-safety-20260604",`

Interpretation: the safest official live source remains the main models API plus the official embeddings docs page. If your agent needs a strict embedding-only list, it should either filter the full OpenRouter models payload by modality/capability or refresh from the latest OpenRouter docs if they later publish a stable embedding-list endpoint.

## Groq model catalog snapshot

### Groq section: production_chat_or_general

| Model ID | Display name | Primary use | Detail |
| --- | --- | --- | --- |
| `llama-3.1-8b-instant` | Meta Llama 3.1 8B | chat / text generation | [link](https://console.groq.com/docs/model/llama-3.1-8b-instant) |
| `llama-3.3-70b-versatile` | Meta Llama 3.3 70B | chat / text generation | [link](https://console.groq.com/docs/model/llama-3.3-70b-versatile) |
| `openai/gpt-oss-120b` | GPT-OSS 120B | chat / reasoning / structured outputs / Responses API built-in tools | [link](https://console.groq.com/docs/model/openai/gpt-oss-120b) |
| `openai/gpt-oss-20b` | GPT-OSS 20B | chat / reasoning / structured outputs / Responses API built-in tools | [link](https://console.groq.com/docs/model/openai/gpt-oss-20b) |

### Groq section: systems

| Model ID | Display name | Primary use | Detail |
| --- | --- | --- | --- |
| `groq/compound` | Groq Compound | system with built-in tools | [link](https://console.groq.com/docs/compound/systems/compound) |
| `groq/compound-mini` | Groq Compound Mini | system with built-in tools | [link](https://console.groq.com/docs/compound/systems/compound-mini) |

### Groq section: speech_to_text

| Model ID | Display name | Primary use | Detail |
| --- | --- | --- | --- |
| `whisper-large-v3` | Whisper Large V3 | audio transcription + translation | [link](https://console.groq.com/docs/model/whisper-large-v3) |
| `whisper-large-v3-turbo` | Whisper Large V3 Turbo | audio transcription | [link](https://console.groq.com/docs/model/whisper-large-v3-turbo) |

### Groq section: text_to_speech

| Model ID | Display name | Primary use | Detail |
| --- | --- | --- | --- |
| `canopylabs/orpheus-v1-english` | Canopy Labs Orpheus V1 English | TTS English | [link](https://console.groq.com/docs/model/canopylabs/orpheus-v1-english) |
| `canopylabs/orpheus-arabic-saudi` | Canopy Labs Orpheus Arabic Saudi | TTS Arabic (Saudi) | [link](https://console.groq.com/docs/model/canopylabs/orpheus-arabic-saudi) |

### Groq section: vision_preview

| Model ID | Display name | Primary use | Detail |
| --- | --- | --- | --- |
| `meta-llama/llama-4-scout-17b-16e-instruct` | Llama 4 Scout 17B 16E | vision / multimodal / JSON mode / tool use | [link](https://console.groq.com/docs/model/meta-llama/llama-4-scout-17b-16e-instruct) |

### Groq section: safety_guardrails_preview

| Model ID | Display name | Primary use | Detail |
| --- | --- | --- | --- |
| `meta-llama/llama-prompt-guard-2-22m` | Llama Prompt Guard 2 22M | guardrail / prompt safety | [link](https://console.groq.com/docs/model/meta-llama/llama-prompt-guard-2-22m) |
| `meta-llama/llama-prompt-guard-2-86m` | Prompt Guard 2 86M | guardrail / prompt safety | [link](https://console.groq.com/docs/model/meta-llama/llama-prompt-guard-2-86m) |
| `openai/gpt-oss-safeguard-20b` | Safety GPT OSS 20B | safeguard / structured outputs best-effort | [link](https://console.groq.com/docs/model/openai/gpt-oss-safeguard-20b) |

### Groq section: preview_general

| Model ID | Display name | Primary use | Detail |
| --- | --- | --- | --- |
| `qwen/qwen3-32b` | Qwen3-32B | chat / reasoning-capable preview | [link](https://console.groq.com/docs/model/qwen/qwen3-32b) |

### Groq capability-specific notes

- Vision page currently documents `meta-llama/llama-4-scout-17b-16e-instruct` for image input, tool use, JSON mode, and multi-turn conversations. [Source](https://console.groq.com/docs/vision)
- Speech-to-text page documents two Whisper models: `whisper-large-v3` and `whisper-large-v3-turbo`. [Source](https://console.groq.com/docs/speech-to-text)
- Text-to-speech page documents two Orpheus TTS models: `canopylabs/orpheus-v1-english` and `canopylabs/orpheus-arabic-saudi`. [Source](https://console.groq.com/docs/text-to-speech)
- Structured outputs with `strict: true` are documented for `openai/gpt-oss-20b` and `openai/gpt-oss-120b`. Best-effort (`strict: false`) additionally includes `openai/gpt-oss-safeguard-20b` and `meta-llama/llama-4-scout-17b-16e-instruct`. [Source](https://console.groq.com/docs/structured-outputs)
- Responses API built-in tools (browser search and code execution) are documented for `openai/gpt-oss-20b` and `openai/gpt-oss-120b`. [Source](https://console.groq.com/docs/responses-api)

## Suggested normalized schema for your agent

Use a consistent object shape regardless of provider:

```json
{
  "provider": "openrouter | groq",
  "model_id": "string",
  "display_name": "string",
  "category": "chat | multimodal-chat | embedding | image-generation | video-generation | speech-to-text | text-to-speech | safety | system | other",
  "base_url": "string",
  "list_models_endpoint": "string",
  "invoke_endpoint": "string",
  "detail_url": "string",
  "context_length": 0,
  "input_modalities": ["text"],
  "output_modalities": ["text"],
  "supports_reasoning": false,
  "supports_tools": false,
  "supports_structured_outputs": false,
  "supports_streaming": true,
  "pricing": {},
  "notes": "string"
}
```

## Suggested provider dropdown design

1. First dropdown: provider (`OpenRouter`, `Groq`).
2. Second dropdown: capability category (`Chat`, `Multimodal Chat`, `Embedding`, `Image Generation`, `Video Generation`, `Speech-to-Text`, `Text-to-Speech`, `Safety`, `Systems`).
3. Third dropdown: model list filtered by provider + category.
4. Hidden/config fields: `base_url`, `list_models_endpoint`, `invoke_endpoint`, `detail_url`.
5. Optional badges: `free`, `preview`, `vision`, `tools`, `reasoning`, `structured-output`, `audio`, `video`.

## OpenRouter provider-by-provider full list

### Provider: openai (62 models)

Type mix: audio-generation: 2, chat: 13, image-generation: 3, multimodal-chat: 44.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `openai/gpt-3.5-turbo` | OpenAI: GPT-3.5 Turbo | chat | `text->text` | 16385 | prompt=0.0000005<br>completion=0.0000015 | [model](https://openrouter.ai/openai/gpt-3.5-turbo) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-3.5-turbo/endpoints) |
| `openai/gpt-3.5-turbo-0613` | OpenAI: GPT-3.5 Turbo (older v0613) | chat | `text->text` | 4095 | prompt=0.000001<br>completion=0.000002 | [model](https://openrouter.ai/openai/gpt-3.5-turbo-0613) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-3.5-turbo-0613/endpoints) |
| `openai/gpt-3.5-turbo-16k` | OpenAI: GPT-3.5 Turbo 16k | chat | `text->text` | 16385 | prompt=0.000003<br>completion=0.000004 | [model](https://openrouter.ai/openai/gpt-3.5-turbo-16k) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-3.5-turbo-16k/endpoints) |
| `openai/gpt-3.5-turbo-instruct` | OpenAI: GPT-3.5 Turbo Instruct | chat | `text->text` | 4095 | prompt=0.0000015<br>completion=0.000002 | [model](https://openrouter.ai/openai/gpt-3.5-turbo-instruct) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-3.5-turbo-instruct/endpoints) |
| `openai/gpt-4` | OpenAI: GPT-4 | chat | `text->text` | 8191 | prompt=0.00003<br>completion=0.00006 | [model](https://openrouter.ai/openai/gpt-4) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4/endpoints) |
| `openai/gpt-4-turbo` | OpenAI: GPT-4 Turbo | multimodal-chat | `text+image->text` | 128000 | prompt=0.00001<br>completion=0.00003 | [model](https://openrouter.ai/openai/gpt-4-turbo) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4-turbo/endpoints) |
| `openai/gpt-4-turbo-preview` | OpenAI: GPT-4 Turbo Preview | chat | `text->text` | 128000 | prompt=0.00001<br>completion=0.00003 | [model](https://openrouter.ai/openai/gpt-4-turbo-preview) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4-turbo-preview/endpoints) |
| `openai/gpt-4.1` | OpenAI: GPT-4.1 | multimodal-chat | `text+image+file->text` | 1047576 | prompt=0.000002<br>completion=0.000008<br>web_search=0.01<br>input_cache_read=0.0000005 | [model](https://openrouter.ai/openai/gpt-4.1) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4.1-2025-04-14/endpoints) |
| `openai/gpt-4.1-mini` | OpenAI: GPT-4.1 Mini | multimodal-chat | `text+image+file->text` | 1047576 | prompt=0.0000004<br>completion=0.0000016<br>web_search=0.01<br>input_cache_read=0.0000001 | [model](https://openrouter.ai/openai/gpt-4.1-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4.1-mini-2025-04-14/endpoints) |
| `openai/gpt-4.1-nano` | OpenAI: GPT-4.1 Nano | multimodal-chat | `text+image+file->text` | 1047576 | prompt=0.0000001<br>completion=0.0000004<br>web_search=0.01<br>input_cache_read=0.000000025 | [model](https://openrouter.ai/openai/gpt-4.1-nano) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4.1-nano-2025-04-14/endpoints) |
| `openai/gpt-4o` | OpenAI: GPT-4o | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.0000025<br>completion=0.00001 | [model](https://openrouter.ai/openai/gpt-4o) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4o/endpoints) |
| `openai/gpt-4o-2024-05-13` | OpenAI: GPT-4o (2024-05-13) | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.000005<br>completion=0.000015 | [model](https://openrouter.ai/openai/gpt-4o-2024-05-13) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4o-2024-05-13/endpoints) |
| `openai/gpt-4o-2024-08-06` | OpenAI: GPT-4o (2024-08-06) | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.0000025<br>completion=0.00001<br>input_cache_read=0.00000125 | [model](https://openrouter.ai/openai/gpt-4o-2024-08-06) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4o-2024-08-06/endpoints) |
| `openai/gpt-4o-2024-11-20` | OpenAI: GPT-4o (2024-11-20) | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.0000025<br>completion=0.00001<br>input_cache_read=0.00000125 | [model](https://openrouter.ai/openai/gpt-4o-2024-11-20) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4o-2024-11-20/endpoints) |
| `openai/gpt-4o-mini` | OpenAI: GPT-4o-mini | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.00000015<br>completion=0.0000006<br>input_cache_read=0.000000075 | [model](https://openrouter.ai/openai/gpt-4o-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4o-mini/endpoints) |
| `openai/gpt-4o-mini-2024-07-18` | OpenAI: GPT-4o-mini (2024-07-18) | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.00000015<br>completion=0.0000006<br>input_cache_read=0.000000075 | [model](https://openrouter.ai/openai/gpt-4o-mini-2024-07-18) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4o-mini-2024-07-18/endpoints) |
| `openai/gpt-4o-mini-search-preview` | OpenAI: GPT-4o-mini Search Preview | chat | `text->text` | 128000 | prompt=0.00000015<br>completion=0.0000006<br>web_search=0.0275 | [model](https://openrouter.ai/openai/gpt-4o-mini-search-preview) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4o-mini-search-preview-2025-03-11/endpoints) |
| `openai/gpt-4o-search-preview` | OpenAI: GPT-4o Search Preview | chat | `text->text` | 128000 | prompt=0.0000025<br>completion=0.00001<br>web_search=0.035 | [model](https://openrouter.ai/openai/gpt-4o-search-preview) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-4o-search-preview-2025-03-11/endpoints) |
| `openai/gpt-5` | OpenAI: GPT-5 | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.00000125<br>completion=0.00001<br>web_search=0.01<br>input_cache_read=0.000000125 | [model](https://openrouter.ai/openai/gpt-5) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5-2025-08-07/endpoints) |
| `openai/gpt-5-chat` | OpenAI: GPT-5 Chat | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.00000125<br>completion=0.00001<br>web_search=0.01<br>input_cache_read=0.000000125 | [model](https://openrouter.ai/openai/gpt-5-chat) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5-chat-2025-08-07/endpoints) |
| `openai/gpt-5-codex` | OpenAI: GPT-5 Codex | multimodal-chat | `text+image->text` | 400000 | prompt=0.00000125<br>completion=0.00001<br>web_search=0.01<br>input_cache_read=0.000000125 | [model](https://openrouter.ai/openai/gpt-5-codex) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5-codex/endpoints) |
| `openai/gpt-5-image` | OpenAI: GPT-5 Image | image-generation | `text+image+file->text+image` | 400000 | prompt=0.00001<br>completion=0.00001<br>web_search=0.01<br>input_cache_read=0.00000125 | [model](https://openrouter.ai/openai/gpt-5-image) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5-image/endpoints) |
| `openai/gpt-5-image-mini` | OpenAI: GPT-5 Image Mini | image-generation | `text+image+file->text+image` | 400000 | prompt=0.0000025<br>completion=0.000002<br>web_search=0.01<br>input_cache_read=0.00000025 | [model](https://openrouter.ai/openai/gpt-5-image-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5-image-mini/endpoints) |
| `openai/gpt-5-mini` | OpenAI: GPT-5 Mini | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.00000025<br>completion=0.000002<br>web_search=0.01<br>input_cache_read=0.000000025 | [model](https://openrouter.ai/openai/gpt-5-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5-mini-2025-08-07/endpoints) |
| `openai/gpt-5-nano` | OpenAI: GPT-5 Nano | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.00000005<br>completion=0.0000004<br>web_search=0.01<br>input_cache_read=0.00000001 | [model](https://openrouter.ai/openai/gpt-5-nano) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5-nano-2025-08-07/endpoints) |
| `openai/gpt-5-pro` | OpenAI: GPT-5 Pro | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.000015<br>completion=0.00012<br>web_search=0.01 | [model](https://openrouter.ai/openai/gpt-5-pro) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5-pro-2025-10-06/endpoints) |
| `openai/gpt-5.1` | OpenAI: GPT-5.1 | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.00000125<br>completion=0.00001<br>web_search=0.01<br>input_cache_read=0.00000013 | [model](https://openrouter.ai/openai/gpt-5.1) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.1-20251113/endpoints) |
| `openai/gpt-5.1-chat` | OpenAI: GPT-5.1 Chat | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.00000125<br>completion=0.00001<br>web_search=0.01<br>input_cache_read=0.00000013 | [model](https://openrouter.ai/openai/gpt-5.1-chat) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.1-chat-20251113/endpoints) |
| `openai/gpt-5.1-codex` | OpenAI: GPT-5.1-Codex | multimodal-chat | `text+image->text` | 400000 | prompt=0.00000125<br>completion=0.00001<br>web_search=0.01<br>input_cache_read=0.00000013 | [model](https://openrouter.ai/openai/gpt-5.1-codex) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.1-codex-20251113/endpoints) |
| `openai/gpt-5.1-codex-max` | OpenAI: GPT-5.1-Codex-Max | multimodal-chat | `text+image->text` | 400000 | prompt=0.00000125<br>completion=0.00001<br>web_search=0.01<br>input_cache_read=0.000000125 | [model](https://openrouter.ai/openai/gpt-5.1-codex-max) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.1-codex-max-20251204/endpoints) |
| `openai/gpt-5.1-codex-mini` | OpenAI: GPT-5.1-Codex-Mini | multimodal-chat | `text+image->text` | 400000 | prompt=0.00000025<br>completion=0.000002<br>web_search=0.01<br>input_cache_read=0.000000025 | [model](https://openrouter.ai/openai/gpt-5.1-codex-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.1-codex-mini-20251113/endpoints) |
| `openai/gpt-5.2` | OpenAI: GPT-5.2 | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.00000175<br>completion=0.000014<br>web_search=0.01<br>input_cache_read=0.000000175 | [model](https://openrouter.ai/openai/gpt-5.2) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.2-20251211/endpoints) |
| `openai/gpt-5.2-chat` | OpenAI: GPT-5.2 Chat | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.00000175<br>completion=0.000014<br>web_search=0.01<br>input_cache_read=0.000000175 | [model](https://openrouter.ai/openai/gpt-5.2-chat) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.2-chat-20251211/endpoints) |
| `openai/gpt-5.2-codex` | OpenAI: GPT-5.2-Codex | multimodal-chat | `text+image->text` | 400000 | prompt=0.00000175<br>completion=0.000014<br>web_search=0.01<br>input_cache_read=0.000000175 | [model](https://openrouter.ai/openai/gpt-5.2-codex) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.2-codex-20260114/endpoints) |
| `openai/gpt-5.2-pro` | OpenAI: GPT-5.2 Pro | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.000021<br>completion=0.000168<br>web_search=0.01 | [model](https://openrouter.ai/openai/gpt-5.2-pro) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.2-pro-20251211/endpoints) |
| `openai/gpt-5.3-chat` | OpenAI: GPT-5.3 Chat | multimodal-chat | `text+image+file->text` | 128000 | prompt=0.00000175<br>completion=0.000014<br>web_search=0.01<br>input_cache_read=0.000000175 | [model](https://openrouter.ai/openai/gpt-5.3-chat) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.3-chat-20260303/endpoints) |
| `openai/gpt-5.3-codex` | OpenAI: GPT-5.3-Codex | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.00000175<br>completion=0.000014<br>web_search=0.01<br>input_cache_read=0.000000175 | [model](https://openrouter.ai/openai/gpt-5.3-codex) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.3-codex-20260224/endpoints) |
| `openai/gpt-5.4` | OpenAI: GPT-5.4 | multimodal-chat | `text+image+file->text` | 1050000 | prompt=0.0000025<br>completion=0.000015<br>web_search=0.01<br>input_cache_read=0.00000025 | [model](https://openrouter.ai/openai/gpt-5.4) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.4-20260305/endpoints) |
| `openai/gpt-5.4-image-2` | OpenAI: GPT-5.4 Image 2 | image-generation | `text+image+file->text+image` | 272000 | prompt=0.000008<br>completion=0.000015<br>web_search=0.01<br>input_cache_read=0.000002 | [model](https://openrouter.ai/openai/gpt-5.4-image-2) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.4-image-2-20260421/endpoints) |
| `openai/gpt-5.4-mini` | OpenAI: GPT-5.4 Mini | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.00000075<br>completion=0.0000045<br>web_search=0.01<br>input_cache_read=0.000000075 | [model](https://openrouter.ai/openai/gpt-5.4-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.4-mini-20260317/endpoints) |
| `openai/gpt-5.4-nano` | OpenAI: GPT-5.4 Nano | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.0000002<br>completion=0.00000125<br>web_search=0.01<br>input_cache_read=0.00000002 | [model](https://openrouter.ai/openai/gpt-5.4-nano) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.4-nano-20260317/endpoints) |
| `openai/gpt-5.4-pro` | OpenAI: GPT-5.4 Pro | multimodal-chat | `text+image+file->text` | 1050000 | prompt=0.00003<br>completion=0.00018<br>web_search=0.01 | [model](https://openrouter.ai/openai/gpt-5.4-pro) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.4-pro-20260305/endpoints) |
| `openai/gpt-5.5` | OpenAI: GPT-5.5 | multimodal-chat | `text+image+file->text` | 1050000 | prompt=0.000005<br>completion=0.00003<br>web_search=0.01<br>input_cache_read=0.0000005 | [model](https://openrouter.ai/openai/gpt-5.5) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.5-20260423/endpoints) |
| `openai/gpt-5.5-pro` | OpenAI: GPT-5.5 Pro | multimodal-chat | `text+image+file->text` | 1050000 | prompt=0.00003<br>completion=0.00018<br>web_search=0.01 | [model](https://openrouter.ai/openai/gpt-5.5-pro) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-5.5-pro-20260423/endpoints) |
| `openai/gpt-audio` | OpenAI: GPT Audio | audio-generation | `text+audio->text+audio` | 128000 | prompt=0.0000025<br>completion=0.00001 | [model](https://openrouter.ai/openai/gpt-audio) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-audio/endpoints) |
| `openai/gpt-audio-mini` | OpenAI: GPT Audio Mini | audio-generation | `text+audio->text+audio` | 128000 | prompt=0.0000006<br>completion=0.0000024 | [model](https://openrouter.ai/openai/gpt-audio-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-audio-mini/endpoints) |
| `openai/gpt-chat-latest` | OpenAI: GPT Chat Latest | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.000005<br>completion=0.00003<br>web_search=0.01<br>input_cache_read=0.0000005 | [model](https://openrouter.ai/openai/gpt-chat-latest) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-chat-latest-20260505/endpoints) |
| `openai/gpt-oss-120b` | OpenAI: gpt-oss-120b | chat | `text->text` | 131072 | prompt=0.000000039<br>completion=0.00000018 | [model](https://openrouter.ai/openai/gpt-oss-120b) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-oss-120b/endpoints) |
| `openai/gpt-oss-120b:free` | OpenAI: gpt-oss-120b (free) | chat | `text->text` | 131072 | prompt=0<br>completion=0 | [model](https://openrouter.ai/openai/gpt-oss-120b:free) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-oss-120b/endpoints) |
| `openai/gpt-oss-20b` | OpenAI: gpt-oss-20b | chat | `text->text` | 131072 | prompt=0.000000029<br>completion=0.00000014 | [model](https://openrouter.ai/openai/gpt-oss-20b) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-oss-20b/endpoints) |
| `openai/gpt-oss-20b:free` | OpenAI: gpt-oss-20b (free) | chat | `text->text` | 131072 | prompt=0<br>completion=0 | [model](https://openrouter.ai/openai/gpt-oss-20b:free) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-oss-20b/endpoints) |
| `openai/gpt-oss-safeguard-20b` | OpenAI: gpt-oss-safeguard-20b | chat | `text->text` | 131072 | prompt=0.000000075<br>completion=0.0000003<br>input_cache_read=0.000000037 | [model](https://openrouter.ai/openai/gpt-oss-safeguard-20b) / [endpoints](https://openrouter.ai/api/v1/models/openai/gpt-oss-safeguard-20b/endpoints) |
| `openai/o1` | OpenAI: o1 | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.000015<br>completion=0.00006<br>web_search=0.01<br>input_cache_read=0.0000075 | [model](https://openrouter.ai/openai/o1) / [endpoints](https://openrouter.ai/api/v1/models/openai/o1-2024-12-17/endpoints) |
| `openai/o1-pro` | OpenAI: o1-pro | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.00015<br>completion=0.0006<br>web_search=0.01 | [model](https://openrouter.ai/openai/o1-pro) / [endpoints](https://openrouter.ai/api/v1/models/openai/o1-pro/endpoints) |
| `openai/o3` | OpenAI: o3 | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.000002<br>completion=0.000008<br>web_search=0.01<br>input_cache_read=0.0000005 | [model](https://openrouter.ai/openai/o3) / [endpoints](https://openrouter.ai/api/v1/models/openai/o3-2025-04-16/endpoints) |
| `openai/o3-deep-research` | OpenAI: o3 Deep Research | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.00001<br>completion=0.00004<br>web_search=0.01<br>input_cache_read=0.0000025 | [model](https://openrouter.ai/openai/o3-deep-research) / [endpoints](https://openrouter.ai/api/v1/models/openai/o3-deep-research-2025-06-26/endpoints) |
| `openai/o3-mini` | OpenAI: o3 Mini | multimodal-chat | `text+file->text` | 200000 | prompt=0.0000011<br>completion=0.0000044<br>web_search=0.01<br>input_cache_read=0.00000055 | [model](https://openrouter.ai/openai/o3-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/o3-mini-2025-01-31/endpoints) |
| `openai/o3-mini-high` | OpenAI: o3 Mini High | multimodal-chat | `text+file->text` | 200000 | prompt=0.0000011<br>completion=0.0000044<br>web_search=0.01<br>input_cache_read=0.00000055 | [model](https://openrouter.ai/openai/o3-mini-high) / [endpoints](https://openrouter.ai/api/v1/models/openai/o3-mini-high-2025-01-31/endpoints) |
| `openai/o3-pro` | OpenAI: o3 Pro | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.00002<br>completion=0.00008<br>web_search=0.01 | [model](https://openrouter.ai/openai/o3-pro) / [endpoints](https://openrouter.ai/api/v1/models/openai/o3-pro-2025-06-10/endpoints) |
| `openai/o4-mini` | OpenAI: o4 Mini | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.0000011<br>completion=0.0000044<br>web_search=0.01<br>input_cache_read=0.000000275 | [model](https://openrouter.ai/openai/o4-mini) / [endpoints](https://openrouter.ai/api/v1/models/openai/o4-mini-2025-04-16/endpoints) |
| `openai/o4-mini-deep-research` | OpenAI: o4 Mini Deep Research | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.000002<br>completion=0.000008<br>web_search=0.01<br>input_cache_read=0.0000005 | [model](https://openrouter.ai/openai/o4-mini-deep-research) / [endpoints](https://openrouter.ai/api/v1/models/openai/o4-mini-deep-research-2025-06-26/endpoints) |
| `openai/o4-mini-high` | OpenAI: o4 Mini High | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.0000011<br>completion=0.0000044<br>web_search=0.01<br>input_cache_read=0.000000275 | [model](https://openrouter.ai/openai/o4-mini-high) / [endpoints](https://openrouter.ai/api/v1/models/openai/o4-mini-high-2025-04-16/endpoints) |
### Provider: qwen (49 models)

Type mix: chat: 28, multimodal-chat: 21.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `qwen/qwen-2.5-72b-instruct` | Qwen2.5 72B Instruct | chat | `text->text` | 131072 | prompt=0.00000036<br>completion=0.0000004 | [model](https://openrouter.ai/qwen/qwen-2.5-72b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen-2.5-72b-instruct/endpoints) |
| `qwen/qwen-2.5-7b-instruct` | Qwen: Qwen2.5 7B Instruct | chat | `text->text` | 131072 | prompt=0.00000004<br>completion=0.0000001 | [model](https://openrouter.ai/qwen/qwen-2.5-7b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen-2.5-7b-instruct/endpoints) |
| `qwen/qwen-2.5-coder-32b-instruct` | Qwen2.5 Coder 32B Instruct | chat | `text->text` | 128000 | prompt=0.00000066<br>completion=0.000001 | [model](https://openrouter.ai/qwen/qwen-2.5-coder-32b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen-2.5-coder-32b-instruct/endpoints) |
| `qwen/qwen-plus` | Qwen: Qwen-Plus | chat | `text->text` | 1000000 | prompt=0.00000026<br>completion=0.00000078<br>input_cache_read=0.000000052<br>input_cache_write=0.000000325 | [model](https://openrouter.ai/qwen/qwen-plus) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen-plus-2025-01-25/endpoints) |
| `qwen/qwen-plus-2025-07-28` | Qwen: Qwen Plus 0728 | chat | `text->text` | 1000000 | prompt=0.00000026<br>completion=0.00000078 | [model](https://openrouter.ai/qwen/qwen-plus-2025-07-28) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen-plus-2025-07-28/endpoints) |
| `qwen/qwen-plus-2025-07-28:thinking` | Qwen: Qwen Plus 0728 (thinking) | chat | `text->text` | 1000000 | prompt=0.00000026<br>completion=0.00000078<br>input_cache_write=0.000000325 | [model](https://openrouter.ai/qwen/qwen-plus-2025-07-28:thinking) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen-plus-2025-07-28/endpoints) |
| `qwen/qwen2.5-vl-72b-instruct` | Qwen: Qwen2.5 VL 72B Instruct | multimodal-chat | `text+image->text` | 131072 | prompt=0.00000025<br>completion=0.00000075 | [model](https://openrouter.ai/qwen/qwen2.5-vl-72b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen2.5-vl-72b-instruct/endpoints) |
| `qwen/qwen3-14b` | Qwen: Qwen3 14B | chat | `text->text` | 131702 | prompt=0.0000001<br>completion=0.00000024 | [model](https://openrouter.ai/qwen/qwen3-14b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-14b-04-28/endpoints) |
| `qwen/qwen3-235b-a22b` | Qwen: Qwen3 235B A22B | chat | `text->text` | 131072 | prompt=0.000000455<br>completion=0.00000182 | [model](https://openrouter.ai/qwen/qwen3-235b-a22b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-235b-a22b-04-28/endpoints) |
| `qwen/qwen3-235b-a22b-2507` | Qwen: Qwen3 235B A22B Instruct 2507 | chat | `text->text` | 262144 | prompt=0.00000009<br>completion=0.0000001 | [model](https://openrouter.ai/qwen/qwen3-235b-a22b-2507) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-235b-a22b-07-25/endpoints) |
| `qwen/qwen3-235b-a22b-thinking-2507` | Qwen: Qwen3 235B A22B Thinking 2507 | chat | `text->text` | 262144 | prompt=0.0000001<br>completion=0.0000001<br>input_cache_read=0.0000001 | [model](https://openrouter.ai/qwen/qwen3-235b-a22b-thinking-2507) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-235b-a22b-thinking-2507/endpoints) |
| `qwen/qwen3-30b-a3b` | Qwen: Qwen3 30B A3B | chat | `text->text` | 131072 | prompt=0.00000012<br>completion=0.0000005 | [model](https://openrouter.ai/qwen/qwen3-30b-a3b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-30b-a3b-04-28/endpoints) |
| `qwen/qwen3-30b-a3b-instruct-2507` | Qwen: Qwen3 30B A3B Instruct 2507 | chat | `text->text` | 131072 | prompt=0.00000004815<br>completion=0.00000019305 | [model](https://openrouter.ai/qwen/qwen3-30b-a3b-instruct-2507) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-30b-a3b-instruct-2507/endpoints) |
| `qwen/qwen3-30b-a3b-thinking-2507` | Qwen: Qwen3 30B A3B Thinking 2507 | chat | `text->text` | 131072 | prompt=0.00000008<br>completion=0.0000004<br>input_cache_read=0.00000008 | [model](https://openrouter.ai/qwen/qwen3-30b-a3b-thinking-2507) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-30b-a3b-thinking-2507/endpoints) |
| `qwen/qwen3-32b` | Qwen: Qwen3 32B | chat | `text->text` | 131072 | prompt=0.00000008<br>completion=0.00000028 | [model](https://openrouter.ai/qwen/qwen3-32b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-32b-04-28/endpoints) |
| `qwen/qwen3-8b` | Qwen: Qwen3 8B | chat | `text->text` | 131072 | prompt=0.00000005<br>completion=0.0000004<br>input_cache_read=0.00000005 | [model](https://openrouter.ai/qwen/qwen3-8b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-8b-04-28/endpoints) |
| `qwen/qwen3-coder` | Qwen: Qwen3 Coder 480B A35B | chat | `text->text` | 1048576 | prompt=0.00000022<br>completion=0.0000018 | [model](https://openrouter.ai/qwen/qwen3-coder) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-coder-480b-a35b-07-25/endpoints) |
| `qwen/qwen3-coder-30b-a3b-instruct` | Qwen: Qwen3 Coder 30B A3B Instruct | chat | `text->text` | 160000 | prompt=0.00000007<br>completion=0.00000027 | [model](https://openrouter.ai/qwen/qwen3-coder-30b-a3b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-coder-30b-a3b-instruct/endpoints) |
| `qwen/qwen3-coder-flash` | Qwen: Qwen3 Coder Flash | chat | `text->text` | 1000000 | prompt=0.000000195<br>completion=0.000000975<br>input_cache_read=0.000000039<br>input_cache_write=0.00000024375 | [model](https://openrouter.ai/qwen/qwen3-coder-flash) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-coder-flash/endpoints) |
| `qwen/qwen3-coder-next` | Qwen: Qwen3 Coder Next | chat | `text->text` | 262144 | prompt=0.00000011<br>completion=0.0000008<br>input_cache_read=0.00000007 | [model](https://openrouter.ai/qwen/qwen3-coder-next) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-coder-next-2025-02-03/endpoints) |
| `qwen/qwen3-coder-plus` | Qwen: Qwen3 Coder Plus | chat | `text->text` | 1000000 | prompt=0.00000065<br>completion=0.00000325<br>input_cache_read=0.00000013<br>input_cache_write=0.0000008125 | [model](https://openrouter.ai/qwen/qwen3-coder-plus) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-coder-plus/endpoints) |
| `qwen/qwen3-coder:free` | Qwen: Qwen3 Coder 480B A35B (free) | chat | `text->text` | 1048576 | prompt=0<br>completion=0 | [model](https://openrouter.ai/qwen/qwen3-coder:free) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-coder-480b-a35b-07-25/endpoints) |
| `qwen/qwen3-max` | Qwen: Qwen3 Max | chat | `text->text` | 262144 | prompt=0.00000078<br>completion=0.0000039<br>input_cache_read=0.000000156<br>input_cache_write=0.000000975 | [model](https://openrouter.ai/qwen/qwen3-max) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-max/endpoints) |
| `qwen/qwen3-max-thinking` | Qwen: Qwen3 Max Thinking | chat | `text->text` | 262144 | prompt=0.00000078<br>completion=0.0000039 | [model](https://openrouter.ai/qwen/qwen3-max-thinking) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-max-thinking-20260123/endpoints) |
| `qwen/qwen3-next-80b-a3b-instruct` | Qwen: Qwen3 Next 80B A3B Instruct | chat | `text->text` | 262144 | prompt=0.00000009<br>completion=0.0000011 | [model](https://openrouter.ai/qwen/qwen3-next-80b-a3b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-next-80b-a3b-instruct-2509/endpoints) |
| `qwen/qwen3-next-80b-a3b-instruct:free` | Qwen: Qwen3 Next 80B A3B Instruct (free) | chat | `text->text` | 262144 | prompt=0<br>completion=0 | [model](https://openrouter.ai/qwen/qwen3-next-80b-a3b-instruct:free) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-next-80b-a3b-instruct-2509/endpoints) |
| `qwen/qwen3-next-80b-a3b-thinking` | Qwen: Qwen3 Next 80B A3B Thinking | chat | `text->text` | 262144 | prompt=0.0000000975<br>completion=0.00000078 | [model](https://openrouter.ai/qwen/qwen3-next-80b-a3b-thinking) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-next-80b-a3b-thinking-2509/endpoints) |
| `qwen/qwen3-vl-235b-a22b-instruct` | Qwen: Qwen3 VL 235B A22B Instruct | multimodal-chat | `text+image->text` | 262144 | prompt=0.0000002<br>completion=0.00000088<br>input_cache_read=0.00000011 | [model](https://openrouter.ai/qwen/qwen3-vl-235b-a22b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-vl-235b-a22b-instruct/endpoints) |
| `qwen/qwen3-vl-235b-a22b-thinking` | Qwen: Qwen3 VL 235B A22B Thinking | multimodal-chat | `text+image->text` | 131072 | prompt=0.00000026<br>completion=0.0000026 | [model](https://openrouter.ai/qwen/qwen3-vl-235b-a22b-thinking) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-vl-235b-a22b-thinking/endpoints) |
| `qwen/qwen3-vl-30b-a3b-instruct` | Qwen: Qwen3 VL 30B A3B Instruct | multimodal-chat | `text+image->text` | 262144 | prompt=0.00000013<br>completion=0.00000052 | [model](https://openrouter.ai/qwen/qwen3-vl-30b-a3b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-vl-30b-a3b-instruct/endpoints) |
| `qwen/qwen3-vl-30b-a3b-thinking` | Qwen: Qwen3 VL 30B A3B Thinking | multimodal-chat | `text+image->text` | 131072 | prompt=0.00000013<br>completion=0.00000156 | [model](https://openrouter.ai/qwen/qwen3-vl-30b-a3b-thinking) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-vl-30b-a3b-thinking/endpoints) |
| `qwen/qwen3-vl-32b-instruct` | Qwen: Qwen3 VL 32B Instruct | multimodal-chat | `text+image->text` | 262144 | prompt=0.000000104<br>completion=0.000000416 | [model](https://openrouter.ai/qwen/qwen3-vl-32b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-vl-32b-instruct/endpoints) |
| `qwen/qwen3-vl-8b-instruct` | Qwen: Qwen3 VL 8B Instruct | multimodal-chat | `text+image->text` | 256000 | prompt=0.00000008<br>completion=0.0000005 | [model](https://openrouter.ai/qwen/qwen3-vl-8b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-vl-8b-instruct/endpoints) |
| `qwen/qwen3-vl-8b-thinking` | Qwen: Qwen3 VL 8B Thinking | multimodal-chat | `text+image->text` | 256000 | prompt=0.000000117<br>completion=0.000001365 | [model](https://openrouter.ai/qwen/qwen3-vl-8b-thinking) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3-vl-8b-thinking/endpoints) |
| `qwen/qwen3.5-122b-a10b` | Qwen: Qwen3.5-122B-A10B | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.00000026<br>completion=0.00000208 | [model](https://openrouter.ai/qwen/qwen3.5-122b-a10b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.5-122b-a10b-20260224/endpoints) |
| `qwen/qwen3.5-27b` | Qwen: Qwen3.5-27B | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.000000195<br>completion=0.00000156 | [model](https://openrouter.ai/qwen/qwen3.5-27b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.5-27b-20260224/endpoints) |
| `qwen/qwen3.5-35b-a3b` | Qwen: Qwen3.5-35B-A3B | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.00000014<br>completion=0.000001<br>input_cache_read=0.00000005 | [model](https://openrouter.ai/qwen/qwen3.5-35b-a3b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.5-35b-a3b-20260224/endpoints) |
| `qwen/qwen3.5-397b-a17b` | Qwen: Qwen3.5 397B A17B | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.00000039<br>completion=0.00000234 | [model](https://openrouter.ai/qwen/qwen3.5-397b-a17b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.5-397b-a17b-20260216/endpoints) |
| `qwen/qwen3.5-9b` | Qwen: Qwen3.5-9B | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.0000001<br>completion=0.00000015 | [model](https://openrouter.ai/qwen/qwen3.5-9b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.5-9b-20260310/endpoints) |
| `qwen/qwen3.5-flash-02-23` | Qwen: Qwen3.5-Flash | multimodal-chat | `text+image+video->text` | 1000000 | prompt=0.000000065<br>completion=0.00000026 | [model](https://openrouter.ai/qwen/qwen3.5-flash-02-23) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.5-flash-20260224/endpoints) |
| `qwen/qwen3.5-plus-02-15` | Qwen: Qwen3.5 Plus 2026-02-15 | multimodal-chat | `text+image+video->text` | 1000000 | prompt=0.00000026<br>completion=0.00000156 | [model](https://openrouter.ai/qwen/qwen3.5-plus-02-15) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.5-plus-20260216/endpoints) |
| `qwen/qwen3.5-plus-20260420` | Qwen: Qwen3.5 Plus 2026-04-20 | multimodal-chat | `text+image+video->text` | 1000000 | prompt=0.0000003<br>completion=0.0000018<br>input_cache_write=0.000000375 | [model](https://openrouter.ai/qwen/qwen3.5-plus-20260420) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.5-plus-20260420/endpoints) |
| `qwen/qwen3.6-27b` | Qwen: Qwen3.6 27B | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.000000289<br>completion=0.0000024 | [model](https://openrouter.ai/qwen/qwen3.6-27b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.6-27b-20260422/endpoints) |
| `qwen/qwen3.6-35b-a3b` | Qwen: Qwen3.6 35B A3B | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.00000014<br>completion=0.000001 | [model](https://openrouter.ai/qwen/qwen3.6-35b-a3b) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.6-35b-a3b-20260415/endpoints) |
| `qwen/qwen3.6-flash` | Qwen: Qwen3.6 Flash | multimodal-chat | `text+image+video->text` | 1000000 | prompt=0.0000001875<br>completion=0.000001125<br>input_cache_write=0.000000234375 | [model](https://openrouter.ai/qwen/qwen3.6-flash) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.6-flash/endpoints) |
| `qwen/qwen3.6-max-preview` | Qwen: Qwen3.6 Max Preview | chat | `text->text` | 262144 | prompt=0.00000104<br>completion=0.00000624<br>input_cache_write=0.0000013 | [model](https://openrouter.ai/qwen/qwen3.6-max-preview) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.6-max-preview-20260420/endpoints) |
| `qwen/qwen3.6-plus` | Qwen: Qwen3.6 Plus | multimodal-chat | `text+image+video->text` | 1000000 | prompt=0.000000325<br>completion=0.00000195<br>input_cache_write=0.00000040625 | [model](https://openrouter.ai/qwen/qwen3.6-plus) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.6-plus-04-02/endpoints) |
| `qwen/qwen3.7-max` | Qwen: Qwen3.7 Max | chat | `text->text` | 1000000 | prompt=0.00000125<br>completion=0.00000375<br>input_cache_read=0.00000025<br>input_cache_write=0.0000015625 | [model](https://openrouter.ai/qwen/qwen3.7-max) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.7-max-20260520/endpoints) |
| `qwen/qwen3.7-plus` | Qwen: Qwen3.7 Plus | multimodal-chat | `text+image->text` | 1000000 | prompt=0.0000004<br>completion=0.0000016<br>input_cache_read=0.00000008<br>input_cache_write=0.0000005 | [model](https://openrouter.ai/qwen/qwen3.7-plus) / [endpoints](https://openrouter.ai/api/v1/models/qwen/qwen3.7-plus-20260602/endpoints) |
### Provider: google (26 models)

Type mix: audio-generation: 2, chat: 2, image-generation: 3, multimodal-chat: 7, speech-to-text-or-audio-understanding: 12.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `google/gemini-2.5-flash` | Google: Gemini 2.5 Flash | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.0000003<br>completion=0.0000025<br>image=0.0000003<br>web_search=0.014<br>input_cache_read=0.00000003<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/google/gemini-2.5-flash) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash/endpoints) |
| `google/gemini-2.5-flash-image` | Google: Nano Banana (Gemini 2.5 Flash Image) | image-generation | `text+image->text+image` | 32768 | prompt=0.0000003<br>completion=0.0000025<br>image=0.0000003<br>web_search=0.014<br>input_cache_read=0.00000003<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/google/gemini-2.5-flash-image) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash-image/endpoints) |
| `google/gemini-2.5-flash-lite` | Google: Gemini 2.5 Flash Lite | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.0000001<br>completion=0.0000004<br>image=0.0000001<br>web_search=0.014<br>input_cache_read=0.00000001<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/google/gemini-2.5-flash-lite) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash-lite/endpoints) |
| `google/gemini-2.5-flash-lite-preview-09-2025` | Google: Gemini 2.5 Flash Lite Preview 09-2025 | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.0000001<br>completion=0.0000004<br>image=0.0000001<br>web_search=0.014<br>input_cache_read=0.00000001<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/google/gemini-2.5-flash-lite-preview-09-2025) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash-lite-preview-09-2025/endpoints) |
| `google/gemini-2.5-pro` | Google: Gemini 2.5 Pro | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.00000125<br>completion=0.00001<br>image=0.00000125<br>web_search=0.014<br>input_cache_read=0.000000125<br>input_cache_write=0.000000375 | [model](https://openrouter.ai/google/gemini-2.5-pro) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-pro/endpoints) |
| `google/gemini-2.5-pro-preview` | Google: Gemini 2.5 Pro Preview 06-05 | speech-to-text-or-audio-understanding | `text+image+file+audio->text` | 1048576 | prompt=0.00000125<br>completion=0.00001<br>image=0.00000125<br>web_search=0.014<br>input_cache_read=0.000000125<br>input_cache_write=0.000000375 | [model](https://openrouter.ai/google/gemini-2.5-pro-preview) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-pro-preview-06-05/endpoints) |
| `google/gemini-2.5-pro-preview-05-06` | Google: Gemini 2.5 Pro Preview 05-06 | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.00000125<br>completion=0.00001<br>image=0.00000125<br>web_search=0.014<br>input_cache_read=0.000000125<br>input_cache_write=0.000000375 | [model](https://openrouter.ai/google/gemini-2.5-pro-preview-05-06) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-pro-preview-03-25/endpoints) |
| `google/gemini-3-flash-preview` | Google: Gemini 3 Flash Preview | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.0000005<br>completion=0.000003<br>image=0.0000005<br>web_search=0.014<br>input_cache_read=0.00000005<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/google/gemini-3-flash-preview) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-3-flash-preview-20251217/endpoints) |
| `google/gemini-3-pro-image-preview` | Google: Nano Banana Pro (Gemini 3 Pro Image Preview) | image-generation | `text+image->text+image` | 65536 | prompt=0.000002<br>completion=0.000012<br>image=0.000002<br>web_search=0.014<br>input_cache_read=0.0000002<br>input_cache_write=0.000000375 | [model](https://openrouter.ai/google/gemini-3-pro-image-preview) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-3-pro-image-preview-20251120/endpoints) |
| `google/gemini-3.1-flash-image-preview` | Google: Nano Banana 2 (Gemini 3.1 Flash Image Preview) | image-generation | `text+image->text+image` | 131072 | prompt=0.0000005<br>completion=0.000003<br>web_search=0.014 | [model](https://openrouter.ai/google/gemini-3.1-flash-image-preview) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-3.1-flash-image-preview-20260226/endpoints) |
| `google/gemini-3.1-flash-lite` | Google: Gemini 3.1 Flash Lite | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.00000025<br>completion=0.0000015<br>image=0.00000025<br>web_search=0.014<br>input_cache_read=0.000000025<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/google/gemini-3.1-flash-lite) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-3.1-flash-lite-20260507/endpoints) |
| `google/gemini-3.1-flash-lite-preview` | Google: Gemini 3.1 Flash Lite Preview | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.00000025<br>completion=0.0000015<br>image=0.00000025<br>web_search=0.014<br>input_cache_read=0.000000025<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/google/gemini-3.1-flash-lite-preview) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-3.1-flash-lite-preview-20260303/endpoints) |
| `google/gemini-3.1-pro-preview` | Google: Gemini 3.1 Pro Preview | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.000002<br>completion=0.000012<br>image=0.000002<br>web_search=0.014<br>input_cache_read=0.0000002<br>input_cache_write=0.000000375 | [model](https://openrouter.ai/google/gemini-3.1-pro-preview) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-3.1-pro-preview-20260219/endpoints) |
| `google/gemini-3.1-pro-preview-customtools` | Google: Gemini 3.1 Pro Preview Custom Tools | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048756 | prompt=0.000002<br>completion=0.000012<br>image=0.000002<br>web_search=0.014<br>input_cache_read=0.0000002<br>input_cache_write=0.000000375 | [model](https://openrouter.ai/google/gemini-3.1-pro-preview-customtools) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-3.1-pro-preview-customtools-20260219/endpoints) |
| `google/gemini-3.5-flash` | Google: Gemini 3.5 Flash | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.0000015<br>completion=0.000009<br>image=0.0000015<br>web_search=0.014<br>input_cache_read=0.00000015<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/google/gemini-3.5-flash) / [endpoints](https://openrouter.ai/api/v1/models/google/gemini-3.5-flash-20260519/endpoints) |
| `google/gemma-2-27b-it` | Google: Gemma 2 27B | chat | `text->text` | 8192 | prompt=0.00000065<br>completion=0.00000065 | [model](https://openrouter.ai/google/gemma-2-27b-it) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-2-27b-it/endpoints) |
| `google/gemma-3-12b-it` | Google: Gemma 3 12B | multimodal-chat | `text+image->text` | 131072 | prompt=0.00000005<br>completion=0.00000015 | [model](https://openrouter.ai/google/gemma-3-12b-it) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-3-12b-it/endpoints) |
| `google/gemma-3-27b-it` | Google: Gemma 3 27B | multimodal-chat | `text+image->text` | 131072 | prompt=0.00000008<br>completion=0.00000016 | [model](https://openrouter.ai/google/gemma-3-27b-it) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-3-27b-it/endpoints) |
| `google/gemma-3-4b-it` | Google: Gemma 3 4B | multimodal-chat | `text+image->text` | 131072 | prompt=0.00000005<br>completion=0.0000001 | [model](https://openrouter.ai/google/gemma-3-4b-it) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-3-4b-it/endpoints) |
| `google/gemma-3n-e4b-it` | Google: Gemma 3n 4B | chat | `text->text` | 32768 | prompt=0.00000006<br>completion=0.00000012 | [model](https://openrouter.ai/google/gemma-3n-e4b-it) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-3n-e4b-it/endpoints) |
| `google/gemma-4-26b-a4b-it` | Google: Gemma 4 26B A4B  | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.00000006<br>completion=0.00000033 | [model](https://openrouter.ai/google/gemma-4-26b-a4b-it) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-4-26b-a4b-it-20260403/endpoints) |
| `google/gemma-4-26b-a4b-it:free` | Google: Gemma 4 26B A4B  (free) | multimodal-chat | `text+image+video->text` | 262144 | prompt=0<br>completion=0 | [model](https://openrouter.ai/google/gemma-4-26b-a4b-it:free) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-4-26b-a4b-it-20260403/endpoints) |
| `google/gemma-4-31b-it` | Google: Gemma 4 31B | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.00000012<br>completion=0.00000036<br>input_cache_read=0.00000009 | [model](https://openrouter.ai/google/gemma-4-31b-it) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-4-31b-it-20260402/endpoints) |
| `google/gemma-4-31b-it:free` | Google: Gemma 4 31B (free) | multimodal-chat | `text+image+video->text` | 262144 | prompt=0<br>completion=0 | [model](https://openrouter.ai/google/gemma-4-31b-it:free) / [endpoints](https://openrouter.ai/api/v1/models/google/gemma-4-31b-it-20260402/endpoints) |
| `google/lyria-3-clip-preview` | Google: Lyria 3 Clip Preview | audio-generation | `text+image->text+audio` | 1048576 | prompt=0<br>completion=0 | [model](https://openrouter.ai/google/lyria-3-clip-preview) / [endpoints](https://openrouter.ai/api/v1/models/google/lyria-3-clip-preview-20260330/endpoints) |
| `google/lyria-3-pro-preview` | Google: Lyria 3 Pro Preview | audio-generation | `text+image->text+audio` | 1048576 | prompt=0<br>completion=0 | [model](https://openrouter.ai/google/lyria-3-pro-preview) / [endpoints](https://openrouter.ai/api/v1/models/google/lyria-3-pro-preview-20260330/endpoints) |
### Provider: mistralai (19 models)

Type mix: chat: 2, multimodal-chat: 16, speech-to-text-or-audio-understanding: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `mistralai/codestral-2508` | Mistral: Codestral 2508 | multimodal-chat | `text+file->text` | 256000 | prompt=0.0000003<br>completion=0.0000009<br>input_cache_read=0.00000003 | [model](https://openrouter.ai/mistralai/codestral-2508) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/codestral-2508/endpoints) |
| `mistralai/devstral-2512` | Mistral: Devstral 2 2512 | multimodal-chat | `text+file->text` | 262144 | prompt=0.0000004<br>completion=0.000002<br>input_cache_read=0.00000004 | [model](https://openrouter.ai/mistralai/devstral-2512) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/devstral-2512/endpoints) |
| `mistralai/ministral-14b-2512` | Mistral: Ministral 3 14B 2512 | multimodal-chat | `text+image->text` | 262144 | prompt=0.0000002<br>completion=0.0000002<br>input_cache_read=0.00000002 | [model](https://openrouter.ai/mistralai/ministral-14b-2512) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/ministral-14b-2512/endpoints) |
| `mistralai/ministral-3b-2512` | Mistral: Ministral 3 3B 2512 | multimodal-chat | `text+image->text` | 131072 | prompt=0.0000001<br>completion=0.0000001<br>input_cache_read=0.00000001 | [model](https://openrouter.ai/mistralai/ministral-3b-2512) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/ministral-3b-2512/endpoints) |
| `mistralai/ministral-8b-2512` | Mistral: Ministral 3 8B 2512 | multimodal-chat | `text+image->text` | 262144 | prompt=0.00000015<br>completion=0.00000015<br>input_cache_read=0.000000015 | [model](https://openrouter.ai/mistralai/ministral-8b-2512) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/ministral-8b-2512/endpoints) |
| `mistralai/mistral-large` | Mistral Large | multimodal-chat | `text+file->text` | 128000 | prompt=0.000002<br>completion=0.000006<br>input_cache_read=0.0000002 | [model](https://openrouter.ai/mistralai/mistral-large) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-large/endpoints) |
| `mistralai/mistral-large-2407` | Mistral Large 2407 | multimodal-chat | `text+file->text` | 131072 | prompt=0.000002<br>completion=0.000006<br>input_cache_read=0.0000002 | [model](https://openrouter.ai/mistralai/mistral-large-2407) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-large-2407/endpoints) |
| `mistralai/mistral-large-2512` | Mistral: Mistral Large 3 2512 | multimodal-chat | `text+image+file->text` | 262144 | prompt=0.0000005<br>completion=0.0000015<br>input_cache_read=0.00000005 | [model](https://openrouter.ai/mistralai/mistral-large-2512) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-large-2512/endpoints) |
| `mistralai/mistral-medium-3` | Mistral: Mistral Medium 3 | multimodal-chat | `text+image+file->text` | 131072 | prompt=0.0000004<br>completion=0.000002<br>input_cache_read=0.00000004 | [model](https://openrouter.ai/mistralai/mistral-medium-3) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-medium-3/endpoints) |
| `mistralai/mistral-medium-3-5` | Mistral: Mistral Medium 3.5 | multimodal-chat | `text+image+file->text` | 262144 | prompt=0.0000015<br>completion=0.0000075 | [model](https://openrouter.ai/mistralai/mistral-medium-3-5) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-medium-3.5-20260430/endpoints) |
| `mistralai/mistral-medium-3.1` | Mistral: Mistral Medium 3.1 | multimodal-chat | `text+image+file->text` | 131072 | prompt=0.0000004<br>completion=0.000002<br>input_cache_read=0.00000004 | [model](https://openrouter.ai/mistralai/mistral-medium-3.1) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-medium-3.1/endpoints) |
| `mistralai/mistral-nemo` | Mistral: Mistral Nemo | chat | `text->text` | 131072 | prompt=0.00000002<br>completion=0.00000003 | [model](https://openrouter.ai/mistralai/mistral-nemo) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-nemo/endpoints) |
| `mistralai/mistral-saba` | Mistral: Saba | multimodal-chat | `text+file->text` | 32768 | prompt=0.0000002<br>completion=0.0000006<br>input_cache_read=0.00000002 | [model](https://openrouter.ai/mistralai/mistral-saba) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-saba-2502/endpoints) |
| `mistralai/mistral-small-24b-instruct-2501` | Mistral: Mistral Small 3 | chat | `text->text` | 32768 | prompt=0.00000005<br>completion=0.00000008 | [model](https://openrouter.ai/mistralai/mistral-small-24b-instruct-2501) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-small-24b-instruct-2501/endpoints) |
| `mistralai/mistral-small-2603` | Mistral: Mistral Small 4 | multimodal-chat | `text+image->text` | 262144 | prompt=0.00000015<br>completion=0.0000006<br>input_cache_read=0.000000015 | [model](https://openrouter.ai/mistralai/mistral-small-2603) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-small-2603/endpoints) |
| `mistralai/mistral-small-3.1-24b-instruct` | Mistral: Mistral Small 3.1 24B | multimodal-chat | `text+image->text` | 128000 | prompt=0.000000351<br>completion=0.000000555 | [model](https://openrouter.ai/mistralai/mistral-small-3.1-24b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-small-3.1-24b-instruct-2503/endpoints) |
| `mistralai/mistral-small-3.2-24b-instruct` | Mistral: Mistral Small 3.2 24B | multimodal-chat | `text+image->text` | 128000 | prompt=0.000000075<br>completion=0.0000002 | [model](https://openrouter.ai/mistralai/mistral-small-3.2-24b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mistral-small-3.2-24b-instruct-2506/endpoints) |
| `mistralai/mixtral-8x22b-instruct` | Mistral: Mixtral 8x22B Instruct | multimodal-chat | `text+file->text` | 65536 | prompt=0.000002<br>completion=0.000006<br>input_cache_read=0.0000002 | [model](https://openrouter.ai/mistralai/mixtral-8x22b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/mixtral-8x22b-instruct/endpoints) |
| `mistralai/voxtral-small-24b-2507` | Mistral: Voxtral Small 24B 2507 | speech-to-text-or-audio-understanding | `text+file+audio->text` | 32000 | prompt=0.0000001<br>completion=0.0000003<br>input_cache_read=0.00000001 | [model](https://openrouter.ai/mistralai/voxtral-small-24b-2507) / [endpoints](https://openrouter.ai/api/v1/models/mistralai/voxtral-small-24b-2507/endpoints) |
### Provider: anthropic (15 models)

Type mix: multimodal-chat: 15.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `anthropic/claude-3-haiku` | Anthropic: Claude 3 Haiku | multimodal-chat | `text+image->text` | 200000 | prompt=0.00000025<br>completion=0.00000125<br>input_cache_read=0.00000003<br>input_cache_write=0.0000003 | [model](https://openrouter.ai/anthropic/claude-3-haiku) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-3-haiku/endpoints) |
| `anthropic/claude-3.5-haiku` | Anthropic: Claude 3.5 Haiku | multimodal-chat | `text+image->text` | 200000 | prompt=0.0000008<br>completion=0.000004<br>web_search=0.01<br>input_cache_read=0.00000008<br>input_cache_write=0.000001 | [model](https://openrouter.ai/anthropic/claude-3.5-haiku) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-3-5-haiku/endpoints) |
| `anthropic/claude-haiku-4.5` | Anthropic: Claude Haiku 4.5 | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.000001<br>completion=0.000005<br>web_search=0.01<br>input_cache_read=0.0000001<br>input_cache_write=0.00000125 | [model](https://openrouter.ai/anthropic/claude-haiku-4.5) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.5-haiku-20251001/endpoints) |
| `anthropic/claude-opus-4` | Anthropic: Claude Opus 4 | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.000015<br>completion=0.000075<br>web_search=0.01<br>input_cache_read=0.0000015<br>input_cache_write=0.00001875 | [model](https://openrouter.ai/anthropic/claude-opus-4) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4-opus-20250522/endpoints) |
| `anthropic/claude-opus-4.1` | Anthropic: Claude Opus 4.1 | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.000015<br>completion=0.000075<br>web_search=0.01<br>input_cache_read=0.0000015<br>input_cache_write=0.00001875 | [model](https://openrouter.ai/anthropic/claude-opus-4.1) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.1-opus-20250805/endpoints) |
| `anthropic/claude-opus-4.5` | Anthropic: Claude Opus 4.5 | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.000005<br>completion=0.000025<br>web_search=0.01<br>input_cache_read=0.0000005<br>input_cache_write=0.00000625 | [model](https://openrouter.ai/anthropic/claude-opus-4.5) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.5-opus-20251124/endpoints) |
| `anthropic/claude-opus-4.6` | Anthropic: Claude Opus 4.6 | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.000005<br>completion=0.000025<br>web_search=0.01<br>input_cache_read=0.0000005<br>input_cache_write=0.00000625 | [model](https://openrouter.ai/anthropic/claude-opus-4.6) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.6-opus-20260205/endpoints) |
| `anthropic/claude-opus-4.6-fast` | Anthropic: Claude Opus 4.6 (Fast) | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.00003<br>completion=0.00015<br>web_search=0.01<br>input_cache_read=0.000003<br>input_cache_write=0.0000375 | [model](https://openrouter.ai/anthropic/claude-opus-4.6-fast) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.6-opus-fast-20260407/endpoints) |
| `anthropic/claude-opus-4.7` | Anthropic: Claude Opus 4.7 | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.000005<br>completion=0.000025<br>web_search=0.01<br>input_cache_read=0.0000005<br>input_cache_write=0.00000625 | [model](https://openrouter.ai/anthropic/claude-opus-4.7) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.7-opus-20260416/endpoints) |
| `anthropic/claude-opus-4.7-fast` | Anthropic: Claude Opus 4.7 (Fast) | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.00003<br>completion=0.00015<br>web_search=0.01<br>input_cache_read=0.000003<br>input_cache_write=0.0000375 | [model](https://openrouter.ai/anthropic/claude-opus-4.7-fast) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.7-opus-fast-20260512/endpoints) |
| `anthropic/claude-opus-4.8` | Anthropic: Claude Opus 4.8 | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.000005<br>completion=0.000025<br>web_search=0.01<br>input_cache_read=0.0000005<br>input_cache_write=0.00000625 | [model](https://openrouter.ai/anthropic/claude-opus-4.8) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.8-opus-20260528/endpoints) |
| `anthropic/claude-opus-4.8-fast` | Anthropic: Claude Opus 4.8 (Fast) | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.00001<br>completion=0.00005<br>web_search=0.01<br>input_cache_read=0.000001<br>input_cache_write=0.0000125 | [model](https://openrouter.ai/anthropic/claude-opus-4.8-fast) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.8-opus-fast-20260528/endpoints) |
| `anthropic/claude-sonnet-4` | Anthropic: Claude Sonnet 4 | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.000003<br>completion=0.000015<br>web_search=0.01<br>input_cache_read=0.0000003<br>input_cache_write=0.00000375 | [model](https://openrouter.ai/anthropic/claude-sonnet-4) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4-sonnet-20250522/endpoints) |
| `anthropic/claude-sonnet-4.5` | Anthropic: Claude Sonnet 4.5 | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.000003<br>completion=0.000015<br>web_search=0.01<br>input_cache_read=0.0000003<br>input_cache_write=0.00000375 | [model](https://openrouter.ai/anthropic/claude-sonnet-4.5) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.5-sonnet-20250929/endpoints) |
| `anthropic/claude-sonnet-4.6` | Anthropic: Claude Sonnet 4.6 | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.000003<br>completion=0.000015<br>web_search=0.01<br>input_cache_read=0.0000003<br>input_cache_write=0.00000375 | [model](https://openrouter.ai/anthropic/claude-sonnet-4.6) / [endpoints](https://openrouter.ai/api/v1/models/anthropic/claude-4.6-sonnet-20260217/endpoints) |
### Provider: meta-llama (14 models)

Type mix: chat: 10, multimodal-chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `meta-llama/llama-3-70b-instruct` | Meta: Llama 3 70B Instruct | chat | `text->text` | 8192 | prompt=0.00000051<br>completion=0.00000074 | [model](https://openrouter.ai/meta-llama/llama-3-70b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3-70b-instruct/endpoints) |
| `meta-llama/llama-3-8b-instruct` | Meta: Llama 3 8B Instruct | chat | `text->text` | 8192 | prompt=0.00000014<br>completion=0.00000014 | [model](https://openrouter.ai/meta-llama/llama-3-8b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3-8b-instruct/endpoints) |
| `meta-llama/llama-3.1-70b-instruct` | Meta: Llama 3.1 70B Instruct | chat | `text->text` | 131072 | prompt=0.0000004<br>completion=0.0000004 | [model](https://openrouter.ai/meta-llama/llama-3.1-70b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3.1-70b-instruct/endpoints) |
| `meta-llama/llama-3.1-8b-instruct` | Meta: Llama 3.1 8B Instruct | chat | `text->text` | 131072 | prompt=0.00000002<br>completion=0.00000003 | [model](https://openrouter.ai/meta-llama/llama-3.1-8b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3.1-8b-instruct/endpoints) |
| `meta-llama/llama-3.2-11b-vision-instruct` | Meta: Llama 3.2 11B Vision Instruct | multimodal-chat | `text+image->text` | 131072 | prompt=0.000000345<br>completion=0.000000345 | [model](https://openrouter.ai/meta-llama/llama-3.2-11b-vision-instruct) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3.2-11b-vision-instruct/endpoints) |
| `meta-llama/llama-3.2-1b-instruct` | Meta: Llama 3.2 1B Instruct | chat | `text->text` | 131072 | prompt=0.000000027<br>completion=0.000000201 | [model](https://openrouter.ai/meta-llama/llama-3.2-1b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3.2-1b-instruct/endpoints) |
| `meta-llama/llama-3.2-3b-instruct` | Meta: Llama 3.2 3B Instruct | chat | `text->text` | 131072 | prompt=0.0000000509<br>completion=0.000000335 | [model](https://openrouter.ai/meta-llama/llama-3.2-3b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3.2-3b-instruct/endpoints) |
| `meta-llama/llama-3.2-3b-instruct:free` | Meta: Llama 3.2 3B Instruct (free) | chat | `text->text` | 131072 | prompt=0<br>completion=0 | [model](https://openrouter.ai/meta-llama/llama-3.2-3b-instruct:free) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3.2-3b-instruct/endpoints) |
| `meta-llama/llama-3.3-70b-instruct` | Meta: Llama 3.3 70B Instruct | chat | `text->text` | 131072 | prompt=0.0000001<br>completion=0.00000032 | [model](https://openrouter.ai/meta-llama/llama-3.3-70b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3.3-70b-instruct/endpoints) |
| `meta-llama/llama-3.3-70b-instruct:free` | Meta: Llama 3.3 70B Instruct (free) | chat | `text->text` | 131072 | prompt=0<br>completion=0 | [model](https://openrouter.ai/meta-llama/llama-3.3-70b-instruct:free) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-3.3-70b-instruct/endpoints) |
| `meta-llama/llama-4-maverick` | Meta: Llama 4 Maverick | multimodal-chat | `text+image->text` | 1048576 | prompt=0.00000015<br>completion=0.0000006 | [model](https://openrouter.ai/meta-llama/llama-4-maverick) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-4-maverick-17b-128e-instruct/endpoints) |
| `meta-llama/llama-4-scout` | Meta: Llama 4 Scout | multimodal-chat | `text+image->text` | 10000000 | prompt=0.0000001<br>completion=0.0000003 | [model](https://openrouter.ai/meta-llama/llama-4-scout) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-4-scout-17b-16e-instruct/endpoints) |
| `meta-llama/llama-guard-3-8b` | Llama Guard 3 8B | chat | `text->text` | 131072 | prompt=0.000000484<br>completion=0.00000003 | [model](https://openrouter.ai/meta-llama/llama-guard-3-8b) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-guard-3-8b/endpoints) |
| `meta-llama/llama-guard-4-12b` | Meta: Llama Guard 4 12B | multimodal-chat | `text+image->text` | 163840 | prompt=0.00000018<br>completion=0.00000018 | [model](https://openrouter.ai/meta-llama/llama-guard-4-12b) / [endpoints](https://openrouter.ai/api/v1/models/meta-llama/llama-guard-4-12b/endpoints) |
### Provider: z-ai (13 models)

Type mix: chat: 10, multimodal-chat: 3.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `z-ai/glm-4-32b` | Z.ai: GLM 4 32B  | chat | `text->text` | 128000 | prompt=0.0000001<br>completion=0.0000001 | [model](https://openrouter.ai/z-ai/glm-4-32b) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4-32b-0414/endpoints) |
| `z-ai/glm-4.5` | Z.ai: GLM 4.5 | chat | `text->text` | 131072 | prompt=0.0000006<br>completion=0.0000022<br>input_cache_read=0.00000011 | [model](https://openrouter.ai/z-ai/glm-4.5) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4.5/endpoints) |
| `z-ai/glm-4.5-air` | Z.ai: GLM 4.5 Air | chat | `text->text` | 131072 | prompt=0.000000125<br>completion=0.00000085<br>input_cache_read=0.00000006 | [model](https://openrouter.ai/z-ai/glm-4.5-air) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4.5-air/endpoints) |
| `z-ai/glm-4.5-air:free` | Z.ai: GLM 4.5 Air (free) | chat | `text->text` | 131072 | prompt=0<br>completion=0 | [model](https://openrouter.ai/z-ai/glm-4.5-air:free) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4.5-air/endpoints) |
| `z-ai/glm-4.5v` | Z.ai: GLM 4.5V | multimodal-chat | `text+image->text` | 65536 | prompt=0.0000006<br>completion=0.0000018<br>input_cache_read=0.00000011 | [model](https://openrouter.ai/z-ai/glm-4.5v) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4.5v/endpoints) |
| `z-ai/glm-4.6` | Z.ai: GLM 4.6 | chat | `text->text` | 202752 | prompt=0.00000043<br>completion=0.00000174<br>input_cache_read=0.00000008 | [model](https://openrouter.ai/z-ai/glm-4.6) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4.6/endpoints) |
| `z-ai/glm-4.6v` | Z.ai: GLM 4.6V | multimodal-chat | `text+image+video->text` | 131072 | prompt=0.0000003<br>completion=0.0000009<br>input_cache_read=0.00000005 | [model](https://openrouter.ai/z-ai/glm-4.6v) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4.6-20251208/endpoints) |
| `z-ai/glm-4.7` | Z.ai: GLM 4.7 | chat | `text->text` | 202752 | prompt=0.0000004<br>completion=0.00000175<br>input_cache_read=0.00000008 | [model](https://openrouter.ai/z-ai/glm-4.7) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4.7-20251222/endpoints) |
| `z-ai/glm-4.7-flash` | Z.ai: GLM 4.7 Flash | chat | `text->text` | 202752 | prompt=0.00000006<br>completion=0.0000004<br>input_cache_read=0.00000001 | [model](https://openrouter.ai/z-ai/glm-4.7-flash) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-4.7-flash-20260119/endpoints) |
| `z-ai/glm-5` | Z.ai: GLM 5 | chat | `text->text` | 202752 | prompt=0.0000006<br>completion=0.00000192<br>input_cache_read=0.00000012 | [model](https://openrouter.ai/z-ai/glm-5) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-5-20260211/endpoints) |
| `z-ai/glm-5-turbo` | Z.ai: GLM 5 Turbo | chat | `text->text` | 202752 | prompt=0.0000012<br>completion=0.000004<br>input_cache_read=0.00000024 | [model](https://openrouter.ai/z-ai/glm-5-turbo) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-5-turbo-20260315/endpoints) |
| `z-ai/glm-5.1` | Z.ai: GLM 5.1 | chat | `text->text` | 202752 | prompt=0.00000098<br>completion=0.00000308<br>input_cache_read=0.000000182 | [model](https://openrouter.ai/z-ai/glm-5.1) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-5.1-20260406/endpoints) |
| `z-ai/glm-5v-turbo` | Z.ai: GLM 5V Turbo | multimodal-chat | `text+image+video->text` | 202752 | prompt=0.0000012<br>completion=0.000004<br>input_cache_read=0.00000024 | [model](https://openrouter.ai/z-ai/glm-5v-turbo) / [endpoints](https://openrouter.ai/api/v1/models/z-ai/glm-5v-turbo-20260401/endpoints) |
### Provider: deepseek (12 models)

Type mix: chat: 12.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `deepseek/deepseek-chat` | DeepSeek: DeepSeek V3 | chat | `text->text` | 131072 | prompt=0.0000002002<br>completion=0.0000008001 | [model](https://openrouter.ai/deepseek/deepseek-chat) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-chat-v3/endpoints) |
| `deepseek/deepseek-chat-v3-0324` | DeepSeek: DeepSeek V3 0324 | chat | `text->text` | 163840 | prompt=0.0000002<br>completion=0.00000077<br>input_cache_read=0.000000135 | [model](https://openrouter.ai/deepseek/deepseek-chat-v3-0324) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-chat-v3-0324/endpoints) |
| `deepseek/deepseek-chat-v3.1` | DeepSeek: DeepSeek V3.1 | chat | `text->text` | 163840 | prompt=0.00000021<br>completion=0.00000079<br>input_cache_read=0.00000013 | [model](https://openrouter.ai/deepseek/deepseek-chat-v3.1) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-chat-v3.1/endpoints) |
| `deepseek/deepseek-r1` | DeepSeek: R1 | chat | `text->text` | 163840 | prompt=0.0000007<br>completion=0.0000025 | [model](https://openrouter.ai/deepseek/deepseek-r1) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-r1/endpoints) |
| `deepseek/deepseek-r1-0528` | DeepSeek: R1 0528 | chat | `text->text` | 163840 | prompt=0.0000005<br>completion=0.00000215<br>input_cache_read=0.00000035 | [model](https://openrouter.ai/deepseek/deepseek-r1-0528) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-r1-0528/endpoints) |
| `deepseek/deepseek-r1-distill-llama-70b` | DeepSeek: R1 Distill Llama 70B | chat | `text->text` | 131072 | prompt=0.0000007<br>completion=0.0000008 | [model](https://openrouter.ai/deepseek/deepseek-r1-distill-llama-70b) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-r1-distill-llama-70b/endpoints) |
| `deepseek/deepseek-r1-distill-qwen-32b` | DeepSeek: R1 Distill Qwen 32B | chat | `text->text` | 128000 | prompt=0.00000029<br>completion=0.00000029 | [model](https://openrouter.ai/deepseek/deepseek-r1-distill-qwen-32b) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-r1-distill-qwen-32b/endpoints) |
| `deepseek/deepseek-v3.1-terminus` | DeepSeek: DeepSeek V3.1 Terminus | chat | `text->text` | 163840 | prompt=0.00000027<br>completion=0.00000095<br>input_cache_read=0.00000013 | [model](https://openrouter.ai/deepseek/deepseek-v3.1-terminus) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-v3.1-terminus/endpoints) |
| `deepseek/deepseek-v3.2` | DeepSeek: DeepSeek V3.2 | chat | `text->text` | 131072 | prompt=0.0000002288<br>completion=0.0000003432 | [model](https://openrouter.ai/deepseek/deepseek-v3.2) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-v3.2-20251201/endpoints) |
| `deepseek/deepseek-v3.2-exp` | DeepSeek: DeepSeek V3.2 Exp | chat | `text->text` | 163840 | prompt=0.00000027<br>completion=0.00000041 | [model](https://openrouter.ai/deepseek/deepseek-v3.2-exp) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-v3.2-exp/endpoints) |
| `deepseek/deepseek-v4-flash` | DeepSeek: DeepSeek V4 Flash | chat | `text->text` | 1048576 | prompt=0.0000000983<br>completion=0.0000001966<br>input_cache_read=0.0000000197 | [model](https://openrouter.ai/deepseek/deepseek-v4-flash) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4-flash-20260423/endpoints) |
| `deepseek/deepseek-v4-pro` | DeepSeek: DeepSeek V4 Pro | chat | `text->text` | 1048576 | prompt=0.000000435<br>completion=0.00000087<br>input_cache_read=0.000000003625 | [model](https://openrouter.ai/deepseek/deepseek-v4-pro) / [endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4-pro-20260423/endpoints) |
### Provider: nvidia (12 models)

Type mix: chat: 9, multimodal-chat: 2, speech-to-text-or-audio-understanding: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | NVIDIA: Llama 3.3 Nemotron Super 49B V1.5 | chat | `text->text` | 131072 | prompt=0.0000004<br>completion=0.0000004 | [model](https://openrouter.ai/nvidia/llama-3.3-nemotron-super-49b-v1.5) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/llama-3.3-nemotron-super-49b-v1.5/endpoints) |
| `nvidia/nemotron-3-nano-30b-a3b` | NVIDIA: Nemotron 3 Nano 30B A3B | chat | `text->text` | 262144 | prompt=0.00000005<br>completion=0.0000002 | [model](https://openrouter.ai/nvidia/nemotron-3-nano-30b-a3b) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-nano-30b-a3b/endpoints) |
| `nvidia/nemotron-3-nano-30b-a3b:free` | NVIDIA: Nemotron 3 Nano 30B A3B (free) | chat | `text->text` | 256000 | prompt=0<br>completion=0 | [model](https://openrouter.ai/nvidia/nemotron-3-nano-30b-a3b:free) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-nano-30b-a3b/endpoints) |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | NVIDIA: Nemotron 3 Nano Omni (free) | speech-to-text-or-audio-understanding | `text+image+audio+video->text` | 256000 | prompt=0<br>completion=0 | [model](https://openrouter.ai/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning-20260428/endpoints) |
| `nvidia/nemotron-3-super-120b-a12b` | NVIDIA: Nemotron 3 Super | chat | `text->text` | 1000000 | prompt=0.00000009<br>completion=0.00000045 | [model](https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-super-120b-a12b-20230311/endpoints) |
| `nvidia/nemotron-3-super-120b-a12b:free` | NVIDIA: Nemotron 3 Super (free) | chat | `text->text` | 1000000 | prompt=0<br>completion=0 | [model](https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b:free) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-super-120b-a12b-20230311/endpoints) |
| `nvidia/nemotron-3-ultra-550b-a55b` | NVIDIA: Nemotron 3 Ultra | chat | `text->text` | 1000000 | prompt=0.0000005<br>completion=0.0000025<br>input_cache_read=0.00000015 | [model](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-ultra-550b-a55b-20260604/endpoints) |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | NVIDIA: Nemotron 3 Ultra (free) | chat | `text->text` | 1000000 | prompt=0<br>completion=0 | [model](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3-ultra-550b-a55b-20260604/endpoints) |
| `nvidia/nemotron-3.5-content-safety:free` | NVIDIA: Nemotron 3.5 Content Safety (free) | multimodal-chat | `text+image->text` | 128000 | prompt=0<br>completion=0 | [model](https://openrouter.ai/nvidia/nemotron-3.5-content-safety:free) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-3.5-content-safety-20260604/endpoints) |
| `nvidia/nemotron-nano-12b-v2-vl:free` | NVIDIA: Nemotron Nano 12B 2 VL (free) | multimodal-chat | `text+image+video->text` | 128000 | prompt=0<br>completion=0 | [model](https://openrouter.ai/nvidia/nemotron-nano-12b-v2-vl:free) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-nano-12b-v2-vl/endpoints) |
| `nvidia/nemotron-nano-9b-v2` | NVIDIA: Nemotron Nano 9B V2 | chat | `text->text` | 131072 | prompt=0.00000004<br>completion=0.00000016 | [model](https://openrouter.ai/nvidia/nemotron-nano-9b-v2) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-nano-9b-v2/endpoints) |
| `nvidia/nemotron-nano-9b-v2:free` | NVIDIA: Nemotron Nano 9B V2 (free) | chat | `text->text` | 128000 | prompt=0<br>completion=0 | [model](https://openrouter.ai/nvidia/nemotron-nano-9b-v2:free) / [endpoints](https://openrouter.ai/api/v1/models/nvidia/nemotron-nano-9b-v2/endpoints) |
### Provider: minimax (8 models)

Type mix: chat: 6, multimodal-chat: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `minimax/minimax-01` | MiniMax: MiniMax-01 | multimodal-chat | `text+image->text` | 1000192 | prompt=0.0000002<br>completion=0.0000011 | [model](https://openrouter.ai/minimax/minimax-01) / [endpoints](https://openrouter.ai/api/v1/models/minimax/minimax-01/endpoints) |
| `minimax/minimax-m1` | MiniMax: MiniMax M1 | chat | `text->text` | 1000000 | prompt=0.0000004<br>completion=0.0000022 | [model](https://openrouter.ai/minimax/minimax-m1) / [endpoints](https://openrouter.ai/api/v1/models/minimax/minimax-m1/endpoints) |
| `minimax/minimax-m2` | MiniMax: MiniMax M2 | chat | `text->text` | 204800 | prompt=0.000000255<br>completion=0.000001<br>input_cache_read=0.00000003 | [model](https://openrouter.ai/minimax/minimax-m2) / [endpoints](https://openrouter.ai/api/v1/models/minimax/minimax-m2/endpoints) |
| `minimax/minimax-m2-her` | MiniMax: MiniMax M2-her | chat | `text->text` | 65536 | prompt=0.0000003<br>completion=0.0000012<br>input_cache_read=0.00000003 | [model](https://openrouter.ai/minimax/minimax-m2-her) / [endpoints](https://openrouter.ai/api/v1/models/minimax/minimax-m2-her-20260123/endpoints) |
| `minimax/minimax-m2.1` | MiniMax: MiniMax M2.1 | chat | `text->text` | 204800 | prompt=0.00000029<br>completion=0.00000095<br>input_cache_read=0.00000003 | [model](https://openrouter.ai/minimax/minimax-m2.1) / [endpoints](https://openrouter.ai/api/v1/models/minimax/minimax-m2.1/endpoints) |
| `minimax/minimax-m2.5` | MiniMax: MiniMax M2.5 | chat | `text->text` | 204800 | prompt=0.00000015<br>completion=0.00000115 | [model](https://openrouter.ai/minimax/minimax-m2.5) / [endpoints](https://openrouter.ai/api/v1/models/minimax/minimax-m2.5-20260211/endpoints) |
| `minimax/minimax-m2.7` | MiniMax: MiniMax M2.7 | chat | `text->text` | 204800 | prompt=0.000000279<br>completion=0.0000012 | [model](https://openrouter.ai/minimax/minimax-m2.7) / [endpoints](https://openrouter.ai/api/v1/models/minimax/minimax-m2.7-20260318/endpoints) |
| `minimax/minimax-m3` | MiniMax: MiniMax M3 | multimodal-chat | `text+image+video->text` | 1048576 | prompt=0.0000003<br>completion=0.0000012<br>input_cache_read=0.00000006 | [model](https://openrouter.ai/minimax/minimax-m3) / [endpoints](https://openrouter.ai/api/v1/models/minimax/minimax-m3-20260531/endpoints) |
### Provider: moonshotai (6 models)

Type mix: chat: 3, multimodal-chat: 3.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `moonshotai/kimi-k2` | MoonshotAI: Kimi K2 0711 | chat | `text->text` | 131072 | prompt=0.00000057<br>completion=0.0000023 | [model](https://openrouter.ai/moonshotai/kimi-k2) / [endpoints](https://openrouter.ai/api/v1/models/moonshotai/kimi-k2/endpoints) |
| `moonshotai/kimi-k2-0905` | MoonshotAI: Kimi K2 0905 | chat | `text->text` | 262144 | prompt=0.0000006<br>completion=0.0000025 | [model](https://openrouter.ai/moonshotai/kimi-k2-0905) / [endpoints](https://openrouter.ai/api/v1/models/moonshotai/kimi-k2-0905/endpoints) |
| `moonshotai/kimi-k2-thinking` | MoonshotAI: Kimi K2 Thinking | chat | `text->text` | 262144 | prompt=0.0000006<br>completion=0.0000025 | [model](https://openrouter.ai/moonshotai/kimi-k2-thinking) / [endpoints](https://openrouter.ai/api/v1/models/moonshotai/kimi-k2-thinking-20251106/endpoints) |
| `moonshotai/kimi-k2.5` | MoonshotAI: Kimi K2.5 | multimodal-chat | `text+image->text` | 262144 | prompt=0.0000004<br>completion=0.0000019<br>input_cache_read=0.00000009 | [model](https://openrouter.ai/moonshotai/kimi-k2.5) / [endpoints](https://openrouter.ai/api/v1/models/moonshotai/kimi-k2.5-0127/endpoints) |
| `moonshotai/kimi-k2.6` | MoonshotAI: Kimi K2.6 | multimodal-chat | `text+image->text` | 262144 | prompt=0.000000684<br>completion=0.00000342<br>input_cache_read=0.000000144 | [model](https://openrouter.ai/moonshotai/kimi-k2.6) / [endpoints](https://openrouter.ai/api/v1/models/moonshotai/kimi-k2.6-20260420/endpoints) |
| `moonshotai/kimi-k2.6:free` | MoonshotAI: Kimi K2.6 (free) | multimodal-chat | `text+image->text` | 262144 | prompt=0<br>completion=0 | [model](https://openrouter.ai/moonshotai/kimi-k2.6:free) / [endpoints](https://openrouter.ai/api/v1/models/moonshotai/kimi-k2.6-20260420/endpoints) |
### Provider: openrouter (6 models)

Type mix: chat: 4, image-generation: 1, multimodal-chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `openrouter/auto` | Auto Router | image-generation | `text+image+file+audio+video->text+image` | 2000000 | prompt=-1<br>completion=-1 | [model](https://openrouter.ai/openrouter/auto) / [endpoints](https://openrouter.ai/api/v1/models/openrouter/auto/endpoints) |
| `openrouter/bodybuilder` | Body Builder (beta) | chat | `text->text` | 128000 | prompt=-1<br>completion=-1 | [model](https://openrouter.ai/openrouter/bodybuilder) / [endpoints](https://openrouter.ai/api/v1/models/openrouter/bodybuilder/endpoints) |
| `openrouter/free` | Free Models Router | multimodal-chat | `text+image->text` | 200000 | prompt=0<br>completion=0 | [model](https://openrouter.ai/openrouter/free) / [endpoints](https://openrouter.ai/api/v1/models/openrouter/free/endpoints) |
| `openrouter/fusion` | OpenRouter: Fusion | chat | `text->text` | 128000 | prompt=-1<br>completion=-1 | [model](https://openrouter.ai/openrouter/fusion) / [endpoints](https://openrouter.ai/api/v1/models/openrouter/fusion/endpoints) |
| `openrouter/owl-alpha` | Owl Alpha | chat | `text->text` | 1048756 | prompt=0<br>completion=0 | [model](https://openrouter.ai/openrouter/owl-alpha) / [endpoints](https://openrouter.ai/api/v1/models/openrouter/owl-alpha/endpoints) |
| `openrouter/pareto-code` | Pareto Code Router | chat | `text->text` | 2000000 | prompt=-1<br>completion=-1 | [model](https://openrouter.ai/openrouter/pareto-code) / [endpoints](https://openrouter.ai/api/v1/models/openrouter/pareto-code/endpoints) |
### Provider: amazon (5 models)

Type mix: chat: 1, multimodal-chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `amazon/nova-2-lite-v1` | Amazon: Nova 2 Lite | multimodal-chat | `text+image+file+video->text` | 1000000 | prompt=0.0000003<br>completion=0.0000025 | [model](https://openrouter.ai/amazon/nova-2-lite-v1) / [endpoints](https://openrouter.ai/api/v1/models/amazon/nova-2-lite-v1/endpoints) |
| `amazon/nova-lite-v1` | Amazon: Nova Lite 1.0 | multimodal-chat | `text+image->text` | 300000 | prompt=0.00000006<br>completion=0.00000024 | [model](https://openrouter.ai/amazon/nova-lite-v1) / [endpoints](https://openrouter.ai/api/v1/models/amazon/nova-lite-v1/endpoints) |
| `amazon/nova-micro-v1` | Amazon: Nova Micro 1.0 | chat | `text->text` | 128000 | prompt=0.000000035<br>completion=0.00000014 | [model](https://openrouter.ai/amazon/nova-micro-v1) / [endpoints](https://openrouter.ai/api/v1/models/amazon/nova-micro-v1/endpoints) |
| `amazon/nova-premier-v1` | Amazon: Nova Premier 1.0 | multimodal-chat | `text+image->text` | 1000000 | prompt=0.0000025<br>completion=0.0000125<br>input_cache_read=0.000000625 | [model](https://openrouter.ai/amazon/nova-premier-v1) / [endpoints](https://openrouter.ai/api/v1/models/amazon/nova-premier-v1/endpoints) |
| `amazon/nova-pro-v1` | Amazon: Nova Pro 1.0 | multimodal-chat | `text+image->text` | 300000 | prompt=0.0000008<br>completion=0.0000032 | [model](https://openrouter.ai/amazon/nova-pro-v1) / [endpoints](https://openrouter.ai/api/v1/models/amazon/nova-pro-v1/endpoints) |
### Provider: arcee-ai (5 models)

Type mix: chat: 5.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `arcee-ai/coder-large` | Arcee AI: Coder Large | chat | `text->text` | 32768 | prompt=0.0000005<br>completion=0.0000008 | [model](https://openrouter.ai/arcee-ai/coder-large) / [endpoints](https://openrouter.ai/api/v1/models/arcee-ai/coder-large/endpoints) |
| `arcee-ai/maestro-reasoning` | Arcee AI: Maestro Reasoning | chat | `text->text` | 131072 | prompt=0.0000009<br>completion=0.0000033 | [model](https://openrouter.ai/arcee-ai/maestro-reasoning) / [endpoints](https://openrouter.ai/api/v1/models/arcee-ai/maestro-reasoning/endpoints) |
| `arcee-ai/trinity-large-thinking` | Arcee AI: Trinity Large Thinking | chat | `text->text` | 262144 | prompt=0.00000022<br>completion=0.00000085<br>input_cache_read=0.00000006 | [model](https://openrouter.ai/arcee-ai/trinity-large-thinking) / [endpoints](https://openrouter.ai/api/v1/models/arcee-ai/trinity-large-thinking/endpoints) |
| `arcee-ai/trinity-mini` | Arcee AI: Trinity Mini | chat | `text->text` | 131072 | prompt=0.000000045<br>completion=0.00000015 | [model](https://openrouter.ai/arcee-ai/trinity-mini) / [endpoints](https://openrouter.ai/api/v1/models/arcee-ai/trinity-mini-20251201/endpoints) |
| `arcee-ai/virtuoso-large` | Arcee AI: Virtuoso Large | chat | `text->text` | 131072 | prompt=0.00000075<br>completion=0.0000012 | [model](https://openrouter.ai/arcee-ai/virtuoso-large) / [endpoints](https://openrouter.ai/api/v1/models/arcee-ai/virtuoso-large/endpoints) |
### Provider: nousresearch (5 models)

Type mix: chat: 5.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `nousresearch/hermes-3-llama-3.1-405b` | Nous: Hermes 3 405B Instruct | chat | `text->text` | 131072 | prompt=0.000001<br>completion=0.000001 | [model](https://openrouter.ai/nousresearch/hermes-3-llama-3.1-405b) / [endpoints](https://openrouter.ai/api/v1/models/nousresearch/hermes-3-llama-3.1-405b/endpoints) |
| `nousresearch/hermes-3-llama-3.1-405b:free` | Nous: Hermes 3 405B Instruct (free) | chat | `text->text` | 131072 | prompt=0<br>completion=0 | [model](https://openrouter.ai/nousresearch/hermes-3-llama-3.1-405b:free) / [endpoints](https://openrouter.ai/api/v1/models/nousresearch/hermes-3-llama-3.1-405b/endpoints) |
| `nousresearch/hermes-3-llama-3.1-70b` | Nous: Hermes 3 70B Instruct | chat | `text->text` | 131072 | prompt=0.0000007<br>completion=0.0000007 | [model](https://openrouter.ai/nousresearch/hermes-3-llama-3.1-70b) / [endpoints](https://openrouter.ai/api/v1/models/nousresearch/hermes-3-llama-3.1-70b/endpoints) |
| `nousresearch/hermes-4-405b` | Nous: Hermes 4 405B | chat | `text->text` | 131072 | prompt=0.000001<br>completion=0.000003 | [model](https://openrouter.ai/nousresearch/hermes-4-405b) / [endpoints](https://openrouter.ai/api/v1/models/nousresearch/hermes-4-405b/endpoints) |
| `nousresearch/hermes-4-70b` | Nous: Hermes 4 70B | chat | `text->text` | 131072 | prompt=0.00000013<br>completion=0.0000004 | [model](https://openrouter.ai/nousresearch/hermes-4-70b) / [endpoints](https://openrouter.ai/api/v1/models/nousresearch/hermes-4-70b/endpoints) |
### Provider: perplexity (5 models)

Type mix: chat: 1, multimodal-chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `perplexity/sonar` | Perplexity: Sonar | multimodal-chat | `text+image->text` | 127072 | prompt=0.000001<br>completion=0.000001<br>web_search=0.005 | [model](https://openrouter.ai/perplexity/sonar) / [endpoints](https://openrouter.ai/api/v1/models/perplexity/sonar/endpoints) |
| `perplexity/sonar-deep-research` | Perplexity: Sonar Deep Research | chat | `text->text` | 128000 | prompt=0.000002<br>completion=0.000008<br>web_search=0.005 | [model](https://openrouter.ai/perplexity/sonar-deep-research) / [endpoints](https://openrouter.ai/api/v1/models/perplexity/sonar-deep-research/endpoints) |
| `perplexity/sonar-pro` | Perplexity: Sonar Pro | multimodal-chat | `text+image->text` | 200000 | prompt=0.000003<br>completion=0.000015<br>web_search=0.005 | [model](https://openrouter.ai/perplexity/sonar-pro) / [endpoints](https://openrouter.ai/api/v1/models/perplexity/sonar-pro/endpoints) |
| `perplexity/sonar-pro-search` | Perplexity: Sonar Pro Search | multimodal-chat | `text+image->text` | 200000 | prompt=0.000003<br>completion=0.000015<br>web_search=0.018 | [model](https://openrouter.ai/perplexity/sonar-pro-search) / [endpoints](https://openrouter.ai/api/v1/models/perplexity/sonar-pro-search/endpoints) |
| `perplexity/sonar-reasoning-pro` | Perplexity: Sonar Reasoning Pro | multimodal-chat | `text+image->text` | 128000 | prompt=0.000002<br>completion=0.000008<br>web_search=0.005 | [model](https://openrouter.ai/perplexity/sonar-reasoning-pro) / [endpoints](https://openrouter.ai/api/v1/models/perplexity/sonar-reasoning-pro/endpoints) |
### Provider: aion-labs (4 models)

Type mix: chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `aion-labs/aion-1.0` | AionLabs: Aion-1.0 | chat | `text->text` | 131072 | prompt=0.000004<br>completion=0.000008 | [model](https://openrouter.ai/aion-labs/aion-1.0) / [endpoints](https://openrouter.ai/api/v1/models/aion-labs/aion-1.0/endpoints) |
| `aion-labs/aion-1.0-mini` | AionLabs: Aion-1.0-Mini | chat | `text->text` | 131072 | prompt=0.0000007<br>completion=0.0000014 | [model](https://openrouter.ai/aion-labs/aion-1.0-mini) / [endpoints](https://openrouter.ai/api/v1/models/aion-labs/aion-1.0-mini/endpoints) |
| `aion-labs/aion-2.0` | AionLabs: Aion-2.0 | chat | `text->text` | 131072 | prompt=0.0000008<br>completion=0.0000016<br>input_cache_read=0.0000002 | [model](https://openrouter.ai/aion-labs/aion-2.0) / [endpoints](https://openrouter.ai/api/v1/models/aion-labs/aion-2.0-20260223/endpoints) |
| `aion-labs/aion-rp-llama-3.1-8b` | AionLabs: Aion-RP 1.0 (8B) | chat | `text->text` | 32768 | prompt=0.0000008<br>completion=0.0000016 | [model](https://openrouter.ai/aion-labs/aion-rp-llama-3.1-8b) / [endpoints](https://openrouter.ai/api/v1/models/aion-labs/aion-rp-llama-3.1-8b/endpoints) |
### Provider: bytedance-seed (4 models)

Type mix: multimodal-chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `bytedance-seed/seed-1.6` | ByteDance Seed: Seed 1.6 | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.00000025<br>completion=0.000002 | [model](https://openrouter.ai/bytedance-seed/seed-1.6) / [endpoints](https://openrouter.ai/api/v1/models/bytedance-seed/seed-1.6-20250625/endpoints) |
| `bytedance-seed/seed-1.6-flash` | ByteDance Seed: Seed 1.6 Flash | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.000000075<br>completion=0.0000003 | [model](https://openrouter.ai/bytedance-seed/seed-1.6-flash) / [endpoints](https://openrouter.ai/api/v1/models/bytedance-seed/seed-1.6-flash-20250625/endpoints) |
| `bytedance-seed/seed-2.0-lite` | ByteDance Seed: Seed-2.0-Lite | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.00000025<br>completion=0.000002 | [model](https://openrouter.ai/bytedance-seed/seed-2.0-lite) / [endpoints](https://openrouter.ai/api/v1/models/bytedance-seed/seed-2.0-lite-20260309/endpoints) |
| `bytedance-seed/seed-2.0-mini` | ByteDance Seed: Seed-2.0-Mini | multimodal-chat | `text+image+video->text` | 262144 | prompt=0.0000001<br>completion=0.0000004 | [model](https://openrouter.ai/bytedance-seed/seed-2.0-mini) / [endpoints](https://openrouter.ai/api/v1/models/bytedance-seed/seed-2.0-mini-20260224/endpoints) |
### Provider: cohere (4 models)

Type mix: chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `cohere/command-a` | Cohere: Command A | chat | `text->text` | 256000 | prompt=0.0000025<br>completion=0.00001 | [model](https://openrouter.ai/cohere/command-a) / [endpoints](https://openrouter.ai/api/v1/models/cohere/command-a-03-2025/endpoints) |
| `cohere/command-r-08-2024` | Cohere: Command R (08-2024) | chat | `text->text` | 128000 | prompt=0.00000015<br>completion=0.0000006 | [model](https://openrouter.ai/cohere/command-r-08-2024) / [endpoints](https://openrouter.ai/api/v1/models/cohere/command-r-08-2024/endpoints) |
| `cohere/command-r-plus-08-2024` | Cohere: Command R+ (08-2024) | chat | `text->text` | 128000 | prompt=0.0000025<br>completion=0.00001 | [model](https://openrouter.ai/cohere/command-r-plus-08-2024) / [endpoints](https://openrouter.ai/api/v1/models/cohere/command-r-plus-08-2024/endpoints) |
| `cohere/command-r7b-12-2024` | Cohere: Command R7B (12-2024) | chat | `text->text` | 128000 | prompt=0.0000000375<br>completion=0.00000015 | [model](https://openrouter.ai/cohere/command-r7b-12-2024) / [endpoints](https://openrouter.ai/api/v1/models/cohere/command-r7b-12-2024/endpoints) |
### Provider: sao10k (4 models)

Type mix: chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `sao10k/l3-lunaris-8b` | Sao10K: Llama 3 8B Lunaris | chat | `text->text` | 8192 | prompt=0.00000004<br>completion=0.00000005 | [model](https://openrouter.ai/sao10k/l3-lunaris-8b) / [endpoints](https://openrouter.ai/api/v1/models/sao10k/l3-lunaris-8b/endpoints) |
| `sao10k/l3.1-70b-hanami-x1` | Sao10K: Llama 3.1 70B Hanami x1 | chat | `text->text` | 16000 | prompt=0.000003<br>completion=0.000003 | [model](https://openrouter.ai/sao10k/l3.1-70b-hanami-x1) / [endpoints](https://openrouter.ai/api/v1/models/sao10k/l3.1-70b-hanami-x1/endpoints) |
| `sao10k/l3.1-euryale-70b` | Sao10K: Llama 3.1 Euryale 70B v2.2 | chat | `text->text` | 131072 | prompt=0.00000085<br>completion=0.00000085 | [model](https://openrouter.ai/sao10k/l3.1-euryale-70b) / [endpoints](https://openrouter.ai/api/v1/models/sao10k/l3.1-euryale-70b/endpoints) |
| `sao10k/l3.3-euryale-70b` | Sao10K: Llama 3.3 Euryale 70B | chat | `text->text` | 131072 | prompt=0.00000065<br>completion=0.00000075 | [model](https://openrouter.ai/sao10k/l3.3-euryale-70b) / [endpoints](https://openrouter.ai/api/v1/models/sao10k/l3.3-euryale-70b-v2.3/endpoints) |
### Provider: thedrummer (4 models)

Type mix: chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `thedrummer/cydonia-24b-v4.1` | TheDrummer: Cydonia 24B V4.1 | chat | `text->text` | 131072 | prompt=0.0000003<br>completion=0.0000005<br>input_cache_read=0.00000015 | [model](https://openrouter.ai/thedrummer/cydonia-24b-v4.1) / [endpoints](https://openrouter.ai/api/v1/models/thedrummer/cydonia-24b-v4.1/endpoints) |
| `thedrummer/rocinante-12b` | TheDrummer: Rocinante 12B | chat | `text->text` | 32768 | prompt=0.00000017<br>completion=0.00000043 | [model](https://openrouter.ai/thedrummer/rocinante-12b) / [endpoints](https://openrouter.ai/api/v1/models/thedrummer/rocinante-12b/endpoints) |
| `thedrummer/skyfall-36b-v2` | TheDrummer: Skyfall 36B V2 | chat | `text->text` | 32768 | prompt=0.00000055<br>completion=0.0000008<br>input_cache_read=0.00000025 | [model](https://openrouter.ai/thedrummer/skyfall-36b-v2) / [endpoints](https://openrouter.ai/api/v1/models/thedrummer/skyfall-36b-v2/endpoints) |
| `thedrummer/unslopnemo-12b` | TheDrummer: UnslopNemo 12B | chat | `text->text` | 32768 | prompt=0.0000004<br>completion=0.0000004 | [model](https://openrouter.ai/thedrummer/unslopnemo-12b) / [endpoints](https://openrouter.ai/api/v1/models/thedrummer/unslopnemo-12b/endpoints) |
### Provider: x-ai (4 models)

Type mix: multimodal-chat: 4.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `x-ai/grok-4.20` | xAI: Grok 4.20 | multimodal-chat | `text+image+file->text` | 2000000 | prompt=0.00000125<br>completion=0.0000025<br>web_search=0.005<br>input_cache_read=0.0000002 | [model](https://openrouter.ai/x-ai/grok-4.20) / [endpoints](https://openrouter.ai/api/v1/models/x-ai/grok-4.20-20260309/endpoints) |
| `x-ai/grok-4.20-multi-agent` | xAI: Grok 4.20 Multi-Agent | multimodal-chat | `text+image+file->text` | 2000000 | prompt=0.000002<br>completion=0.000006<br>web_search=0.005<br>input_cache_read=0.0000002 | [model](https://openrouter.ai/x-ai/grok-4.20-multi-agent) / [endpoints](https://openrouter.ai/api/v1/models/x-ai/grok-4.20-multi-agent-20260309/endpoints) |
| `x-ai/grok-4.3` | xAI: Grok 4.3 | multimodal-chat | `text+image->text` | 1000000 | prompt=0.00000125<br>completion=0.0000025<br>web_search=0.005<br>input_cache_read=0.0000002 | [model](https://openrouter.ai/x-ai/grok-4.3) / [endpoints](https://openrouter.ai/api/v1/models/x-ai/grok-4.3-20260430/endpoints) |
| `x-ai/grok-build-0.1` | xAI: Grok Build 0.1 | multimodal-chat | `text+image->text` | 256000 | prompt=0.000001<br>completion=0.000002<br>web_search=0.005<br>input_cache_read=0.0000002 | [model](https://openrouter.ai/x-ai/grok-build-0.1) / [endpoints](https://openrouter.ai/api/v1/models/x-ai/grok-build-0.1-20260520/endpoints) |
### Provider: inclusionai (3 models)

Type mix: chat: 3.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `inclusionai/ling-2.6-1t` | inclusionAI: Ling-2.6-1T | chat | `text->text` | 262144 | prompt=0.000000075<br>completion=0.000000625<br>input_cache_read=0.000000015 | [model](https://openrouter.ai/inclusionai/ling-2.6-1t) / [endpoints](https://openrouter.ai/api/v1/models/inclusionai/ling-2.6-1t-20260423/endpoints) |
| `inclusionai/ling-2.6-flash` | inclusionAI: Ling-2.6-flash | chat | `text->text` | 262144 | prompt=0.00000001<br>completion=0.00000003<br>input_cache_read=0.000000002 | [model](https://openrouter.ai/inclusionai/ling-2.6-flash) / [endpoints](https://openrouter.ai/api/v1/models/inclusionai/ling-2.6-flash-20260421/endpoints) |
| `inclusionai/ring-2.6-1t` | inclusionAI: Ring-2.6-1T | chat | `text->text` | 262144 | prompt=0.000000075<br>completion=0.000000625<br>input_cache_read=0.000000015 | [model](https://openrouter.ai/inclusionai/ring-2.6-1t) / [endpoints](https://openrouter.ai/api/v1/models/inclusionai/ring-2.6-1t-20260508/endpoints) |
### Provider: liquid (3 models)

Type mix: chat: 3.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `liquid/lfm-2-24b-a2b` | LiquidAI: LFM2-24B-A2B | chat | `text->text` | 128000 | prompt=0.00000003<br>completion=0.00000012 | [model](https://openrouter.ai/liquid/lfm-2-24b-a2b) / [endpoints](https://openrouter.ai/api/v1/models/liquid/lfm-2-24b-a2b-20260224/endpoints) |
| `liquid/lfm-2.5-1.2b-instruct:free` | LiquidAI: LFM2.5-1.2B-Instruct (free) | chat | `text->text` | 32768 | prompt=0<br>completion=0 | [model](https://openrouter.ai/liquid/lfm-2.5-1.2b-instruct:free) / [endpoints](https://openrouter.ai/api/v1/models/liquid/lfm-2.5-1.2b-instruct-20260120/endpoints) |
| `liquid/lfm-2.5-1.2b-thinking:free` | LiquidAI: LFM2.5-1.2B-Thinking (free) | chat | `text->text` | 32768 | prompt=0<br>completion=0 | [model](https://openrouter.ai/liquid/lfm-2.5-1.2b-thinking:free) / [endpoints](https://openrouter.ai/api/v1/models/liquid/lfm-2.5-1.2b-thinking-20260120/endpoints) |
### Provider: microsoft (3 models)

Type mix: chat: 3.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `microsoft/phi-4` | Microsoft: Phi 4 | chat | `text->text` | 16384 | prompt=0.000000065<br>completion=0.00000014 | [model](https://openrouter.ai/microsoft/phi-4) / [endpoints](https://openrouter.ai/api/v1/models/microsoft/phi-4/endpoints) |
| `microsoft/phi-4-mini-instruct` | Microsoft: Phi 4 Mini Instruct | chat | `text->text` | 131072 | prompt=0.00000008<br>completion=0.00000035<br>input_cache_read=0.00000008 | [model](https://openrouter.ai/microsoft/phi-4-mini-instruct) / [endpoints](https://openrouter.ai/api/v1/models/microsoft/phi-4-mini-instruct/endpoints) |
| `microsoft/wizardlm-2-8x22b` | WizardLM-2 8x22B | chat | `text->text` | 65536 | prompt=0.00000062<br>completion=0.00000062 | [model](https://openrouter.ai/microsoft/wizardlm-2-8x22b) / [endpoints](https://openrouter.ai/api/v1/models/microsoft/wizardlm-2-8x22b/endpoints) |
### Provider: xiaomi (3 models)

Type mix: chat: 2, speech-to-text-or-audio-understanding: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `xiaomi/mimo-v2-flash` | Xiaomi: MiMo-V2-Flash | chat | `text->text` | 262144 | prompt=0.0000001<br>completion=0.0000003<br>input_cache_read=0.00000001 | [model](https://openrouter.ai/xiaomi/mimo-v2-flash) / [endpoints](https://openrouter.ai/api/v1/models/xiaomi/mimo-v2-flash-20251210/endpoints) |
| `xiaomi/mimo-v2.5` | Xiaomi: MiMo-V2.5 | speech-to-text-or-audio-understanding | `text+image+audio+video->text` | 1048576 | prompt=0.00000014<br>completion=0.00000028<br>input_cache_read=0.0000000028 | [model](https://openrouter.ai/xiaomi/mimo-v2.5) / [endpoints](https://openrouter.ai/api/v1/models/xiaomi/mimo-v2.5-20260422/endpoints) |
| `xiaomi/mimo-v2.5-pro` | Xiaomi: MiMo-V2.5-Pro | chat | `text->text` | 1048576 | prompt=0.000000435<br>completion=0.00000087<br>input_cache_read=0.0000000036 | [model](https://openrouter.ai/xiaomi/mimo-v2.5-pro) / [endpoints](https://openrouter.ai/api/v1/models/xiaomi/mimo-v2.5-pro-20260422/endpoints) |
### Provider: ~anthropic (3 models)

Type mix: multimodal-chat: 3.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `~anthropic/claude-haiku-latest` | Anthropic Claude Haiku Latest | multimodal-chat | `text+image+file->text` | 200000 | prompt=0.000001<br>completion=0.000005<br>web_search=0.01<br>input_cache_read=0.0000001<br>input_cache_write=0.00000125 | [model](https://openrouter.ai/~anthropic/claude-haiku-latest) / [endpoints](https://openrouter.ai/api/v1/models/~anthropic/claude-haiku-latest/endpoints) |
| `~anthropic/claude-opus-latest` | Anthropic: Claude Opus Latest | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.000005<br>completion=0.000025<br>web_search=0.01<br>input_cache_read=0.0000005<br>input_cache_write=0.00000625 | [model](https://openrouter.ai/~anthropic/claude-opus-latest) / [endpoints](https://openrouter.ai/api/v1/models/~anthropic/claude-opus-latest/endpoints) |
| `~anthropic/claude-sonnet-latest` | Anthropic Claude Sonnet Latest | multimodal-chat | `text+image+file->text` | 1000000 | prompt=0.000003<br>completion=0.000015<br>web_search=0.01<br>input_cache_read=0.0000003<br>input_cache_write=0.00000375 | [model](https://openrouter.ai/~anthropic/claude-sonnet-latest) / [endpoints](https://openrouter.ai/api/v1/models/~anthropic/claude-sonnet-latest/endpoints) |
### Provider: ibm-granite (2 models)

Type mix: chat: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `ibm-granite/granite-4.0-h-micro` | IBM: Granite 4.0 Micro | chat | `text->text` | 131000 | prompt=0.000000017<br>completion=0.000000112 | [model](https://openrouter.ai/ibm-granite/granite-4.0-h-micro) / [endpoints](https://openrouter.ai/api/v1/models/ibm-granite/granite-4.0-h-micro/endpoints) |
| `ibm-granite/granite-4.1-8b` | IBM: Granite 4.1 8B | chat | `text->text` | 131072 | prompt=0.00000005<br>completion=0.0000001<br>input_cache_read=0.00000005 | [model](https://openrouter.ai/ibm-granite/granite-4.1-8b) / [endpoints](https://openrouter.ai/api/v1/models/ibm-granite/granite-4.1-8b-20260429/endpoints) |
### Provider: inflection (2 models)

Type mix: chat: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `inflection/inflection-3-pi` | Inflection: Inflection 3 Pi | chat | `text->text` | 8000 | prompt=0.0000025<br>completion=0.00001 | [model](https://openrouter.ai/inflection/inflection-3-pi) / [endpoints](https://openrouter.ai/api/v1/models/inflection/inflection-3-pi/endpoints) |
| `inflection/inflection-3-productivity` | Inflection: Inflection 3 Productivity | chat | `text->text` | 8000 | prompt=0.0000025<br>completion=0.00001 | [model](https://openrouter.ai/inflection/inflection-3-productivity) / [endpoints](https://openrouter.ai/api/v1/models/inflection/inflection-3-productivity/endpoints) |
### Provider: morph (2 models)

Type mix: chat: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `morph/morph-v3-fast` | Morph: Morph V3 Fast | chat | `text->text` | 81920 | prompt=0.0000008<br>completion=0.0000012 | [model](https://openrouter.ai/morph/morph-v3-fast) / [endpoints](https://openrouter.ai/api/v1/models/morph/morph-v3-fast/endpoints) |
| `morph/morph-v3-large` | Morph: Morph V3 Large | chat | `text->text` | 262144 | prompt=0.0000009<br>completion=0.0000019 | [model](https://openrouter.ai/morph/morph-v3-large) / [endpoints](https://openrouter.ai/api/v1/models/morph/morph-v3-large/endpoints) |
### Provider: poolside (2 models)

Type mix: chat: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `poolside/laguna-m.1:free` | Poolside: Laguna M.1 (free) | chat | `text->text` | 262144 | prompt=0<br>completion=0 | [model](https://openrouter.ai/poolside/laguna-m.1:free) / [endpoints](https://openrouter.ai/api/v1/models/poolside/laguna-m.1-20260312/endpoints) |
| `poolside/laguna-xs.2:free` | Poolside: Laguna XS.2 (free) | chat | `text->text` | 262144 | prompt=0<br>completion=0 | [model](https://openrouter.ai/poolside/laguna-xs.2:free) / [endpoints](https://openrouter.ai/api/v1/models/poolside/laguna-xs.2-20260421/endpoints) |
### Provider: rekaai (2 models)

Type mix: chat: 1, multimodal-chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `rekaai/reka-edge` | Reka Edge | multimodal-chat | `text+image+video->text` | 16384 | prompt=0.0000001<br>completion=0.0000001 | [model](https://openrouter.ai/rekaai/reka-edge) / [endpoints](https://openrouter.ai/api/v1/models/rekaai/reka-edge-2603/endpoints) |
| `rekaai/reka-flash-3` | Reka Flash 3 | chat | `text->text` | 65536 | prompt=0.0000001<br>completion=0.0000002 | [model](https://openrouter.ai/rekaai/reka-flash-3) / [endpoints](https://openrouter.ai/api/v1/models/rekaai/reka-flash-3/endpoints) |
### Provider: relace (2 models)

Type mix: chat: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `relace/relace-apply-3` | Relace: Relace Apply 3 | chat | `text->text` | 256000 | prompt=0.00000085<br>completion=0.00000125 | [model](https://openrouter.ai/relace/relace-apply-3) / [endpoints](https://openrouter.ai/api/v1/models/relace/relace-apply-3/endpoints) |
| `relace/relace-search` | Relace: Relace Search | chat | `text->text` | 256000 | prompt=0.000001<br>completion=0.000003 | [model](https://openrouter.ai/relace/relace-search) / [endpoints](https://openrouter.ai/api/v1/models/relace/relace-search-20251208/endpoints) |
### Provider: stepfun (2 models)

Type mix: chat: 1, multimodal-chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `stepfun/step-3.5-flash` | StepFun: Step 3.5 Flash | chat | `text->text` | 262144 | prompt=0.00000009<br>completion=0.0000003<br>input_cache_read=0.00000002 | [model](https://openrouter.ai/stepfun/step-3.5-flash) / [endpoints](https://openrouter.ai/api/v1/models/stepfun/step-3.5-flash/endpoints) |
| `stepfun/step-3.7-flash` | StepFun: Step 3.7 Flash | multimodal-chat | `text+image+video->text` | 256000 | prompt=0.0000002<br>completion=0.00000115<br>input_cache_read=0.00000004 | [model](https://openrouter.ai/stepfun/step-3.7-flash) / [endpoints](https://openrouter.ai/api/v1/models/stepfun/step-3.7-flash-20260528/endpoints) |
### Provider: tencent (2 models)

Type mix: chat: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `tencent/hunyuan-a13b-instruct` | Tencent: Hunyuan A13B Instruct | chat | `text->text` | 131072 | prompt=0.00000014<br>completion=0.00000057 | [model](https://openrouter.ai/tencent/hunyuan-a13b-instruct) / [endpoints](https://openrouter.ai/api/v1/models/tencent/hunyuan-a13b-instruct/endpoints) |
| `tencent/hy3-preview` | Tencent: Hy3 preview | chat | `text->text` | 262144 | prompt=0.000000063<br>completion=0.00000021<br>input_cache_read=0.000000021 | [model](https://openrouter.ai/tencent/hy3-preview) / [endpoints](https://openrouter.ai/api/v1/models/tencent/hy3-preview-20260421/endpoints) |
### Provider: ~google (2 models)

Type mix: speech-to-text-or-audio-understanding: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `~google/gemini-flash-latest` | Google Gemini Flash Latest | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.0000015<br>completion=0.000009<br>image=0.0000015<br>web_search=0.014<br>input_cache_read=0.00000015<br>input_cache_write=0.00000008333333333333334 | [model](https://openrouter.ai/~google/gemini-flash-latest) / [endpoints](https://openrouter.ai/api/v1/models/~google/gemini-flash-latest/endpoints) |
| `~google/gemini-pro-latest` | Google Gemini Pro Latest | speech-to-text-or-audio-understanding | `text+image+file+audio+video->text` | 1048576 | prompt=0.000002<br>completion=0.000012<br>image=0.000002<br>web_search=0.014<br>input_cache_read=0.0000002<br>input_cache_write=0.000000375 | [model](https://openrouter.ai/~google/gemini-pro-latest) / [endpoints](https://openrouter.ai/api/v1/models/~google/gemini-pro-latest/endpoints) |
### Provider: ~openai (2 models)

Type mix: multimodal-chat: 2.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `~openai/gpt-latest` | OpenAI GPT Latest | multimodal-chat | `text+image+file->text` | 1050000 | prompt=0.000005<br>completion=0.00003<br>web_search=0.01<br>input_cache_read=0.0000005 | [model](https://openrouter.ai/~openai/gpt-latest) / [endpoints](https://openrouter.ai/api/v1/models/~openai/gpt-latest/endpoints) |
| `~openai/gpt-mini-latest` | OpenAI GPT Mini Latest | multimodal-chat | `text+image+file->text` | 400000 | prompt=0.00000075<br>completion=0.0000045<br>web_search=0.01<br>input_cache_read=0.000000075 | [model](https://openrouter.ai/~openai/gpt-mini-latest) / [endpoints](https://openrouter.ai/api/v1/models/~openai/gpt-mini-latest/endpoints) |
### Provider: ai21 (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `ai21/jamba-large-1.7` | AI21: Jamba Large 1.7 | chat | `text->text` | 256000 | prompt=0.000002<br>completion=0.000008 | [model](https://openrouter.ai/ai21/jamba-large-1.7) / [endpoints](https://openrouter.ai/api/v1/models/ai21/jamba-large-1.7/endpoints) |
### Provider: allenai (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `allenai/olmo-3-32b-think` | AllenAI: Olmo 3 32B Think | chat | `text->text` | 65536 | prompt=0.00000015<br>completion=0.0000005 | [model](https://openrouter.ai/allenai/olmo-3-32b-think) / [endpoints](https://openrouter.ai/api/v1/models/allenai/olmo-3-32b-think-20251121/endpoints) |
### Provider: anthracite-org (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `anthracite-org/magnum-v4-72b` | Magnum v4 72B | chat | `text->text` | 32768 | prompt=0.000003<br>completion=0.000005 | [model](https://openrouter.ai/anthracite-org/magnum-v4-72b) / [endpoints](https://openrouter.ai/api/v1/models/anthracite-org/magnum-v4-72b/endpoints) |
### Provider: baidu (1 models)

Type mix: multimodal-chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `baidu/ernie-4.5-vl-424b-a47b` | Baidu: ERNIE 4.5 VL 424B A47B  | multimodal-chat | `text+image->text` | 131072 | prompt=0.00000042<br>completion=0.00000125 | [model](https://openrouter.ai/baidu/ernie-4.5-vl-424b-a47b) / [endpoints](https://openrouter.ai/api/v1/models/baidu/ernie-4.5-vl-424b-a47b/endpoints) |
### Provider: bytedance (1 models)

Type mix: multimodal-chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `bytedance/ui-tars-1.5-7b` | ByteDance: UI-TARS 7B  | multimodal-chat | `text+image->text` | 128000 | prompt=0.0000001<br>completion=0.0000002<br>input_cache_read=0.0000001 | [model](https://openrouter.ai/bytedance/ui-tars-1.5-7b) / [endpoints](https://openrouter.ai/api/v1/models/bytedance/ui-tars-1.5-7b/endpoints) |
### Provider: cognitivecomputations (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `cognitivecomputations/dolphin-mistral-24b-venice-edition:free` | Venice: Uncensored (free) | chat | `text->text` | 32768 | prompt=0<br>completion=0 | [model](https://openrouter.ai/cognitivecomputations/dolphin-mistral-24b-venice-edition:free) / [endpoints](https://openrouter.ai/api/v1/models/venice/uncensored/endpoints) |
### Provider: deepcogito (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `deepcogito/cogito-v2.1-671b` | Deep Cogito: Cogito v2.1 671B | chat | `text->text` | 128000 | prompt=0.00000125<br>completion=0.00000125 | [model](https://openrouter.ai/deepcogito/cogito-v2.1-671b) / [endpoints](https://openrouter.ai/api/v1/models/deepcogito/cogito-v2.1-671b-20251118/endpoints) |
### Provider: essentialai (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `essentialai/rnj-1-instruct` | EssentialAI: Rnj 1 Instruct | chat | `text->text` | 32768 | prompt=0.00000015<br>completion=0.00000015 | [model](https://openrouter.ai/essentialai/rnj-1-instruct) / [endpoints](https://openrouter.ai/api/v1/models/essentialai/rnj-1-instruct/endpoints) |
### Provider: gryphe (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `gryphe/mythomax-l2-13b` | MythoMax 13B | chat | `text->text` | 4096 | prompt=0.00000006<br>completion=0.00000006 | [model](https://openrouter.ai/gryphe/mythomax-l2-13b) / [endpoints](https://openrouter.ai/api/v1/models/gryphe/mythomax-l2-13b/endpoints) |
### Provider: inception (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `inception/mercury-2` | Inception: Mercury 2 | chat | `text->text` | 128000 | prompt=0.00000025<br>completion=0.00000075<br>input_cache_read=0.000000025 | [model](https://openrouter.ai/inception/mercury-2) / [endpoints](https://openrouter.ai/api/v1/models/inception/mercury-2-20260304/endpoints) |
### Provider: kwaipilot (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `kwaipilot/kat-coder-pro-v2` | Kwaipilot: KAT-Coder-Pro V2 | chat | `text->text` | 256000 | prompt=0.0000003<br>completion=0.0000012<br>input_cache_read=0.00000006 | [model](https://openrouter.ai/kwaipilot/kat-coder-pro-v2) / [endpoints](https://openrouter.ai/api/v1/models/kwaipilot/kat-coder-pro-v2-20260327/endpoints) |
### Provider: mancer (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `mancer/weaver` | Mancer: Weaver (alpha) | chat | `text->text` | 8000 | prompt=0.00000075<br>completion=0.000001 | [model](https://openrouter.ai/mancer/weaver) / [endpoints](https://openrouter.ai/api/v1/models/mancer/weaver/endpoints) |
### Provider: nex-agi (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `nex-agi/deepseek-v3.1-nex-n1` | Nex AGI: DeepSeek V3.1 Nex N1 | chat | `text->text` | 131072 | prompt=0.000000135<br>completion=0.0000005 | [model](https://openrouter.ai/nex-agi/deepseek-v3.1-nex-n1) / [endpoints](https://openrouter.ai/api/v1/models/nex-agi/deepseek-v3.1-nex-n1/endpoints) |
### Provider: perceptron (1 models)

Type mix: multimodal-chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `perceptron/perceptron-mk1` | Perceptron: Perceptron Mk1 | multimodal-chat | `text+image+video->text` | 32768 | prompt=0.00000015<br>completion=0.0000015 | [model](https://openrouter.ai/perceptron/perceptron-mk1) / [endpoints](https://openrouter.ai/api/v1/models/perceptron/perceptron-mk1-20260512/endpoints) |
### Provider: prime-intellect (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `prime-intellect/intellect-3` | Prime Intellect: INTELLECT-3 | chat | `text->text` | 131072 | prompt=0.0000002<br>completion=0.0000011 | [model](https://openrouter.ai/prime-intellect/intellect-3) / [endpoints](https://openrouter.ai/api/v1/models/prime-intellect/intellect-3-20251126/endpoints) |
### Provider: switchpoint (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `switchpoint/router` | Switchpoint Router | chat | `text->text` | 131072 | prompt=0.00000085<br>completion=0.0000034 | [model](https://openrouter.ai/switchpoint/router) / [endpoints](https://openrouter.ai/api/v1/models/switchpoint/router/endpoints) |
### Provider: undi95 (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `undi95/remm-slerp-l2-13b` | ReMM SLERP 13B | chat | `text->text` | 6144 | prompt=0.00000045<br>completion=0.00000065 | [model](https://openrouter.ai/undi95/remm-slerp-l2-13b) / [endpoints](https://openrouter.ai/api/v1/models/undi95/remm-slerp-l2-13b/endpoints) |
### Provider: upstage (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `upstage/solar-pro-3` | Upstage: Solar Pro 3 | chat | `text->text` | 128000 | prompt=0.00000015<br>completion=0.0000006<br>input_cache_read=0.000000015 | [model](https://openrouter.ai/upstage/solar-pro-3) / [endpoints](https://openrouter.ai/api/v1/models/upstage/solar-pro-3/endpoints) |
### Provider: writer (1 models)

Type mix: chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `writer/palmyra-x5` | Writer: Palmyra X5 | chat | `text->text` | 1040000 | prompt=0.0000006<br>completion=0.000006 | [model](https://openrouter.ai/writer/palmyra-x5) / [endpoints](https://openrouter.ai/api/v1/models/writer/palmyra-x5-20250428/endpoints) |
### Provider: ~moonshotai (1 models)

Type mix: multimodal-chat: 1.

| Model ID | Name | Category | Input → Output | Context | Pricing | Links |
| --- | --- | --- | --- | ---: | --- | --- |
| `~moonshotai/kimi-latest` | MoonshotAI Kimi Latest | multimodal-chat | `text+image->text` | 262144 | prompt=0.000000684<br>completion=0.00000342<br>input_cache_read=0.000000144 | [model](https://openrouter.ai/~moonshotai/kimi-latest) / [endpoints](https://openrouter.ai/api/v1/models/~moonshotai/kimi-latest/endpoints) |

## OpenRouter category views

### OpenRouter category: chat (168 models)

| Model ID | Provider | Name | Detail |
| --- | --- | --- | --- |
| `ai21/jamba-large-1.7` | ai21 | AI21: Jamba Large 1.7 | [link](https://openrouter.ai/ai21/jamba-large-1.7) |
| `aion-labs/aion-1.0` | aion-labs | AionLabs: Aion-1.0 | [link](https://openrouter.ai/aion-labs/aion-1.0) |
| `aion-labs/aion-1.0-mini` | aion-labs | AionLabs: Aion-1.0-Mini | [link](https://openrouter.ai/aion-labs/aion-1.0-mini) |
| `aion-labs/aion-2.0` | aion-labs | AionLabs: Aion-2.0 | [link](https://openrouter.ai/aion-labs/aion-2.0) |
| `aion-labs/aion-rp-llama-3.1-8b` | aion-labs | AionLabs: Aion-RP 1.0 (8B) | [link](https://openrouter.ai/aion-labs/aion-rp-llama-3.1-8b) |
| `allenai/olmo-3-32b-think` | allenai | AllenAI: Olmo 3 32B Think | [link](https://openrouter.ai/allenai/olmo-3-32b-think) |
| `amazon/nova-micro-v1` | amazon | Amazon: Nova Micro 1.0 | [link](https://openrouter.ai/amazon/nova-micro-v1) |
| `anthracite-org/magnum-v4-72b` | anthracite-org | Magnum v4 72B | [link](https://openrouter.ai/anthracite-org/magnum-v4-72b) |
| `arcee-ai/coder-large` | arcee-ai | Arcee AI: Coder Large | [link](https://openrouter.ai/arcee-ai/coder-large) |
| `arcee-ai/maestro-reasoning` | arcee-ai | Arcee AI: Maestro Reasoning | [link](https://openrouter.ai/arcee-ai/maestro-reasoning) |
| `arcee-ai/trinity-large-thinking` | arcee-ai | Arcee AI: Trinity Large Thinking | [link](https://openrouter.ai/arcee-ai/trinity-large-thinking) |
| `arcee-ai/trinity-mini` | arcee-ai | Arcee AI: Trinity Mini | [link](https://openrouter.ai/arcee-ai/trinity-mini) |
| `arcee-ai/virtuoso-large` | arcee-ai | Arcee AI: Virtuoso Large | [link](https://openrouter.ai/arcee-ai/virtuoso-large) |
| `cognitivecomputations/dolphin-mistral-24b-venice-edition:free` | cognitivecomputations | Venice: Uncensored (free) | [link](https://openrouter.ai/cognitivecomputations/dolphin-mistral-24b-venice-edition:free) |
| `cohere/command-a` | cohere | Cohere: Command A | [link](https://openrouter.ai/cohere/command-a) |
| `cohere/command-r-08-2024` | cohere | Cohere: Command R (08-2024) | [link](https://openrouter.ai/cohere/command-r-08-2024) |
| `cohere/command-r-plus-08-2024` | cohere | Cohere: Command R+ (08-2024) | [link](https://openrouter.ai/cohere/command-r-plus-08-2024) |
| `cohere/command-r7b-12-2024` | cohere | Cohere: Command R7B (12-2024) | [link](https://openrouter.ai/cohere/command-r7b-12-2024) |
| `deepcogito/cogito-v2.1-671b` | deepcogito | Deep Cogito: Cogito v2.1 671B | [link](https://openrouter.ai/deepcogito/cogito-v2.1-671b) |
| `deepseek/deepseek-chat` | deepseek | DeepSeek: DeepSeek V3 | [link](https://openrouter.ai/deepseek/deepseek-chat) |
| `deepseek/deepseek-chat-v3-0324` | deepseek | DeepSeek: DeepSeek V3 0324 | [link](https://openrouter.ai/deepseek/deepseek-chat-v3-0324) |
| `deepseek/deepseek-chat-v3.1` | deepseek | DeepSeek: DeepSeek V3.1 | [link](https://openrouter.ai/deepseek/deepseek-chat-v3.1) |
| `deepseek/deepseek-r1` | deepseek | DeepSeek: R1 | [link](https://openrouter.ai/deepseek/deepseek-r1) |
| `deepseek/deepseek-r1-0528` | deepseek | DeepSeek: R1 0528 | [link](https://openrouter.ai/deepseek/deepseek-r1-0528) |
| `deepseek/deepseek-r1-distill-llama-70b` | deepseek | DeepSeek: R1 Distill Llama 70B | [link](https://openrouter.ai/deepseek/deepseek-r1-distill-llama-70b) |
| `deepseek/deepseek-r1-distill-qwen-32b` | deepseek | DeepSeek: R1 Distill Qwen 32B | [link](https://openrouter.ai/deepseek/deepseek-r1-distill-qwen-32b) |
| `deepseek/deepseek-v3.1-terminus` | deepseek | DeepSeek: DeepSeek V3.1 Terminus | [link](https://openrouter.ai/deepseek/deepseek-v3.1-terminus) |
| `deepseek/deepseek-v3.2` | deepseek | DeepSeek: DeepSeek V3.2 | [link](https://openrouter.ai/deepseek/deepseek-v3.2) |
| `deepseek/deepseek-v3.2-exp` | deepseek | DeepSeek: DeepSeek V3.2 Exp | [link](https://openrouter.ai/deepseek/deepseek-v3.2-exp) |
| `deepseek/deepseek-v4-flash` | deepseek | DeepSeek: DeepSeek V4 Flash | [link](https://openrouter.ai/deepseek/deepseek-v4-flash) |
| `deepseek/deepseek-v4-pro` | deepseek | DeepSeek: DeepSeek V4 Pro | [link](https://openrouter.ai/deepseek/deepseek-v4-pro) |
| `essentialai/rnj-1-instruct` | essentialai | EssentialAI: Rnj 1 Instruct | [link](https://openrouter.ai/essentialai/rnj-1-instruct) |
| `google/gemma-2-27b-it` | google | Google: Gemma 2 27B | [link](https://openrouter.ai/google/gemma-2-27b-it) |
| `google/gemma-3n-e4b-it` | google | Google: Gemma 3n 4B | [link](https://openrouter.ai/google/gemma-3n-e4b-it) |
| `gryphe/mythomax-l2-13b` | gryphe | MythoMax 13B | [link](https://openrouter.ai/gryphe/mythomax-l2-13b) |
| `ibm-granite/granite-4.0-h-micro` | ibm-granite | IBM: Granite 4.0 Micro | [link](https://openrouter.ai/ibm-granite/granite-4.0-h-micro) |
| `ibm-granite/granite-4.1-8b` | ibm-granite | IBM: Granite 4.1 8B | [link](https://openrouter.ai/ibm-granite/granite-4.1-8b) |
| `inception/mercury-2` | inception | Inception: Mercury 2 | [link](https://openrouter.ai/inception/mercury-2) |
| `inclusionai/ling-2.6-1t` | inclusionai | inclusionAI: Ling-2.6-1T | [link](https://openrouter.ai/inclusionai/ling-2.6-1t) |
| `inclusionai/ling-2.6-flash` | inclusionai | inclusionAI: Ling-2.6-flash | [link](https://openrouter.ai/inclusionai/ling-2.6-flash) |
| `inclusionai/ring-2.6-1t` | inclusionai | inclusionAI: Ring-2.6-1T | [link](https://openrouter.ai/inclusionai/ring-2.6-1t) |
| `inflection/inflection-3-pi` | inflection | Inflection: Inflection 3 Pi | [link](https://openrouter.ai/inflection/inflection-3-pi) |
| `inflection/inflection-3-productivity` | inflection | Inflection: Inflection 3 Productivity | [link](https://openrouter.ai/inflection/inflection-3-productivity) |
| `kwaipilot/kat-coder-pro-v2` | kwaipilot | Kwaipilot: KAT-Coder-Pro V2 | [link](https://openrouter.ai/kwaipilot/kat-coder-pro-v2) |
| `liquid/lfm-2-24b-a2b` | liquid | LiquidAI: LFM2-24B-A2B | [link](https://openrouter.ai/liquid/lfm-2-24b-a2b) |
| `liquid/lfm-2.5-1.2b-instruct:free` | liquid | LiquidAI: LFM2.5-1.2B-Instruct (free) | [link](https://openrouter.ai/liquid/lfm-2.5-1.2b-instruct:free) |
| `liquid/lfm-2.5-1.2b-thinking:free` | liquid | LiquidAI: LFM2.5-1.2B-Thinking (free) | [link](https://openrouter.ai/liquid/lfm-2.5-1.2b-thinking:free) |
| `mancer/weaver` | mancer | Mancer: Weaver (alpha) | [link](https://openrouter.ai/mancer/weaver) |
| `meta-llama/llama-3-70b-instruct` | meta-llama | Meta: Llama 3 70B Instruct | [link](https://openrouter.ai/meta-llama/llama-3-70b-instruct) |
| `meta-llama/llama-3-8b-instruct` | meta-llama | Meta: Llama 3 8B Instruct | [link](https://openrouter.ai/meta-llama/llama-3-8b-instruct) |
| `meta-llama/llama-3.1-70b-instruct` | meta-llama | Meta: Llama 3.1 70B Instruct | [link](https://openrouter.ai/meta-llama/llama-3.1-70b-instruct) |
| `meta-llama/llama-3.1-8b-instruct` | meta-llama | Meta: Llama 3.1 8B Instruct | [link](https://openrouter.ai/meta-llama/llama-3.1-8b-instruct) |
| `meta-llama/llama-3.2-1b-instruct` | meta-llama | Meta: Llama 3.2 1B Instruct | [link](https://openrouter.ai/meta-llama/llama-3.2-1b-instruct) |
| `meta-llama/llama-3.2-3b-instruct` | meta-llama | Meta: Llama 3.2 3B Instruct | [link](https://openrouter.ai/meta-llama/llama-3.2-3b-instruct) |
| `meta-llama/llama-3.2-3b-instruct:free` | meta-llama | Meta: Llama 3.2 3B Instruct (free) | [link](https://openrouter.ai/meta-llama/llama-3.2-3b-instruct:free) |
| `meta-llama/llama-3.3-70b-instruct` | meta-llama | Meta: Llama 3.3 70B Instruct | [link](https://openrouter.ai/meta-llama/llama-3.3-70b-instruct) |
| `meta-llama/llama-3.3-70b-instruct:free` | meta-llama | Meta: Llama 3.3 70B Instruct (free) | [link](https://openrouter.ai/meta-llama/llama-3.3-70b-instruct:free) |
| `meta-llama/llama-guard-3-8b` | meta-llama | Llama Guard 3 8B | [link](https://openrouter.ai/meta-llama/llama-guard-3-8b) |
| `microsoft/phi-4` | microsoft | Microsoft: Phi 4 | [link](https://openrouter.ai/microsoft/phi-4) |
| `microsoft/phi-4-mini-instruct` | microsoft | Microsoft: Phi 4 Mini Instruct | [link](https://openrouter.ai/microsoft/phi-4-mini-instruct) |
| `microsoft/wizardlm-2-8x22b` | microsoft | WizardLM-2 8x22B | [link](https://openrouter.ai/microsoft/wizardlm-2-8x22b) |
| `minimax/minimax-m1` | minimax | MiniMax: MiniMax M1 | [link](https://openrouter.ai/minimax/minimax-m1) |
| `minimax/minimax-m2` | minimax | MiniMax: MiniMax M2 | [link](https://openrouter.ai/minimax/minimax-m2) |
| `minimax/minimax-m2-her` | minimax | MiniMax: MiniMax M2-her | [link](https://openrouter.ai/minimax/minimax-m2-her) |
| `minimax/minimax-m2.1` | minimax | MiniMax: MiniMax M2.1 | [link](https://openrouter.ai/minimax/minimax-m2.1) |
| `minimax/minimax-m2.5` | minimax | MiniMax: MiniMax M2.5 | [link](https://openrouter.ai/minimax/minimax-m2.5) |
| `minimax/minimax-m2.7` | minimax | MiniMax: MiniMax M2.7 | [link](https://openrouter.ai/minimax/minimax-m2.7) |
| `mistralai/mistral-nemo` | mistralai | Mistral: Mistral Nemo | [link](https://openrouter.ai/mistralai/mistral-nemo) |
| `mistralai/mistral-small-24b-instruct-2501` | mistralai | Mistral: Mistral Small 3 | [link](https://openrouter.ai/mistralai/mistral-small-24b-instruct-2501) |
| `moonshotai/kimi-k2` | moonshotai | MoonshotAI: Kimi K2 0711 | [link](https://openrouter.ai/moonshotai/kimi-k2) |
| `moonshotai/kimi-k2-0905` | moonshotai | MoonshotAI: Kimi K2 0905 | [link](https://openrouter.ai/moonshotai/kimi-k2-0905) |
| `moonshotai/kimi-k2-thinking` | moonshotai | MoonshotAI: Kimi K2 Thinking | [link](https://openrouter.ai/moonshotai/kimi-k2-thinking) |
| `morph/morph-v3-fast` | morph | Morph: Morph V3 Fast | [link](https://openrouter.ai/morph/morph-v3-fast) |
| `morph/morph-v3-large` | morph | Morph: Morph V3 Large | [link](https://openrouter.ai/morph/morph-v3-large) |
| `nex-agi/deepseek-v3.1-nex-n1` | nex-agi | Nex AGI: DeepSeek V3.1 Nex N1 | [link](https://openrouter.ai/nex-agi/deepseek-v3.1-nex-n1) |
| `nousresearch/hermes-3-llama-3.1-405b` | nousresearch | Nous: Hermes 3 405B Instruct | [link](https://openrouter.ai/nousresearch/hermes-3-llama-3.1-405b) |
| `nousresearch/hermes-3-llama-3.1-405b:free` | nousresearch | Nous: Hermes 3 405B Instruct (free) | [link](https://openrouter.ai/nousresearch/hermes-3-llama-3.1-405b:free) |
| `nousresearch/hermes-3-llama-3.1-70b` | nousresearch | Nous: Hermes 3 70B Instruct | [link](https://openrouter.ai/nousresearch/hermes-3-llama-3.1-70b) |
| `nousresearch/hermes-4-405b` | nousresearch | Nous: Hermes 4 405B | [link](https://openrouter.ai/nousresearch/hermes-4-405b) |
| `nousresearch/hermes-4-70b` | nousresearch | Nous: Hermes 4 70B | [link](https://openrouter.ai/nousresearch/hermes-4-70b) |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | nvidia | NVIDIA: Llama 3.3 Nemotron Super 49B V1.5 | [link](https://openrouter.ai/nvidia/llama-3.3-nemotron-super-49b-v1.5) |
| `nvidia/nemotron-3-nano-30b-a3b` | nvidia | NVIDIA: Nemotron 3 Nano 30B A3B | [link](https://openrouter.ai/nvidia/nemotron-3-nano-30b-a3b) |
| `nvidia/nemotron-3-nano-30b-a3b:free` | nvidia | NVIDIA: Nemotron 3 Nano 30B A3B (free) | [link](https://openrouter.ai/nvidia/nemotron-3-nano-30b-a3b:free) |
| `nvidia/nemotron-3-super-120b-a12b` | nvidia | NVIDIA: Nemotron 3 Super | [link](https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b) |
| `nvidia/nemotron-3-super-120b-a12b:free` | nvidia | NVIDIA: Nemotron 3 Super (free) | [link](https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b:free) |
| `nvidia/nemotron-3-ultra-550b-a55b` | nvidia | NVIDIA: Nemotron 3 Ultra | [link](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b) |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | nvidia | NVIDIA: Nemotron 3 Ultra (free) | [link](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free) |
| `nvidia/nemotron-nano-9b-v2` | nvidia | NVIDIA: Nemotron Nano 9B V2 | [link](https://openrouter.ai/nvidia/nemotron-nano-9b-v2) |
| `nvidia/nemotron-nano-9b-v2:free` | nvidia | NVIDIA: Nemotron Nano 9B V2 (free) | [link](https://openrouter.ai/nvidia/nemotron-nano-9b-v2:free) |
| `openai/gpt-3.5-turbo` | openai | OpenAI: GPT-3.5 Turbo | [link](https://openrouter.ai/openai/gpt-3.5-turbo) |
| `openai/gpt-3.5-turbo-0613` | openai | OpenAI: GPT-3.5 Turbo (older v0613) | [link](https://openrouter.ai/openai/gpt-3.5-turbo-0613) |
| `openai/gpt-3.5-turbo-16k` | openai | OpenAI: GPT-3.5 Turbo 16k | [link](https://openrouter.ai/openai/gpt-3.5-turbo-16k) |
| `openai/gpt-3.5-turbo-instruct` | openai | OpenAI: GPT-3.5 Turbo Instruct | [link](https://openrouter.ai/openai/gpt-3.5-turbo-instruct) |
| `openai/gpt-4` | openai | OpenAI: GPT-4 | [link](https://openrouter.ai/openai/gpt-4) |
| `openai/gpt-4-turbo-preview` | openai | OpenAI: GPT-4 Turbo Preview | [link](https://openrouter.ai/openai/gpt-4-turbo-preview) |
| `openai/gpt-4o-mini-search-preview` | openai | OpenAI: GPT-4o-mini Search Preview | [link](https://openrouter.ai/openai/gpt-4o-mini-search-preview) |
| `openai/gpt-4o-search-preview` | openai | OpenAI: GPT-4o Search Preview | [link](https://openrouter.ai/openai/gpt-4o-search-preview) |
| `openai/gpt-oss-120b` | openai | OpenAI: gpt-oss-120b | [link](https://openrouter.ai/openai/gpt-oss-120b) |
| `openai/gpt-oss-120b:free` | openai | OpenAI: gpt-oss-120b (free) | [link](https://openrouter.ai/openai/gpt-oss-120b:free) |
| `openai/gpt-oss-20b` | openai | OpenAI: gpt-oss-20b | [link](https://openrouter.ai/openai/gpt-oss-20b) |
| `openai/gpt-oss-20b:free` | openai | OpenAI: gpt-oss-20b (free) | [link](https://openrouter.ai/openai/gpt-oss-20b:free) |
| `openai/gpt-oss-safeguard-20b` | openai | OpenAI: gpt-oss-safeguard-20b | [link](https://openrouter.ai/openai/gpt-oss-safeguard-20b) |
| `openrouter/bodybuilder` | openrouter | Body Builder (beta) | [link](https://openrouter.ai/openrouter/bodybuilder) |
| `openrouter/fusion` | openrouter | OpenRouter: Fusion | [link](https://openrouter.ai/openrouter/fusion) |
| `openrouter/owl-alpha` | openrouter | Owl Alpha | [link](https://openrouter.ai/openrouter/owl-alpha) |
| `openrouter/pareto-code` | openrouter | Pareto Code Router | [link](https://openrouter.ai/openrouter/pareto-code) |
| `perplexity/sonar-deep-research` | perplexity | Perplexity: Sonar Deep Research | [link](https://openrouter.ai/perplexity/sonar-deep-research) |
| `poolside/laguna-m.1:free` | poolside | Poolside: Laguna M.1 (free) | [link](https://openrouter.ai/poolside/laguna-m.1:free) |
| `poolside/laguna-xs.2:free` | poolside | Poolside: Laguna XS.2 (free) | [link](https://openrouter.ai/poolside/laguna-xs.2:free) |
| `prime-intellect/intellect-3` | prime-intellect | Prime Intellect: INTELLECT-3 | [link](https://openrouter.ai/prime-intellect/intellect-3) |
| `qwen/qwen-2.5-72b-instruct` | qwen | Qwen2.5 72B Instruct | [link](https://openrouter.ai/qwen/qwen-2.5-72b-instruct) |
| `qwen/qwen-2.5-7b-instruct` | qwen | Qwen: Qwen2.5 7B Instruct | [link](https://openrouter.ai/qwen/qwen-2.5-7b-instruct) |
| `qwen/qwen-2.5-coder-32b-instruct` | qwen | Qwen2.5 Coder 32B Instruct | [link](https://openrouter.ai/qwen/qwen-2.5-coder-32b-instruct) |
| `qwen/qwen-plus` | qwen | Qwen: Qwen-Plus | [link](https://openrouter.ai/qwen/qwen-plus) |
| `qwen/qwen-plus-2025-07-28` | qwen | Qwen: Qwen Plus 0728 | [link](https://openrouter.ai/qwen/qwen-plus-2025-07-28) |
| `qwen/qwen-plus-2025-07-28:thinking` | qwen | Qwen: Qwen Plus 0728 (thinking) | [link](https://openrouter.ai/qwen/qwen-plus-2025-07-28:thinking) |
| `qwen/qwen3-14b` | qwen | Qwen: Qwen3 14B | [link](https://openrouter.ai/qwen/qwen3-14b) |
| `qwen/qwen3-235b-a22b` | qwen | Qwen: Qwen3 235B A22B | [link](https://openrouter.ai/qwen/qwen3-235b-a22b) |
| `qwen/qwen3-235b-a22b-2507` | qwen | Qwen: Qwen3 235B A22B Instruct 2507 | [link](https://openrouter.ai/qwen/qwen3-235b-a22b-2507) |
| `qwen/qwen3-235b-a22b-thinking-2507` | qwen | Qwen: Qwen3 235B A22B Thinking 2507 | [link](https://openrouter.ai/qwen/qwen3-235b-a22b-thinking-2507) |
| `qwen/qwen3-30b-a3b` | qwen | Qwen: Qwen3 30B A3B | [link](https://openrouter.ai/qwen/qwen3-30b-a3b) |
| `qwen/qwen3-30b-a3b-instruct-2507` | qwen | Qwen: Qwen3 30B A3B Instruct 2507 | [link](https://openrouter.ai/qwen/qwen3-30b-a3b-instruct-2507) |
| `qwen/qwen3-30b-a3b-thinking-2507` | qwen | Qwen: Qwen3 30B A3B Thinking 2507 | [link](https://openrouter.ai/qwen/qwen3-30b-a3b-thinking-2507) |
| `qwen/qwen3-32b` | qwen | Qwen: Qwen3 32B | [link](https://openrouter.ai/qwen/qwen3-32b) |
| `qwen/qwen3-8b` | qwen | Qwen: Qwen3 8B | [link](https://openrouter.ai/qwen/qwen3-8b) |
| `qwen/qwen3-coder` | qwen | Qwen: Qwen3 Coder 480B A35B | [link](https://openrouter.ai/qwen/qwen3-coder) |
| `qwen/qwen3-coder-30b-a3b-instruct` | qwen | Qwen: Qwen3 Coder 30B A3B Instruct | [link](https://openrouter.ai/qwen/qwen3-coder-30b-a3b-instruct) |
| `qwen/qwen3-coder-flash` | qwen | Qwen: Qwen3 Coder Flash | [link](https://openrouter.ai/qwen/qwen3-coder-flash) |
| `qwen/qwen3-coder-next` | qwen | Qwen: Qwen3 Coder Next | [link](https://openrouter.ai/qwen/qwen3-coder-next) |
| `qwen/qwen3-coder-plus` | qwen | Qwen: Qwen3 Coder Plus | [link](https://openrouter.ai/qwen/qwen3-coder-plus) |
| `qwen/qwen3-coder:free` | qwen | Qwen: Qwen3 Coder 480B A35B (free) | [link](https://openrouter.ai/qwen/qwen3-coder:free) |
| `qwen/qwen3-max` | qwen | Qwen: Qwen3 Max | [link](https://openrouter.ai/qwen/qwen3-max) |
| `qwen/qwen3-max-thinking` | qwen | Qwen: Qwen3 Max Thinking | [link](https://openrouter.ai/qwen/qwen3-max-thinking) |
| `qwen/qwen3-next-80b-a3b-instruct` | qwen | Qwen: Qwen3 Next 80B A3B Instruct | [link](https://openrouter.ai/qwen/qwen3-next-80b-a3b-instruct) |
| `qwen/qwen3-next-80b-a3b-instruct:free` | qwen | Qwen: Qwen3 Next 80B A3B Instruct (free) | [link](https://openrouter.ai/qwen/qwen3-next-80b-a3b-instruct:free) |
| `qwen/qwen3-next-80b-a3b-thinking` | qwen | Qwen: Qwen3 Next 80B A3B Thinking | [link](https://openrouter.ai/qwen/qwen3-next-80b-a3b-thinking) |
| `qwen/qwen3.6-max-preview` | qwen | Qwen: Qwen3.6 Max Preview | [link](https://openrouter.ai/qwen/qwen3.6-max-preview) |
| `qwen/qwen3.7-max` | qwen | Qwen: Qwen3.7 Max | [link](https://openrouter.ai/qwen/qwen3.7-max) |
| `rekaai/reka-flash-3` | rekaai | Reka Flash 3 | [link](https://openrouter.ai/rekaai/reka-flash-3) |
| `relace/relace-apply-3` | relace | Relace: Relace Apply 3 | [link](https://openrouter.ai/relace/relace-apply-3) |
| `relace/relace-search` | relace | Relace: Relace Search | [link](https://openrouter.ai/relace/relace-search) |
| `sao10k/l3-lunaris-8b` | sao10k | Sao10K: Llama 3 8B Lunaris | [link](https://openrouter.ai/sao10k/l3-lunaris-8b) |
| `sao10k/l3.1-70b-hanami-x1` | sao10k | Sao10K: Llama 3.1 70B Hanami x1 | [link](https://openrouter.ai/sao10k/l3.1-70b-hanami-x1) |
| `sao10k/l3.1-euryale-70b` | sao10k | Sao10K: Llama 3.1 Euryale 70B v2.2 | [link](https://openrouter.ai/sao10k/l3.1-euryale-70b) |
| `sao10k/l3.3-euryale-70b` | sao10k | Sao10K: Llama 3.3 Euryale 70B | [link](https://openrouter.ai/sao10k/l3.3-euryale-70b) |
| `stepfun/step-3.5-flash` | stepfun | StepFun: Step 3.5 Flash | [link](https://openrouter.ai/stepfun/step-3.5-flash) |
| `switchpoint/router` | switchpoint | Switchpoint Router | [link](https://openrouter.ai/switchpoint/router) |
| `tencent/hunyuan-a13b-instruct` | tencent | Tencent: Hunyuan A13B Instruct | [link](https://openrouter.ai/tencent/hunyuan-a13b-instruct) |
| `tencent/hy3-preview` | tencent | Tencent: Hy3 preview | [link](https://openrouter.ai/tencent/hy3-preview) |
| `thedrummer/cydonia-24b-v4.1` | thedrummer | TheDrummer: Cydonia 24B V4.1 | [link](https://openrouter.ai/thedrummer/cydonia-24b-v4.1) |
| `thedrummer/rocinante-12b` | thedrummer | TheDrummer: Rocinante 12B | [link](https://openrouter.ai/thedrummer/rocinante-12b) |
| `thedrummer/skyfall-36b-v2` | thedrummer | TheDrummer: Skyfall 36B V2 | [link](https://openrouter.ai/thedrummer/skyfall-36b-v2) |
| `thedrummer/unslopnemo-12b` | thedrummer | TheDrummer: UnslopNemo 12B | [link](https://openrouter.ai/thedrummer/unslopnemo-12b) |
| `undi95/remm-slerp-l2-13b` | undi95 | ReMM SLERP 13B | [link](https://openrouter.ai/undi95/remm-slerp-l2-13b) |
| `upstage/solar-pro-3` | upstage | Upstage: Solar Pro 3 | [link](https://openrouter.ai/upstage/solar-pro-3) |
| `writer/palmyra-x5` | writer | Writer: Palmyra X5 | [link](https://openrouter.ai/writer/palmyra-x5) |
| `xiaomi/mimo-v2-flash` | xiaomi | Xiaomi: MiMo-V2-Flash | [link](https://openrouter.ai/xiaomi/mimo-v2-flash) |
| `xiaomi/mimo-v2.5-pro` | xiaomi | Xiaomi: MiMo-V2.5-Pro | [link](https://openrouter.ai/xiaomi/mimo-v2.5-pro) |
| `z-ai/glm-4-32b` | z-ai | Z.ai: GLM 4 32B  | [link](https://openrouter.ai/z-ai/glm-4-32b) |
| `z-ai/glm-4.5` | z-ai | Z.ai: GLM 4.5 | [link](https://openrouter.ai/z-ai/glm-4.5) |
| `z-ai/glm-4.5-air` | z-ai | Z.ai: GLM 4.5 Air | [link](https://openrouter.ai/z-ai/glm-4.5-air) |
| `z-ai/glm-4.5-air:free` | z-ai | Z.ai: GLM 4.5 Air (free) | [link](https://openrouter.ai/z-ai/glm-4.5-air:free) |
| `z-ai/glm-4.6` | z-ai | Z.ai: GLM 4.6 | [link](https://openrouter.ai/z-ai/glm-4.6) |
| `z-ai/glm-4.7` | z-ai | Z.ai: GLM 4.7 | [link](https://openrouter.ai/z-ai/glm-4.7) |
| `z-ai/glm-4.7-flash` | z-ai | Z.ai: GLM 4.7 Flash | [link](https://openrouter.ai/z-ai/glm-4.7-flash) |
| `z-ai/glm-5` | z-ai | Z.ai: GLM 5 | [link](https://openrouter.ai/z-ai/glm-5) |
| `z-ai/glm-5-turbo` | z-ai | Z.ai: GLM 5 Turbo | [link](https://openrouter.ai/z-ai/glm-5-turbo) |
| `z-ai/glm-5.1` | z-ai | Z.ai: GLM 5.1 | [link](https://openrouter.ai/z-ai/glm-5.1) |
### OpenRouter category: multimodal-chat (145 models)

| Model ID | Provider | Name | Detail |
| --- | --- | --- | --- |
| `amazon/nova-2-lite-v1` | amazon | Amazon: Nova 2 Lite | [link](https://openrouter.ai/amazon/nova-2-lite-v1) |
| `amazon/nova-lite-v1` | amazon | Amazon: Nova Lite 1.0 | [link](https://openrouter.ai/amazon/nova-lite-v1) |
| `amazon/nova-premier-v1` | amazon | Amazon: Nova Premier 1.0 | [link](https://openrouter.ai/amazon/nova-premier-v1) |
| `amazon/nova-pro-v1` | amazon | Amazon: Nova Pro 1.0 | [link](https://openrouter.ai/amazon/nova-pro-v1) |
| `anthropic/claude-3-haiku` | anthropic | Anthropic: Claude 3 Haiku | [link](https://openrouter.ai/anthropic/claude-3-haiku) |
| `anthropic/claude-3.5-haiku` | anthropic | Anthropic: Claude 3.5 Haiku | [link](https://openrouter.ai/anthropic/claude-3.5-haiku) |
| `anthropic/claude-haiku-4.5` | anthropic | Anthropic: Claude Haiku 4.5 | [link](https://openrouter.ai/anthropic/claude-haiku-4.5) |
| `anthropic/claude-opus-4` | anthropic | Anthropic: Claude Opus 4 | [link](https://openrouter.ai/anthropic/claude-opus-4) |
| `anthropic/claude-opus-4.1` | anthropic | Anthropic: Claude Opus 4.1 | [link](https://openrouter.ai/anthropic/claude-opus-4.1) |
| `anthropic/claude-opus-4.5` | anthropic | Anthropic: Claude Opus 4.5 | [link](https://openrouter.ai/anthropic/claude-opus-4.5) |
| `anthropic/claude-opus-4.6` | anthropic | Anthropic: Claude Opus 4.6 | [link](https://openrouter.ai/anthropic/claude-opus-4.6) |
| `anthropic/claude-opus-4.6-fast` | anthropic | Anthropic: Claude Opus 4.6 (Fast) | [link](https://openrouter.ai/anthropic/claude-opus-4.6-fast) |
| `anthropic/claude-opus-4.7` | anthropic | Anthropic: Claude Opus 4.7 | [link](https://openrouter.ai/anthropic/claude-opus-4.7) |
| `anthropic/claude-opus-4.7-fast` | anthropic | Anthropic: Claude Opus 4.7 (Fast) | [link](https://openrouter.ai/anthropic/claude-opus-4.7-fast) |
| `anthropic/claude-opus-4.8` | anthropic | Anthropic: Claude Opus 4.8 | [link](https://openrouter.ai/anthropic/claude-opus-4.8) |
| `anthropic/claude-opus-4.8-fast` | anthropic | Anthropic: Claude Opus 4.8 (Fast) | [link](https://openrouter.ai/anthropic/claude-opus-4.8-fast) |
| `anthropic/claude-sonnet-4` | anthropic | Anthropic: Claude Sonnet 4 | [link](https://openrouter.ai/anthropic/claude-sonnet-4) |
| `anthropic/claude-sonnet-4.5` | anthropic | Anthropic: Claude Sonnet 4.5 | [link](https://openrouter.ai/anthropic/claude-sonnet-4.5) |
| `anthropic/claude-sonnet-4.6` | anthropic | Anthropic: Claude Sonnet 4.6 | [link](https://openrouter.ai/anthropic/claude-sonnet-4.6) |
| `baidu/ernie-4.5-vl-424b-a47b` | baidu | Baidu: ERNIE 4.5 VL 424B A47B  | [link](https://openrouter.ai/baidu/ernie-4.5-vl-424b-a47b) |
| `bytedance-seed/seed-1.6` | bytedance-seed | ByteDance Seed: Seed 1.6 | [link](https://openrouter.ai/bytedance-seed/seed-1.6) |
| `bytedance-seed/seed-1.6-flash` | bytedance-seed | ByteDance Seed: Seed 1.6 Flash | [link](https://openrouter.ai/bytedance-seed/seed-1.6-flash) |
| `bytedance-seed/seed-2.0-lite` | bytedance-seed | ByteDance Seed: Seed-2.0-Lite | [link](https://openrouter.ai/bytedance-seed/seed-2.0-lite) |
| `bytedance-seed/seed-2.0-mini` | bytedance-seed | ByteDance Seed: Seed-2.0-Mini | [link](https://openrouter.ai/bytedance-seed/seed-2.0-mini) |
| `bytedance/ui-tars-1.5-7b` | bytedance | ByteDance: UI-TARS 7B  | [link](https://openrouter.ai/bytedance/ui-tars-1.5-7b) |
| `google/gemma-3-12b-it` | google | Google: Gemma 3 12B | [link](https://openrouter.ai/google/gemma-3-12b-it) |
| `google/gemma-3-27b-it` | google | Google: Gemma 3 27B | [link](https://openrouter.ai/google/gemma-3-27b-it) |
| `google/gemma-3-4b-it` | google | Google: Gemma 3 4B | [link](https://openrouter.ai/google/gemma-3-4b-it) |
| `google/gemma-4-26b-a4b-it` | google | Google: Gemma 4 26B A4B  | [link](https://openrouter.ai/google/gemma-4-26b-a4b-it) |
| `google/gemma-4-26b-a4b-it:free` | google | Google: Gemma 4 26B A4B  (free) | [link](https://openrouter.ai/google/gemma-4-26b-a4b-it:free) |
| `google/gemma-4-31b-it` | google | Google: Gemma 4 31B | [link](https://openrouter.ai/google/gemma-4-31b-it) |
| `google/gemma-4-31b-it:free` | google | Google: Gemma 4 31B (free) | [link](https://openrouter.ai/google/gemma-4-31b-it:free) |
| `meta-llama/llama-3.2-11b-vision-instruct` | meta-llama | Meta: Llama 3.2 11B Vision Instruct | [link](https://openrouter.ai/meta-llama/llama-3.2-11b-vision-instruct) |
| `meta-llama/llama-4-maverick` | meta-llama | Meta: Llama 4 Maverick | [link](https://openrouter.ai/meta-llama/llama-4-maverick) |
| `meta-llama/llama-4-scout` | meta-llama | Meta: Llama 4 Scout | [link](https://openrouter.ai/meta-llama/llama-4-scout) |
| `meta-llama/llama-guard-4-12b` | meta-llama | Meta: Llama Guard 4 12B | [link](https://openrouter.ai/meta-llama/llama-guard-4-12b) |
| `minimax/minimax-01` | minimax | MiniMax: MiniMax-01 | [link](https://openrouter.ai/minimax/minimax-01) |
| `minimax/minimax-m3` | minimax | MiniMax: MiniMax M3 | [link](https://openrouter.ai/minimax/minimax-m3) |
| `mistralai/codestral-2508` | mistralai | Mistral: Codestral 2508 | [link](https://openrouter.ai/mistralai/codestral-2508) |
| `mistralai/devstral-2512` | mistralai | Mistral: Devstral 2 2512 | [link](https://openrouter.ai/mistralai/devstral-2512) |
| `mistralai/ministral-14b-2512` | mistralai | Mistral: Ministral 3 14B 2512 | [link](https://openrouter.ai/mistralai/ministral-14b-2512) |
| `mistralai/ministral-3b-2512` | mistralai | Mistral: Ministral 3 3B 2512 | [link](https://openrouter.ai/mistralai/ministral-3b-2512) |
| `mistralai/ministral-8b-2512` | mistralai | Mistral: Ministral 3 8B 2512 | [link](https://openrouter.ai/mistralai/ministral-8b-2512) |
| `mistralai/mistral-large` | mistralai | Mistral Large | [link](https://openrouter.ai/mistralai/mistral-large) |
| `mistralai/mistral-large-2407` | mistralai | Mistral Large 2407 | [link](https://openrouter.ai/mistralai/mistral-large-2407) |
| `mistralai/mistral-large-2512` | mistralai | Mistral: Mistral Large 3 2512 | [link](https://openrouter.ai/mistralai/mistral-large-2512) |
| `mistralai/mistral-medium-3` | mistralai | Mistral: Mistral Medium 3 | [link](https://openrouter.ai/mistralai/mistral-medium-3) |
| `mistralai/mistral-medium-3-5` | mistralai | Mistral: Mistral Medium 3.5 | [link](https://openrouter.ai/mistralai/mistral-medium-3-5) |
| `mistralai/mistral-medium-3.1` | mistralai | Mistral: Mistral Medium 3.1 | [link](https://openrouter.ai/mistralai/mistral-medium-3.1) |
| `mistralai/mistral-saba` | mistralai | Mistral: Saba | [link](https://openrouter.ai/mistralai/mistral-saba) |
| `mistralai/mistral-small-2603` | mistralai | Mistral: Mistral Small 4 | [link](https://openrouter.ai/mistralai/mistral-small-2603) |
| `mistralai/mistral-small-3.1-24b-instruct` | mistralai | Mistral: Mistral Small 3.1 24B | [link](https://openrouter.ai/mistralai/mistral-small-3.1-24b-instruct) |
| `mistralai/mistral-small-3.2-24b-instruct` | mistralai | Mistral: Mistral Small 3.2 24B | [link](https://openrouter.ai/mistralai/mistral-small-3.2-24b-instruct) |
| `mistralai/mixtral-8x22b-instruct` | mistralai | Mistral: Mixtral 8x22B Instruct | [link](https://openrouter.ai/mistralai/mixtral-8x22b-instruct) |
| `moonshotai/kimi-k2.5` | moonshotai | MoonshotAI: Kimi K2.5 | [link](https://openrouter.ai/moonshotai/kimi-k2.5) |
| `moonshotai/kimi-k2.6` | moonshotai | MoonshotAI: Kimi K2.6 | [link](https://openrouter.ai/moonshotai/kimi-k2.6) |
| `moonshotai/kimi-k2.6:free` | moonshotai | MoonshotAI: Kimi K2.6 (free) | [link](https://openrouter.ai/moonshotai/kimi-k2.6:free) |
| `nvidia/nemotron-3.5-content-safety:free` | nvidia | NVIDIA: Nemotron 3.5 Content Safety (free) | [link](https://openrouter.ai/nvidia/nemotron-3.5-content-safety:free) |
| `nvidia/nemotron-nano-12b-v2-vl:free` | nvidia | NVIDIA: Nemotron Nano 12B 2 VL (free) | [link](https://openrouter.ai/nvidia/nemotron-nano-12b-v2-vl:free) |
| `openai/gpt-4-turbo` | openai | OpenAI: GPT-4 Turbo | [link](https://openrouter.ai/openai/gpt-4-turbo) |
| `openai/gpt-4.1` | openai | OpenAI: GPT-4.1 | [link](https://openrouter.ai/openai/gpt-4.1) |
| `openai/gpt-4.1-mini` | openai | OpenAI: GPT-4.1 Mini | [link](https://openrouter.ai/openai/gpt-4.1-mini) |
| `openai/gpt-4.1-nano` | openai | OpenAI: GPT-4.1 Nano | [link](https://openrouter.ai/openai/gpt-4.1-nano) |
| `openai/gpt-4o` | openai | OpenAI: GPT-4o | [link](https://openrouter.ai/openai/gpt-4o) |
| `openai/gpt-4o-2024-05-13` | openai | OpenAI: GPT-4o (2024-05-13) | [link](https://openrouter.ai/openai/gpt-4o-2024-05-13) |
| `openai/gpt-4o-2024-08-06` | openai | OpenAI: GPT-4o (2024-08-06) | [link](https://openrouter.ai/openai/gpt-4o-2024-08-06) |
| `openai/gpt-4o-2024-11-20` | openai | OpenAI: GPT-4o (2024-11-20) | [link](https://openrouter.ai/openai/gpt-4o-2024-11-20) |
| `openai/gpt-4o-mini` | openai | OpenAI: GPT-4o-mini | [link](https://openrouter.ai/openai/gpt-4o-mini) |
| `openai/gpt-4o-mini-2024-07-18` | openai | OpenAI: GPT-4o-mini (2024-07-18) | [link](https://openrouter.ai/openai/gpt-4o-mini-2024-07-18) |
| `openai/gpt-5` | openai | OpenAI: GPT-5 | [link](https://openrouter.ai/openai/gpt-5) |
| `openai/gpt-5-chat` | openai | OpenAI: GPT-5 Chat | [link](https://openrouter.ai/openai/gpt-5-chat) |
| `openai/gpt-5-codex` | openai | OpenAI: GPT-5 Codex | [link](https://openrouter.ai/openai/gpt-5-codex) |
| `openai/gpt-5-mini` | openai | OpenAI: GPT-5 Mini | [link](https://openrouter.ai/openai/gpt-5-mini) |
| `openai/gpt-5-nano` | openai | OpenAI: GPT-5 Nano | [link](https://openrouter.ai/openai/gpt-5-nano) |
| `openai/gpt-5-pro` | openai | OpenAI: GPT-5 Pro | [link](https://openrouter.ai/openai/gpt-5-pro) |
| `openai/gpt-5.1` | openai | OpenAI: GPT-5.1 | [link](https://openrouter.ai/openai/gpt-5.1) |
| `openai/gpt-5.1-chat` | openai | OpenAI: GPT-5.1 Chat | [link](https://openrouter.ai/openai/gpt-5.1-chat) |
| `openai/gpt-5.1-codex` | openai | OpenAI: GPT-5.1-Codex | [link](https://openrouter.ai/openai/gpt-5.1-codex) |
| `openai/gpt-5.1-codex-max` | openai | OpenAI: GPT-5.1-Codex-Max | [link](https://openrouter.ai/openai/gpt-5.1-codex-max) |
| `openai/gpt-5.1-codex-mini` | openai | OpenAI: GPT-5.1-Codex-Mini | [link](https://openrouter.ai/openai/gpt-5.1-codex-mini) |
| `openai/gpt-5.2` | openai | OpenAI: GPT-5.2 | [link](https://openrouter.ai/openai/gpt-5.2) |
| `openai/gpt-5.2-chat` | openai | OpenAI: GPT-5.2 Chat | [link](https://openrouter.ai/openai/gpt-5.2-chat) |
| `openai/gpt-5.2-codex` | openai | OpenAI: GPT-5.2-Codex | [link](https://openrouter.ai/openai/gpt-5.2-codex) |
| `openai/gpt-5.2-pro` | openai | OpenAI: GPT-5.2 Pro | [link](https://openrouter.ai/openai/gpt-5.2-pro) |
| `openai/gpt-5.3-chat` | openai | OpenAI: GPT-5.3 Chat | [link](https://openrouter.ai/openai/gpt-5.3-chat) |
| `openai/gpt-5.3-codex` | openai | OpenAI: GPT-5.3-Codex | [link](https://openrouter.ai/openai/gpt-5.3-codex) |
| `openai/gpt-5.4` | openai | OpenAI: GPT-5.4 | [link](https://openrouter.ai/openai/gpt-5.4) |
| `openai/gpt-5.4-mini` | openai | OpenAI: GPT-5.4 Mini | [link](https://openrouter.ai/openai/gpt-5.4-mini) |
| `openai/gpt-5.4-nano` | openai | OpenAI: GPT-5.4 Nano | [link](https://openrouter.ai/openai/gpt-5.4-nano) |
| `openai/gpt-5.4-pro` | openai | OpenAI: GPT-5.4 Pro | [link](https://openrouter.ai/openai/gpt-5.4-pro) |
| `openai/gpt-5.5` | openai | OpenAI: GPT-5.5 | [link](https://openrouter.ai/openai/gpt-5.5) |
| `openai/gpt-5.5-pro` | openai | OpenAI: GPT-5.5 Pro | [link](https://openrouter.ai/openai/gpt-5.5-pro) |
| `openai/gpt-chat-latest` | openai | OpenAI: GPT Chat Latest | [link](https://openrouter.ai/openai/gpt-chat-latest) |
| `openai/o1` | openai | OpenAI: o1 | [link](https://openrouter.ai/openai/o1) |
| `openai/o1-pro` | openai | OpenAI: o1-pro | [link](https://openrouter.ai/openai/o1-pro) |
| `openai/o3` | openai | OpenAI: o3 | [link](https://openrouter.ai/openai/o3) |
| `openai/o3-deep-research` | openai | OpenAI: o3 Deep Research | [link](https://openrouter.ai/openai/o3-deep-research) |
| `openai/o3-mini` | openai | OpenAI: o3 Mini | [link](https://openrouter.ai/openai/o3-mini) |
| `openai/o3-mini-high` | openai | OpenAI: o3 Mini High | [link](https://openrouter.ai/openai/o3-mini-high) |
| `openai/o3-pro` | openai | OpenAI: o3 Pro | [link](https://openrouter.ai/openai/o3-pro) |
| `openai/o4-mini` | openai | OpenAI: o4 Mini | [link](https://openrouter.ai/openai/o4-mini) |
| `openai/o4-mini-deep-research` | openai | OpenAI: o4 Mini Deep Research | [link](https://openrouter.ai/openai/o4-mini-deep-research) |
| `openai/o4-mini-high` | openai | OpenAI: o4 Mini High | [link](https://openrouter.ai/openai/o4-mini-high) |
| `openrouter/free` | openrouter | Free Models Router | [link](https://openrouter.ai/openrouter/free) |
| `perceptron/perceptron-mk1` | perceptron | Perceptron: Perceptron Mk1 | [link](https://openrouter.ai/perceptron/perceptron-mk1) |
| `perplexity/sonar` | perplexity | Perplexity: Sonar | [link](https://openrouter.ai/perplexity/sonar) |
| `perplexity/sonar-pro` | perplexity | Perplexity: Sonar Pro | [link](https://openrouter.ai/perplexity/sonar-pro) |
| `perplexity/sonar-pro-search` | perplexity | Perplexity: Sonar Pro Search | [link](https://openrouter.ai/perplexity/sonar-pro-search) |
| `perplexity/sonar-reasoning-pro` | perplexity | Perplexity: Sonar Reasoning Pro | [link](https://openrouter.ai/perplexity/sonar-reasoning-pro) |
| `qwen/qwen2.5-vl-72b-instruct` | qwen | Qwen: Qwen2.5 VL 72B Instruct | [link](https://openrouter.ai/qwen/qwen2.5-vl-72b-instruct) |
| `qwen/qwen3-vl-235b-a22b-instruct` | qwen | Qwen: Qwen3 VL 235B A22B Instruct | [link](https://openrouter.ai/qwen/qwen3-vl-235b-a22b-instruct) |
| `qwen/qwen3-vl-235b-a22b-thinking` | qwen | Qwen: Qwen3 VL 235B A22B Thinking | [link](https://openrouter.ai/qwen/qwen3-vl-235b-a22b-thinking) |
| `qwen/qwen3-vl-30b-a3b-instruct` | qwen | Qwen: Qwen3 VL 30B A3B Instruct | [link](https://openrouter.ai/qwen/qwen3-vl-30b-a3b-instruct) |
| `qwen/qwen3-vl-30b-a3b-thinking` | qwen | Qwen: Qwen3 VL 30B A3B Thinking | [link](https://openrouter.ai/qwen/qwen3-vl-30b-a3b-thinking) |
| `qwen/qwen3-vl-32b-instruct` | qwen | Qwen: Qwen3 VL 32B Instruct | [link](https://openrouter.ai/qwen/qwen3-vl-32b-instruct) |
| `qwen/qwen3-vl-8b-instruct` | qwen | Qwen: Qwen3 VL 8B Instruct | [link](https://openrouter.ai/qwen/qwen3-vl-8b-instruct) |
| `qwen/qwen3-vl-8b-thinking` | qwen | Qwen: Qwen3 VL 8B Thinking | [link](https://openrouter.ai/qwen/qwen3-vl-8b-thinking) |
| `qwen/qwen3.5-122b-a10b` | qwen | Qwen: Qwen3.5-122B-A10B | [link](https://openrouter.ai/qwen/qwen3.5-122b-a10b) |
| `qwen/qwen3.5-27b` | qwen | Qwen: Qwen3.5-27B | [link](https://openrouter.ai/qwen/qwen3.5-27b) |
| `qwen/qwen3.5-35b-a3b` | qwen | Qwen: Qwen3.5-35B-A3B | [link](https://openrouter.ai/qwen/qwen3.5-35b-a3b) |
| `qwen/qwen3.5-397b-a17b` | qwen | Qwen: Qwen3.5 397B A17B | [link](https://openrouter.ai/qwen/qwen3.5-397b-a17b) |
| `qwen/qwen3.5-9b` | qwen | Qwen: Qwen3.5-9B | [link](https://openrouter.ai/qwen/qwen3.5-9b) |
| `qwen/qwen3.5-flash-02-23` | qwen | Qwen: Qwen3.5-Flash | [link](https://openrouter.ai/qwen/qwen3.5-flash-02-23) |
| `qwen/qwen3.5-plus-02-15` | qwen | Qwen: Qwen3.5 Plus 2026-02-15 | [link](https://openrouter.ai/qwen/qwen3.5-plus-02-15) |
| `qwen/qwen3.5-plus-20260420` | qwen | Qwen: Qwen3.5 Plus 2026-04-20 | [link](https://openrouter.ai/qwen/qwen3.5-plus-20260420) |
| `qwen/qwen3.6-27b` | qwen | Qwen: Qwen3.6 27B | [link](https://openrouter.ai/qwen/qwen3.6-27b) |
| `qwen/qwen3.6-35b-a3b` | qwen | Qwen: Qwen3.6 35B A3B | [link](https://openrouter.ai/qwen/qwen3.6-35b-a3b) |
| `qwen/qwen3.6-flash` | qwen | Qwen: Qwen3.6 Flash | [link](https://openrouter.ai/qwen/qwen3.6-flash) |
| `qwen/qwen3.6-plus` | qwen | Qwen: Qwen3.6 Plus | [link](https://openrouter.ai/qwen/qwen3.6-plus) |
| `qwen/qwen3.7-plus` | qwen | Qwen: Qwen3.7 Plus | [link](https://openrouter.ai/qwen/qwen3.7-plus) |
| `rekaai/reka-edge` | rekaai | Reka Edge | [link](https://openrouter.ai/rekaai/reka-edge) |
| `stepfun/step-3.7-flash` | stepfun | StepFun: Step 3.7 Flash | [link](https://openrouter.ai/stepfun/step-3.7-flash) |
| `x-ai/grok-4.20` | x-ai | xAI: Grok 4.20 | [link](https://openrouter.ai/x-ai/grok-4.20) |
| `x-ai/grok-4.20-multi-agent` | x-ai | xAI: Grok 4.20 Multi-Agent | [link](https://openrouter.ai/x-ai/grok-4.20-multi-agent) |
| `x-ai/grok-4.3` | x-ai | xAI: Grok 4.3 | [link](https://openrouter.ai/x-ai/grok-4.3) |
| `x-ai/grok-build-0.1` | x-ai | xAI: Grok Build 0.1 | [link](https://openrouter.ai/x-ai/grok-build-0.1) |
| `z-ai/glm-4.5v` | z-ai | Z.ai: GLM 4.5V | [link](https://openrouter.ai/z-ai/glm-4.5v) |
| `z-ai/glm-4.6v` | z-ai | Z.ai: GLM 4.6V | [link](https://openrouter.ai/z-ai/glm-4.6v) |
| `z-ai/glm-5v-turbo` | z-ai | Z.ai: GLM 5V Turbo | [link](https://openrouter.ai/z-ai/glm-5v-turbo) |
| `~anthropic/claude-haiku-latest` | ~anthropic | Anthropic Claude Haiku Latest | [link](https://openrouter.ai/~anthropic/claude-haiku-latest) |
| `~anthropic/claude-opus-latest` | ~anthropic | Anthropic: Claude Opus Latest | [link](https://openrouter.ai/~anthropic/claude-opus-latest) |
| `~anthropic/claude-sonnet-latest` | ~anthropic | Anthropic Claude Sonnet Latest | [link](https://openrouter.ai/~anthropic/claude-sonnet-latest) |
| `~moonshotai/kimi-latest` | ~moonshotai | MoonshotAI Kimi Latest | [link](https://openrouter.ai/~moonshotai/kimi-latest) |
| `~openai/gpt-latest` | ~openai | OpenAI GPT Latest | [link](https://openrouter.ai/~openai/gpt-latest) |
| `~openai/gpt-mini-latest` | ~openai | OpenAI GPT Mini Latest | [link](https://openrouter.ai/~openai/gpt-mini-latest) |
### OpenRouter category: image-generation (7 models)

| Model ID | Provider | Name | Detail |
| --- | --- | --- | --- |
| `google/gemini-2.5-flash-image` | google | Google: Nano Banana (Gemini 2.5 Flash Image) | [link](https://openrouter.ai/google/gemini-2.5-flash-image) |
| `google/gemini-3-pro-image-preview` | google | Google: Nano Banana Pro (Gemini 3 Pro Image Preview) | [link](https://openrouter.ai/google/gemini-3-pro-image-preview) |
| `google/gemini-3.1-flash-image-preview` | google | Google: Nano Banana 2 (Gemini 3.1 Flash Image Preview) | [link](https://openrouter.ai/google/gemini-3.1-flash-image-preview) |
| `openai/gpt-5-image` | openai | OpenAI: GPT-5 Image | [link](https://openrouter.ai/openai/gpt-5-image) |
| `openai/gpt-5-image-mini` | openai | OpenAI: GPT-5 Image Mini | [link](https://openrouter.ai/openai/gpt-5-image-mini) |
| `openai/gpt-5.4-image-2` | openai | OpenAI: GPT-5.4 Image 2 | [link](https://openrouter.ai/openai/gpt-5.4-image-2) |
| `openrouter/auto` | openrouter | Auto Router | [link](https://openrouter.ai/openrouter/auto) |
### OpenRouter category: audio-generation (4 models)

| Model ID | Provider | Name | Detail |
| --- | --- | --- | --- |
| `google/lyria-3-clip-preview` | google | Google: Lyria 3 Clip Preview | [link](https://openrouter.ai/google/lyria-3-clip-preview) |
| `google/lyria-3-pro-preview` | google | Google: Lyria 3 Pro Preview | [link](https://openrouter.ai/google/lyria-3-pro-preview) |
| `openai/gpt-audio` | openai | OpenAI: GPT Audio | [link](https://openrouter.ai/openai/gpt-audio) |
| `openai/gpt-audio-mini` | openai | OpenAI: GPT Audio Mini | [link](https://openrouter.ai/openai/gpt-audio-mini) |
### OpenRouter category: speech-to-text-or-audio-understanding (17 models)

| Model ID | Provider | Name | Detail |
| --- | --- | --- | --- |
| `google/gemini-2.5-flash` | google | Google: Gemini 2.5 Flash | [link](https://openrouter.ai/google/gemini-2.5-flash) |
| `google/gemini-2.5-flash-lite` | google | Google: Gemini 2.5 Flash Lite | [link](https://openrouter.ai/google/gemini-2.5-flash-lite) |
| `google/gemini-2.5-flash-lite-preview-09-2025` | google | Google: Gemini 2.5 Flash Lite Preview 09-2025 | [link](https://openrouter.ai/google/gemini-2.5-flash-lite-preview-09-2025) |
| `google/gemini-2.5-pro` | google | Google: Gemini 2.5 Pro | [link](https://openrouter.ai/google/gemini-2.5-pro) |
| `google/gemini-2.5-pro-preview` | google | Google: Gemini 2.5 Pro Preview 06-05 | [link](https://openrouter.ai/google/gemini-2.5-pro-preview) |
| `google/gemini-2.5-pro-preview-05-06` | google | Google: Gemini 2.5 Pro Preview 05-06 | [link](https://openrouter.ai/google/gemini-2.5-pro-preview-05-06) |
| `google/gemini-3-flash-preview` | google | Google: Gemini 3 Flash Preview | [link](https://openrouter.ai/google/gemini-3-flash-preview) |
| `google/gemini-3.1-flash-lite` | google | Google: Gemini 3.1 Flash Lite | [link](https://openrouter.ai/google/gemini-3.1-flash-lite) |
| `google/gemini-3.1-flash-lite-preview` | google | Google: Gemini 3.1 Flash Lite Preview | [link](https://openrouter.ai/google/gemini-3.1-flash-lite-preview) |
| `google/gemini-3.1-pro-preview` | google | Google: Gemini 3.1 Pro Preview | [link](https://openrouter.ai/google/gemini-3.1-pro-preview) |
| `google/gemini-3.1-pro-preview-customtools` | google | Google: Gemini 3.1 Pro Preview Custom Tools | [link](https://openrouter.ai/google/gemini-3.1-pro-preview-customtools) |
| `google/gemini-3.5-flash` | google | Google: Gemini 3.5 Flash | [link](https://openrouter.ai/google/gemini-3.5-flash) |
| `mistralai/voxtral-small-24b-2507` | mistralai | Mistral: Voxtral Small 24B 2507 | [link](https://openrouter.ai/mistralai/voxtral-small-24b-2507) |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | nvidia | NVIDIA: Nemotron 3 Nano Omni (free) | [link](https://openrouter.ai/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free) |
| `xiaomi/mimo-v2.5` | xiaomi | Xiaomi: MiMo-V2.5 | [link](https://openrouter.ai/xiaomi/mimo-v2.5) |
| `~google/gemini-flash-latest` | ~google | Google Gemini Flash Latest | [link](https://openrouter.ai/~google/gemini-flash-latest) |
| `~google/gemini-pro-latest` | ~google | Google Gemini Pro Latest | [link](https://openrouter.ai/~google/gemini-pro-latest) |

## Official source links

- [OpenRouter models catalog](https://openrouter.ai/models)
- [OpenRouter models API](https://openrouter.ai/api/v1/models)
- [OpenRouter API overview](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter models guide](https://openrouter.ai/docs/guides/overview/models)
- [OpenRouter embeddings docs](https://openrouter.ai/docs/api/reference/embeddings)
- [OpenRouter endpoint-list docs](https://openrouter.ai/docs/api/api-reference/endpoints/list-endpoints)
- [OpenRouter model-list docs](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [Groq supported models](https://console.groq.com/docs/models)
- [Groq API reference](https://console.groq.com/docs/api-reference)
- [Groq OpenAI compatibility](https://console.groq.com/docs/openai)
- [Groq Responses API](https://console.groq.com/docs/responses-api)
- [Groq speech-to-text](https://console.groq.com/docs/speech-to-text)
- [Groq text-to-speech](https://console.groq.com/docs/text-to-speech)
- [Groq vision](https://console.groq.com/docs/vision)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)

## Final implementation advice for your agent

- Prefer refreshing OpenRouter from `GET /api/v1/models` at runtime because it is public and returns rich metadata.
- For Groq, use `GET /openai/v1/models` when an API key is available, but keep this doc-based fallback list for bootstrapping.
- Do not hardcode capability assumptions forever. Especially on Groq, features like structured outputs, Responses API tools, and preview models can change quickly.
- Keep the display label separate from the actual model ID used in API calls.
- Preserve exact model IDs including namespace prefixes like `openai/`, `meta-llama/`, `groq/`, `canopylabs/`, and `qwen/`.