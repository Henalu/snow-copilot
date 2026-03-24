import { BUILTIN_RAG_SOURCES } from './config.js';

const indexCache = new Map();

async function loadIndexFromPath(indexPath) {
  const runtimePath = chrome.runtime.getURL(indexPath);
  const response = await fetch(runtimePath);

  if (!response.ok) {
    throw new Error(`Failed to load bundled RAG index: ${indexPath}`);
  }

  return response.json();
}

export async function loadSourceIndex(sourceId) {
  if (indexCache.has(sourceId)) return indexCache.get(sourceId);

  const source = BUILTIN_RAG_SOURCES[sourceId];
  if (!source) throw new Error(`Unknown RAG source: ${sourceId}`);

  const promise = loadIndexFromPath(source.indexPath).then((index) => ({
    ...index,
    source: {
      ...source,
      ...(index.source || {})
    }
  }));

  indexCache.set(sourceId, promise);
  return promise;
}

export async function loadActiveKnowledgeBase(sourceIds = []) {
  const indexes = await Promise.all(sourceIds.map((sourceId) => loadSourceIndex(sourceId)));
  return indexes.flatMap((index) => {
    const source = index.source || BUILTIN_RAG_SOURCES[index.sourceId] || null;
    return (index.chunks || []).map((chunk) => ({
      ...chunk,
      source
    }));
  });
}
