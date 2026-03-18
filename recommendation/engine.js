// recommendation/engine.js — Smart defaults / recommended routing engine

import { MODEL_CATALOG, ACTION_PRIORITIES } from '../providers/catalog.js';
import { PROVIDER_IDS } from '../storage/schema.js';

const COST_RANK    = { cheap: 1, medium: 2, premium: 3 };
const QUALITY_RANK = { basic: 1, strong: 2, best: 3 };
const LATENCY_RANK = { fast: 1, medium: 2, slow: 3 };

/**
 * Given the providers config, compute a recommended { providerId, modelId }
 * for each action. Returns null if no providers are configured.
 *
 * @param {object} providers — the providers subtree from settings
 * @returns {{ explain, comment, refactor, ask } | null}
 */
export function computeRecommendations(providers) {
  const configured = getConfiguredProviderIds(providers);
  if (configured.length === 0) return null;

  const recommendations = {};
  for (const action of ['explain', 'comment', 'refactor', 'ask']) {
    recommendations[action] = pickBestFor(action, configured);
  }
  return recommendations;
}

/**
 * Apply recommendations to an actionRouting config, but ONLY for actions
 * that have not been manually overridden by the user.
 *
 * @param {object} actionRouting — routing.actionRouting from settings
 * @param {object|null} recommendations — output of computeRecommendations()
 * @returns {object} updated actionRouting (new object, not mutated)
 */
export function applyRecommendations(actionRouting, recommendations) {
  if (!recommendations) return actionRouting;

  const updated = {
    ...actionRouting,
    actions: { ...actionRouting.actions }
  };

  for (const action of Object.keys(recommendations)) {
    const current = updated.actions[action] ?? {};
    if (current.isUserOverride) continue; // respect manual customizations

    updated.actions[action] = {
      ...current,
      providerId:          recommendations[action].providerId,
      modelId:             recommendations[action].modelId,
      recommendedProviderId: recommendations[action].providerId,
      recommendedModelId:    recommendations[action].modelId,
      isUserOverride: false
    };
  }

  return updated;
}

/**
 * Refresh the recommendedProviderId/recommendedModelId fields in actionRouting
 * without touching user-overridden entries. Used when providers change.
 */
export function refreshRecommendedFields(actionRouting, providers) {
  const recommendations = computeRecommendations(providers);
  if (!recommendations) return actionRouting;

  const updated = {
    ...actionRouting,
    actions: { ...actionRouting.actions }
  };

  for (const action of Object.keys(recommendations)) {
    const current = updated.actions[action] ?? {};
    updated.actions[action] = {
      ...current,
      recommendedProviderId: recommendations[action].providerId,
      recommendedModelId:    recommendations[action].modelId
    };
    // If not user-overridden, also update the active assignment
    if (!current.isUserOverride) {
      updated.actions[action].providerId = recommendations[action].providerId;
      updated.actions[action].modelId    = recommendations[action].modelId;
    }
  }

  return updated;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getConfiguredProviderIds(providers) {
  return PROVIDER_IDS.filter(id => {
    const config = providers?.[id];
    return config?.enabled && isProviderConfigured(id, config);
  });
}

function isProviderConfigured(id, config) {
  switch (id) {
    case 'anthropic':      return !!config.apiKey?.trim();
    case 'openai':         return !!config.apiKey?.trim();
    case 'gemini':         return !!config.apiKey?.trim();
    case 'openrouter':     return !!(config.apiKey?.trim() && config.model?.trim());
    case 'customEndpoint': return !!config.url?.trim();
    case 'localLlm':       return !!(config.baseUrl?.trim() && config.model?.trim());
    default:               return false;
  }
}

/**
 * Scores all catalog models across configured providers for a given action,
 * and returns the best-matching { providerId, modelId }.
 */
function pickBestFor(action, configuredProviderIds) {
  const prio = ACTION_PRIORITIES[action];
  const candidates = [];

  for (const providerId of configuredProviderIds) {
    const models = MODEL_CATALOG[providerId];

    if (!models || models.length === 0) {
      // Non-cataloged provider (openrouter, customEndpoint, localLlm)
      // Add as a low-priority fallback candidate
      candidates.push({ providerId, modelId: null, score: 1 });
      continue;
    }

    for (const model of models) {
      candidates.push({
        providerId,
        modelId: model.id,
        score: scoreModel(model, prio, action)
      });
    }
  }

  if (candidates.length === 0) {
    return { providerId: configuredProviderIds[0], modelId: null };
  }

  candidates.sort((a, b) => b.score - a.score);
  return { providerId: candidates[0].providerId, modelId: candidates[0].modelId };
}

function scoreModel(model, prio, action) {
  let score = 0;

  // Quality: score goes up as quality meets or exceeds preference
  const qualityVal = QUALITY_RANK[model.qualityTier] ?? 1;
  const prefQuality = QUALITY_RANK[prio.preferQuality] ?? 1;
  score += qualityVal >= prefQuality ? 10 : qualityVal * 2;

  // Cost: penalize when cost tier deviates from preferred
  const costVal = COST_RANK[model.costTier] ?? 2;
  const prefCost = COST_RANK[prio.preferCost] ?? 2;
  score -= Math.abs(costVal - prefCost) * 3;

  // Latency: penalize when latency deviates from preferred
  const latencyVal = LATENCY_RANK[model.latencyTier] ?? 2;
  const prefLatency = LATENCY_RANK[prio.preferLatency] ?? 2;
  score -= Math.abs(latencyVal - prefLatency) * 2;

  // Bonus for explicitly listed strength
  if (model.strengths?.includes(action)) score += 5;

  return score;
}
