// providers/manager.js — Provider resolver and action router

import { anthropicProvider }     from './anthropic.js';
import { openaiProvider }        from './openai.js';
import { geminiProvider }        from './gemini.js';
import { openrouterProvider }    from './openrouter.js';
import { customEndpointProvider }from './customEndpoint.js';
import { localLlmProvider }      from './localLlm.js';
import { loadSettings }          from '../storage/schema.js';

const PROVIDERS = {
  anthropic:      anthropicProvider,
  openai:         openaiProvider,
  gemini:         geminiProvider,
  openrouter:     openrouterProvider,
  customEndpoint: customEndpointProvider,
  localLlm:       localLlmProvider
};

/** Returns the provider adapter for a given id, or null. */
export function getProvider(id) {
  return PROVIDERS[id] ?? null;
}

/**
 * Resolves which provider (and optional model override) to use for an action.
 * Resolution order:
 *   1. Action-based routing (if enabled and configured for this action)
 *   2. Default provider
 *   3. First available configured provider
 */
export async function resolveProvider(action) {
  const settings = await loadSettings();
  const { providers, routing } = settings;

  let providerId = null;
  let modelId = null;

  // 1. Action routing
  if (routing.actionRouting?.enabled) {
    const actionConfig = routing.actionRouting.actions?.[action];
    if (actionConfig?.providerId) {
      providerId = actionConfig.providerId;
      modelId = actionConfig.modelId || null;
    }
  }

  // 2. Default provider
  if (!providerId && routing.defaultProvider) {
    providerId = routing.defaultProvider;
  }

  // 3. First configured provider
  if (!providerId) {
    for (const id of Object.keys(PROVIDERS)) {
      const config = providers[id];
      if (config && PROVIDERS[id]?.isConfigured(config)) {
        providerId = id;
        break;
      }
    }
  }

  if (!providerId) {
    throw new Error(
      'No AI provider configured. Open extension settings to add a provider.'
    );
  }

  const provider = PROVIDERS[providerId];
  const providerConfig = providers[providerId];

  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  if (!provider.isConfigured(providerConfig)) {
    throw new Error(
      `Provider "${providerId}" is enabled but not properly configured. ` +
      'Check extension settings.'
    );
  }

  return { provider, providerConfig, modelId, providerId };
}

/**
 * Main entry point for the content script.
 * Returns an async generator that yields text chunks.
 */
export async function sendAction({ action, code, question, context }) {
  const { provider, providerConfig, modelId } = await resolveProvider(action);
  return provider.sendPrompt({ action, code, question, context, config: providerConfig, model: modelId });
}

/**
 * Returns display info for the currently resolved provider (for UI footer).
 */
export async function resolveProviderLabel(action) {
  try {
    const { providerId, modelId, providerConfig } = await resolveProvider(action);
    const { PROVIDER_META } = await import('./catalog.js');
    const name = PROVIDER_META[providerId]?.name ?? providerId;
    const model = modelId || providerConfig?.model || '';
    return model ? `${name} — ${model}` : name;
  } catch {
    return 'Not configured';
  }
}
