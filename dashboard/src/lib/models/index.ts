import type { ModelPreset } from './openai';
import { OPENAI_CHAT_MODELS, OPENAI_EMBEDDING_MODELS } from './openai';
import { OPENROUTER_CHAT_MODELS, OPENROUTER_EMBEDDING_MODELS } from './openrouter';
import { GEMINI_CHAT_MODELS, GEMINI_EMBEDDING_MODELS } from './gemini';
import { GROQ_CHAT_MODELS, GROQ_EMBEDDING_MODELS } from './groq';
import { DEEPSEEK_CHAT_MODELS, DEEPSEEK_EMBEDDING_MODELS } from './deepseek';
import { MISTRAL_CHAT_MODELS, MISTRAL_EMBEDDING_MODELS } from './mistral';
import { TOGETHER_CHAT_MODELS, TOGETHER_EMBEDDING_MODELS } from './together';
import { ANTHROPIC_CHAT_MODELS, ANTHROPIC_EMBEDDING_MODELS } from './anthropic';
import { NVIDIA_CHAT_MODELS, NVIDIA_EMBEDDING_MODELS } from './nvidia';
import { COHERE_CHAT_MODELS, COHERE_EMBEDDING_MODELS } from './cohere';
import { PERPLEXITY_CHAT_MODELS, PERPLEXITY_EMBEDDING_MODELS } from './perplexity';
import { XAI_CHAT_MODELS, XAI_EMBEDDING_MODELS } from './xai';
import { META_CHAT_MODELS, META_EMBEDDING_MODELS } from './meta';

export * from './openai';
export * from './openrouter';
export * from './gemini';
export * from './groq';
export * from './deepseek';
export * from './mistral';
export * from './together';
export * from './anthropic';
export * from './nvidia';
export * from './cohere';
export * from './perplexity';
export * from './xai';
export * from './meta';

export const getPresetChatModels = (provider: string): ModelPreset[] => {
  switch (provider?.toLowerCase()) {
    case 'openai': return OPENAI_CHAT_MODELS;
    case 'openrouter': return OPENROUTER_CHAT_MODELS;
    case 'gemini': return GEMINI_CHAT_MODELS;
    case 'groq': return GROQ_CHAT_MODELS;
    case 'deepseek': return DEEPSEEK_CHAT_MODELS;
    case 'mistral': return MISTRAL_CHAT_MODELS;
    case 'together': return TOGETHER_CHAT_MODELS;
    case 'anthropic': return ANTHROPIC_CHAT_MODELS;
    case 'nvidia': return NVIDIA_CHAT_MODELS;
    case 'cohere': return COHERE_CHAT_MODELS;
    case 'perplexity': return PERPLEXITY_CHAT_MODELS;
    case 'xai':
    case 'grok':
      return XAI_CHAT_MODELS;
    case 'meta': return META_CHAT_MODELS;
    default: return [];
  }
};

export const getPresetEmbeddingModels = (provider: string): ModelPreset[] => {
  switch (provider?.toLowerCase()) {
    case 'openai': return OPENAI_EMBEDDING_MODELS;
    case 'openrouter': return OPENROUTER_EMBEDDING_MODELS;
    case 'gemini': return GEMINI_EMBEDDING_MODELS;
    case 'groq': return GROQ_EMBEDDING_MODELS;
    case 'deepseek': return DEEPSEEK_EMBEDDING_MODELS;
    case 'mistral': return MISTRAL_EMBEDDING_MODELS;
    case 'together': return TOGETHER_EMBEDDING_MODELS;
    case 'anthropic': return ANTHROPIC_EMBEDDING_MODELS;
    case 'nvidia': return NVIDIA_EMBEDDING_MODELS;
    case 'cohere': return COHERE_EMBEDDING_MODELS;
    case 'perplexity': return PERPLEXITY_EMBEDDING_MODELS;
    case 'xai':
    case 'grok':
      return XAI_EMBEDDING_MODELS;
    case 'meta': return META_EMBEDDING_MODELS;
    default: return [];
  }
};

