/** Well-known AI provider presets for the dashboard dropdown */
export const PROVIDER_PRESETS: Record<string, {
  label: string;
  baseUrl: string;
  defaultChatModel: string;
  defaultEmbeddingModel: string;
  placeholder: string;
}> = {
  anthropic: {
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultChatModel: 'claude-3-5-sonnet-latest',
    defaultEmbeddingModel: '',
    placeholder: 'sk-ant-...',
  },
  cloudflare: {
    label: 'Cloudflare AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{YOUR_ACCOUNT_ID}/ai/v1',
    defaultChatModel: '@cf/meta/llama-3.1-8b-instruct',
    defaultEmbeddingModel: '@cf/baai/bge-small-en-v1.5',
    placeholder: 'API Token',
  },
  cohere: {
    label: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    defaultChatModel: 'command-r-plus',
    defaultEmbeddingModel: 'embed-english-v3.0',
    placeholder: 'API Key',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultChatModel: 'deepseek-chat',
    defaultEmbeddingModel: '',
    placeholder: 'sk-...',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultChatModel: 'gemini-2.0-flash',
    defaultEmbeddingModel: 'text-embedding-004',
    placeholder: 'AIza...',
  },
  grok: {
    label: 'Grok (xAI)',
    baseUrl: 'https://api.x.ai/v1',
    defaultChatModel: 'grok-2-1212',
    defaultEmbeddingModel: '',
    placeholder: 'xai-...',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultChatModel: 'llama-3.1-8b-instant',
    defaultEmbeddingModel: '',
    placeholder: 'gsk_...',
  },
  meta: {
    label: 'Meta Llama',
    baseUrl: 'https://api.together.xyz/v1',
    defaultChatModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    defaultEmbeddingModel: '',
    placeholder: 'API Key',
  },
  mistral: {
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultChatModel: 'mistral-small-latest',
    defaultEmbeddingModel: 'mistral-embed',
    placeholder: '',
  },
  nvidia: {
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultChatModel: 'meta/llama-3.3-70b-instruct',
    defaultEmbeddingModel: 'nvidia/embed-qa-4',
    placeholder: 'nvapi-...',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultChatModel: 'gpt-4o-mini',
    defaultEmbeddingModel: 'text-embedding-3-small',
    placeholder: 'sk-...',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultChatModel: 'openai/gpt-4o-mini',
    defaultEmbeddingModel: 'openai/text-embedding-3-small',
    placeholder: 'sk-or-...',
  },
  perplexity: {
    label: 'Perplexity Sonar',
    baseUrl: 'https://api.perplexity.ai',
    defaultChatModel: 'sonar-reasoning',
    defaultEmbeddingModel: '',
    placeholder: 'pplx-...',
  },
  together: {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultChatModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    defaultEmbeddingModel: 'togethercomputer/m2-bert-80M-8k-retrieval',
    placeholder: '',
  },
  xai: {
    label: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    defaultChatModel: 'grok-2-1212',
    defaultEmbeddingModel: '',
    placeholder: 'xai-...',
  },
  custom: {
    label: 'Custom (OpenAI-Compatible)',
    baseUrl: '',
    defaultChatModel: '',
    defaultEmbeddingModel: '',
    placeholder: '',
  },
};

