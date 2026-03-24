import {
  ARTIFACT_HINTS,
  CONTEXT_TABLE_HINTS,
  collectServiceNowApis,
  excerptText,
  inferArtifactTypes,
  inferScope,
  normalizeText,
  tokenizeText,
  unique
} from './shared.js';

function deriveContextHints(context = {}) {
  const tableHints = CONTEXT_TABLE_HINTS[context.table] || [];
  return unique([
    ...(tableHints || []),
    context.scriptType || '',
    context.table || ''
  ]);
}

function deriveArtifactHints(action, question, context, code) {
  const baseText = [question, context?.scriptType, context?.table, code].filter(Boolean).join(' ');
  const explicitHints = inferArtifactTypes(baseText, context?.table || '');

  if (explicitHints.length > 0) return explicitHints;

  if (action === 'comment' || action === 'document') {
    return ['scriptInclude', 'businessRule', 'clientScript', 'uiAction'];
  }

  return [];
}

export function buildQueryProfile({ action, code = '', question = '', context = {} }) {
  const contextHints = deriveContextHints(context);
  const primaryTerms = tokenizeText(
    [question, context.scriptType, context.table, code].filter(Boolean).join(' '),
    { preserve: contextHints }
  );
  const apiTerms = collectServiceNowApis(code);
  const artifactHints = deriveArtifactHints(action, question, context, code);
  const scopeHints = inferScope([context.scriptType, context.table, code, question].filter(Boolean).join(' '));

  return {
    action,
    table: context.table || null,
    scriptType: context.scriptType || 'script',
    scopeHints,
    artifactHints,
    apiTerms,
    primaryTerms,
    queryText: [question, context.scriptType, context.table].filter(Boolean).join(' ').trim()
  };
}

function scoreChunk(chunk, profile) {
  const reasons = [];
  let score = 0;

  const chunkTerms = chunk.terms || [];
  const titleTerms = chunk.titleTerms || [];
  const tagTerms = chunk.tagTerms || [];
  const apiTerms = chunk.apiTerms || [];
  const artifactTypes = chunk.signals?.artifactTypes || [];
  const scope = chunk.signals?.scope || [];

  const lexicalHits = profile.primaryTerms.filter((term) => chunkTerms.includes(term));
  if (lexicalHits.length > 0) {
    score += lexicalHits.length * 3;
    reasons.push(`matched ${lexicalHits.slice(0, 4).join(', ')}`);
  }

  const titleHits = profile.primaryTerms.filter((term) => titleTerms.includes(term));
  if (titleHits.length > 0) {
    score += titleHits.length * 5;
    reasons.push(`title aligned on ${titleHits.slice(0, 3).join(', ')}`);
  }

  const tagHits = unique([
    ...profile.primaryTerms.filter((term) => tagTerms.includes(term)),
    ...profile.artifactHints.filter((term) => tagTerms.includes(normalizeText(term)))
  ]);
  if (tagHits.length > 0) {
    score += tagHits.length * 4;
    reasons.push(`tags suggest ${tagHits.slice(0, 3).join(', ')}`);
  }

  const apiHits = profile.apiTerms.filter((term) => chunkTerms.includes(term) || apiTerms.includes(term));
  if (apiHits.length > 0) {
    score += apiHits.length * 6;
    reasons.push(`ServiceNow APIs ${apiHits.slice(0, 3).join(', ')}`);
  }

  const artifactHits = profile.artifactHints.filter((term) => artifactTypes.includes(term));
  if (artifactHits.length > 0) {
    score += artifactHits.length * 7;
    reasons.push(`artifact fit: ${artifactHits.slice(0, 3).join(', ')}`);
  }

  const scopeHits = profile.scopeHints.filter((term) => scope.includes(term));
  if (scopeHits.length > 0) {
    score += scopeHits.length * 5;
    reasons.push(`scope fit: ${scopeHits.join(', ')}`);
  }

  if (chunk.resolved === true) {
    score += 2;
    reasons.push('article is marked as solved');
  }

  if (profile.action === 'refactor' && chunk.headingTerms?.includes('solucion')) {
    score += 3;
    reasons.push('solution-oriented section');
  }

  if (profile.action === 'document' && chunk.headingTerms?.includes('versiones')) {
    score += 2;
    reasons.push('version coverage');
  }

  if (chunk.source?.priority) {
    score += chunk.source.priority;
  }

  return {
    ...chunk,
    score,
    reasons,
    matchedTerms: unique([...lexicalHits, ...titleHits, ...tagHits, ...apiHits]).slice(0, 8)
  };
}

function rerankAndTrim(scoredChunks, ragSettings) {
  const sorted = scoredChunks
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const selected = [];
  const perDocument = new Map();
  let charCount = 0;

  for (const chunk of sorted) {
    const currentDocCount = perDocument.get(chunk.documentId) || 0;
    if (currentDocCount >= ragSettings.maxChunksPerDocument) continue;

    const nextCharCount = charCount + (chunk.text?.length || 0);
    if (selected.length >= ragSettings.maxChunks) break;
    if (selected.length > 0 && nextCharCount > ragSettings.maxContextChars) continue;

    selected.push(chunk);
    perDocument.set(chunk.documentId, currentDocCount + 1);
    charCount = nextCharCount;
  }

  return selected.map((chunk, index) => ({
    rank: index + 1,
    chunkId: chunk.id,
    documentId: chunk.documentId,
    score: chunk.score,
    sourceId: chunk.sourceId,
    sourceName: chunk.source?.name || chunk.sourceName || chunk.sourceId,
    title: chunk.title,
    description: chunk.description,
    url: chunk.url,
    category: chunk.category,
    heading: chunk.heading,
    excerpt: excerptText(chunk.text, 280),
    text: chunk.text,
    difficulty: chunk.difficulty,
    servicenowVersions: chunk.servicenowVersions || [],
    reasons: chunk.reasons,
    matchedTerms: chunk.matchedTerms
  }));
}

export function retrieveRelevantChunks({ chunks, ragSettings, action, code, question, context }) {
  const profile = buildQueryProfile({ action, code, question, context });
  const scored = chunks.map((chunk) => scoreChunk(chunk, profile));
  const selected = rerankAndTrim(scored, ragSettings);

  return {
    profile,
    selected,
    totalCandidates: scored.filter((chunk) => chunk.score > 0).length
  };
}
