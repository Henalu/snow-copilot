export const BUILTIN_RAG_SOURCES = {
  breakingTrail: {
    id: 'breakingTrail',
    name: 'Breaking Trail',
    description: 'Curated ServiceNow implementation articles from Breaking Trail.',
    indexPath: 'rag/indexes/breaking-trail.json',
    priority: 10
  }
};

export const DEFAULT_RAG_ACTIONS = {
  explain: true,
  ask: true,
  refactor: false,
  comment: false,
  document: false,
  documentUpdateSet: false
};

export const DEFAULT_RAG_SETTINGS = {
  enabled: true,
  debug: false,
  strategy: 'servicenow-hybrid-v1',
  maxChunks: 3,
  maxChunksPerDocument: 2,
  maxContextChars: 3200,
  includeTraceInPanel: true,
  enabledActions: DEFAULT_RAG_ACTIONS,
  activeSources: {
    breakingTrail: true
  }
};

export function normalizeRagSettings(rag = {}) {
  return {
    ...DEFAULT_RAG_SETTINGS,
    ...rag,
    enabledActions: {
      ...DEFAULT_RAG_ACTIONS,
      ...(rag.enabledActions || {})
    },
    activeSources: {
      ...DEFAULT_RAG_SETTINGS.activeSources,
      ...(rag.activeSources || {})
    }
  };
}

export function isRagEnabledForAction(rag = {}, action = '') {
  const normalized = normalizeRagSettings(rag);
  return normalized.enabledActions?.[action] !== false;
}

export function getActiveRagSourceIds(rag = {}) {
  const normalized = normalizeRagSettings(rag);
  return Object.keys(BUILTIN_RAG_SOURCES).filter((sourceId) => normalized.activeSources?.[sourceId]);
}
