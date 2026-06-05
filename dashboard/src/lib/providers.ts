/** Well-known AI provider presets for the dashboard dropdown */
export const PROVIDER_PRESETS: Record<string, {
  label: string;
  baseUrl: string;
  defaultChatModel: string;
  defaultEmbeddingModel: string;
  placeholder: string;
}> = {
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
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultChatModel: 'gemini-2.0-flash',
    defaultEmbeddingModel: 'text-embedding-004',
    placeholder: 'AIza...',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultChatModel: 'llama-3.1-8b-instant',
    defaultEmbeddingModel: '',
    placeholder: 'gsk_...',
  },
  together: {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultChatModel: 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
    defaultEmbeddingModel: 'togethercomputer/m2-bert-80M-8k-retrieval',
    placeholder: '',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultChatModel: 'deepseek-chat',
    defaultEmbeddingModel: '',
    placeholder: 'sk-...',
  },
  mistral: {
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultChatModel: 'mistral-small-latest',
    defaultEmbeddingModel: 'mistral-embed',
    placeholder: '',
  },
  cloudflare: {
    label: 'Cloudflare AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{YOUR_ACCOUNT_ID}/ai/v1',
    defaultChatModel: '@cf/meta/llama-3.1-8b-instruct',
    defaultEmbeddingModel: '@cf/baai/bge-small-en-v1.5',
    placeholder: 'API Token',
  },
  custom: {
    label: 'Custom (OpenAI-Compatible)',
    baseUrl: '',
    defaultChatModel: '',
    defaultEmbeddingModel: '',
    placeholder: '',
  },
};
