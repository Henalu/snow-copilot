// providers/catalog.js — Model catalog with capability tiers

export const PROVIDER_META = {
  anthropic:     { name: 'Anthropic Claude', icon: '🟣', experimental: false },
  openai:        { name: 'OpenAI',            icon: '🟢', experimental: false },
  gemini:        { name: 'Google Gemini',     icon: '🔵', experimental: false },
  openrouter:    { name: 'OpenRouter',        icon: '🔀', experimental: false },
  customEndpoint:{ name: 'Custom Endpoint',   icon: '🔗', experimental: false },
  localLlm:      { name: 'Local LLM',         icon: '💻', experimental: true  }
};

/**
 * Static catalog of known models with capability metadata.
 * costTier:    'cheap' | 'medium' | 'premium'
 * qualityTier: 'basic'  | 'strong' | 'best'
 * latencyTier: 'fast'   | 'medium' | 'slow'
 * strengths:   actions where this model performs especially well
 */
export const MODEL_CATALOG = {
  anthropic: [
    {
      id: 'claude-opus-4-6',
      name: 'Claude Opus 4.6',
      costTier: 'premium', qualityTier: 'best', latencyTier: 'slow',
      strengths: ['refactor']
    },
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      costTier: 'medium', qualityTier: 'best', latencyTier: 'medium',
      strengths: ['refactor', 'comment', 'document']
    },
    {
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      costTier: 'cheap', qualityTier: 'strong', latencyTier: 'fast',
      strengths: ['explain', 'ask']
    }
  ],
  openai: [
    {
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      costTier: 'premium', qualityTier: 'best', latencyTier: 'medium',
      strengths: ['refactor', 'comment', 'document']
    },
    {
      id: 'gpt-4.1-mini',
      name: 'GPT-4.1 Mini',
      costTier: 'cheap', qualityTier: 'strong', latencyTier: 'fast',
      strengths: ['explain', 'ask']
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      costTier: 'medium', qualityTier: 'best', latencyTier: 'medium',
      strengths: ['refactor', 'explain']
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      costTier: 'cheap', qualityTier: 'strong', latencyTier: 'fast',
      strengths: ['explain', 'ask']
    }
  ],
  gemini: [
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      costTier: 'premium', qualityTier: 'best', latencyTier: 'medium',
      strengths: ['refactor', 'explain']
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      costTier: 'medium', qualityTier: 'strong', latencyTier: 'fast',
      strengths: ['comment', 'ask']
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      costTier: 'cheap', qualityTier: 'strong', latencyTier: 'fast',
      strengths: ['explain', 'ask']
    }
  ],
  // Non-cataloged providers: models are user-defined
  openrouter:     [],
  customEndpoint: [],
  localLlm:       []
};

/**
 * Per-action priority profile used by the recommendation engine.
 * preferCost:    ideal cost tier for this action
 * preferQuality: minimum quality tier desired
 * preferLatency: ideal latency tier for this action
 */
export const ACTION_PRIORITIES = {
  explain:  { preferCost: 'cheap',   preferQuality: 'strong', preferLatency: 'fast'   },
  comment:  { preferCost: 'medium',  preferQuality: 'strong', preferLatency: 'medium' },
  refactor: { preferCost: 'premium', preferQuality: 'best',   preferLatency: 'medium' },
  ask:      { preferCost: 'cheap',   preferQuality: 'strong', preferLatency: 'fast'   },
  // Document generation: prioritizes output quality over cost/speed (comprehensive writing task)
  document: { preferCost: 'medium',  preferQuality: 'best',   preferLatency: 'medium' }
};

/** Returns the catalog models for a given provider id, or [] if none. */
export function getModelsForProvider(providerId) {
  return MODEL_CATALOG[providerId] ?? [];
}

/** Returns display name for a model id, or the id itself as fallback. */
export function getModelName(providerId, modelId) {
  const model = (MODEL_CATALOG[providerId] ?? []).find(m => m.id === modelId);
  return model?.name ?? modelId ?? '—';
}
