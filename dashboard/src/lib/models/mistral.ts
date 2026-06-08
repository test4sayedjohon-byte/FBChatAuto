import type { ModelPreset } from './openai';

export const MISTRAL_CHAT_MODELS: ModelPreset[] = [
  {
    "id": "codestral-2508",
    "name": "Codestral 2508",
    "context": "256K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "devstral-2512",
    "name": "Devstral 2 2512",
    "context": "262K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "ministral-14b-2512",
    "name": "Ministral 3 14B 2512",
    "context": "262K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "ministral-3b-2512",
    "name": "Ministral 3 3B 2512",
    "context": "131K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "ministral-8b-2512",
    "name": "Ministral 3 8B 2512",
    "context": "262K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-large",
    "name": "Mistral Large",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-large-2407",
    "name": "Mistral Large 2407",
    "context": "131K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-large-2512",
    "name": "Mistral Large 3 2512",
    "context": "262K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-medium-3",
    "name": "Mistral Medium 3",
    "context": "131K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-medium-3-5",
    "name": "Mistral Medium 3.5",
    "context": "262K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-medium-3.1",
    "name": "Mistral Medium 3.1",
    "context": "131K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-nemo",
    "name": "Mistral Nemo",
    "context": "131K",
    "capabilities": "Tools"
  },
  {
    "id": "mistral-saba",
    "name": "Saba",
    "context": "33K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-small-24b-instruct-2501",
    "name": "Mistral Small 3",
    "context": "33K",
    "capabilities": "Tools"
  },
  {
    "id": "mistral-small-2603",
    "name": "Mistral Small 4",
    "context": "262K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-small-3.1-24b-instruct",
    "name": "Mistral Small 3.1 24B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mistral-small-3.2-24b-instruct",
    "name": "Mistral Small 3.2 24B",
    "context": "128K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "mixtral-8x22b-instruct",
    "name": "Mixtral 8x22B Instruct",
    "context": "66K",
    "capabilities": "Vision, Tools"
  },
  {
    "id": "voxtral-small-24b-2507",
    "name": "Voxtral Small 24B 2507",
    "context": "32K",
    "capabilities": "Tools"
  }
];

export const MISTRAL_EMBEDDING_MODELS: ModelPreset[] = [
  {
    "id": "mistral-embed",
    "name": "Mistral Embed",
    "context": "8K",
    "capabilities": "Embedding"
  }
];
