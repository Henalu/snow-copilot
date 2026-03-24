import { getActiveRagSourceIds, isRagEnabledForAction, normalizeRagSettings } from './config.js';
import { loadActiveKnowledgeBase } from './index.js';
import { retrieveRelevantChunks } from './retrieval.js';

function buildDisabledTrace(ragSettings, reason) {
  return {
    enabled: false,
    reason,
    strategy: ragSettings.strategy,
    activeSourceIds: [],
    selectedChunks: [],
    trace: {
      strategy: ragSettings.strategy,
      reason,
      totalCandidates: 0
    }
  };
}

export async function buildRagContext({ action, code, question, context, settings }) {
  const ragSettings = normalizeRagSettings(settings?.rag);
  if (!ragSettings.enabled) return buildDisabledTrace(ragSettings, 'RAG disabled in settings');
  if (!isRagEnabledForAction(ragSettings, action)) {
    return buildDisabledTrace(ragSettings, `RAG disabled for ${action}`);
  }

  const activeSourceIds = getActiveRagSourceIds(ragSettings);
  if (activeSourceIds.length === 0) return buildDisabledTrace(ragSettings, 'No active RAG sources configured');

  try {
    const chunks = await loadActiveKnowledgeBase(activeSourceIds);
    const retrieval = retrieveRelevantChunks({
      chunks,
      ragSettings,
      action,
      code,
      question,
      context
    });

    return {
      enabled: true,
      strategy: ragSettings.strategy,
      activeSourceIds,
      selectedChunks: retrieval.selected,
      trace: {
        strategy: ragSettings.strategy,
        activeSourceIds,
        totalCandidates: retrieval.totalCandidates,
        queryProfile: retrieval.profile
      }
    };
  } catch (err) {
    return {
      enabled: true,
      strategy: ragSettings.strategy,
      activeSourceIds,
      selectedChunks: [],
      trace: {
        strategy: ragSettings.strategy,
        activeSourceIds,
        totalCandidates: 0,
        error: err.message
      }
    };
  }
}
