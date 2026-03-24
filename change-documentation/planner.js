import {
  CHANGE_GROUP_DEFINITIONS,
  CHANGE_DOCUMENTATION_ACTIONS,
  normalizeCustomerUpdateRecord,
  normalizeQuestionnaireAnswers
} from './schema.js';

function normalize(value = '') {
  return String(value).toLowerCase().trim();
}

const MAX_RECORD_EXAMPLES_PER_GROUP = 5;
const MAX_GROUP_SUMMARY_VALUES = 4;
const PAYLOAD_PREVIEW_EXAMPLE_LIMIT = 2;
const SCRIPT_PREVIEW_EXAMPLE_LIMIT = 2;

function buildRecordSearchText(record) {
  return [
    record.type,
    record.targetTable,
    record.targetName,
    record.name,
    record.action,
    record.application,
    record.payloadPreview,
    record.deepTable,
    record.deepName,
    record.scriptPreview,
    ...(record.fieldSummary || [])
  ].map(normalize).join(' ');
}

function looksLikeSysId(value = '') {
  return /^[a-f0-9]{32}$/i.test(String(value || '').trim());
}

function compactValue(value = '', maxLength = 180) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return compact.slice(0, maxLength - 3) + '...';
}

function summarizeUnique(values = [], maxItems = MAX_GROUP_SUMMARY_VALUES) {
  const unique = Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
  if (!unique.length) return 'Unknown';
  const visible = unique.slice(0, maxItems);
  const remaining = unique.length - visible.length;
  return remaining > 0 ? `${visible.join(', ')} (+${remaining} more)` : visible.join(', ');
}

function summarizeCounts(values = []) {
  const counts = new Map();

  for (const value of values.map((entry) => String(entry || '').trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} x${count}`)
    .join(', ') || 'Unknown';
}

function resolveApplicationName(packageMeta = {}, normalizedUpdates = []) {
  if (packageMeta.application && !looksLikeSysId(packageMeta.application)) {
    return packageMeta.application;
  }

  const updateApplications = normalizedUpdates
    .map((record) => record.application)
    .filter((value) => value && !looksLikeSysId(value));

  return updateApplications[0] || packageMeta.application || packageMeta.scope || '';
}

function scoreGroup(record, group) {
  const haystack = buildRecordSearchText(record);
  return group.hints.reduce((score, hint) => (
    haystack.includes(normalize(hint)) ? score + 1 : score
  ), 0);
}

export function classifyCustomerUpdate(recordInput) {
  const record = normalizeCustomerUpdateRecord(recordInput);
  const ranked = CHANGE_GROUP_DEFINITIONS
    .map((group) => ({ group, score: scoreGroup(record, group) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const fallback = CHANGE_GROUP_DEFINITIONS.find((group) => group.id === 'configuration');

  return {
    ...record,
    groupId: best?.score > 0 ? best.group.id : fallback.id,
    groupLabel: best?.score > 0 ? best.group.label : fallback.label
  };
}

export function groupCustomerUpdates(records = []) {
  const groups = new Map();

  for (const record of records.map(classifyCustomerUpdate)) {
    if (!groups.has(record.groupId)) {
      groups.set(record.groupId, {
        groupId: record.groupId,
        groupLabel: record.groupLabel,
        count: 0,
        records: []
      });
    }

    const entry = groups.get(record.groupId);
    entry.records.push(record);
    entry.count += 1;
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

function inferFunctionalPurpose(groupedUpdates = []) {
  if (!groupedUpdates.length) {
    return 'The package purpose is not yet inferable from the captured change metadata alone.';
  }

  const dominant = groupedUpdates[0];
  const secondary = groupedUpdates[1];

  if (!secondary) {
    return `This package appears to focus mainly on ${dominant.groupLabel.toLowerCase()}.`;
  }

  return `This package appears to combine ${dominant.groupLabel.toLowerCase()} with ${secondary.groupLabel.toLowerCase()}.`;
}

export function buildChangeDocumentationBrief({
  mode = CHANGE_DOCUMENTATION_ACTIONS.updateSet,
  packageMeta = {},
  updates = [],
  questionnaire = {},
  userContext = ''
}) {
  const normalizedQuestionnaire = normalizeQuestionnaireAnswers(questionnaire);
  const normalizedUpdates = updates.map(normalizeCustomerUpdateRecord);
  const groupedUpdates = groupCustomerUpdates(normalizedUpdates);

  return {
    mode,
    packageMeta: {
      sysId: packageMeta.sysId || '',
      name: packageMeta.name || '',
      description: packageMeta.description || '',
      application: resolveApplicationName(packageMeta, normalizedUpdates),
      scope: packageMeta.scope || '',
      state: packageMeta.state || '',
      source: packageMeta.source || ''
    },
    userContext: typeof userContext === 'string' ? userContext.trim() : '',
    questionnaire: normalizedQuestionnaire,
    stats: {
      updateCount: normalizedUpdates.length,
      groupCount: groupedUpdates.length,
      deepUpdateCount: normalizedUpdates.filter((record) => record.deepPayloadFetched).length,
      scriptedUpdateCount: normalizedUpdates.filter((record) => record.scriptPreview).length
    },
    inferredPurpose: inferFunctionalPurpose(groupedUpdates),
    groupedUpdates
  };
}

export function serializeChangeDocumentationBrief(brief) {
  const packageMeta = brief.packageMeta || {};
  const questionnaire = brief.questionnaire || {};
  const groupedUpdates = brief.groupedUpdates || [];
  const userContext = brief.userContext || '';

  const groupedText = groupedUpdates.map((group) => {
    const examples = group.records.slice(0, MAX_RECORD_EXAMPLES_PER_GROUP);
    const remainingCount = Math.max(0, group.records.length - examples.length);
    const items = [
      `Summary: actions = ${summarizeCounts(group.records.map((record) => record.action || 'UPDATE'))}`,
      `Tables: ${summarizeUnique(group.records.map((record) => record.targetTable || record.type))}`,
      `Applications: ${summarizeUnique(group.records.map((record) => record.application))}`
    ];

    examples.forEach((record, index) => {
      items.push(
        `- ${record.type || 'unknown'} | ${record.targetName || record.name || 'Unnamed record'} | table: ${record.targetTable || 'Unknown'} | action: ${record.action || 'UPDATE'}${record.updatedBy ? ` | updated by: ${record.updatedBy}` : ''}`
      );

      if (record.deepTable) {
        items.push(`  deep artifact: ${record.deepTable}${record.deepName ? ` | record: ${record.deepName}` : ''}${record.scriptField ? ` | script field: ${record.scriptField}` : ''}`);
      }

      if (record.fieldSummary?.length) {
        items.push(`  key fields: ${record.fieldSummary.slice(0, 4).join('; ')}`);
      }

      if (index < PAYLOAD_PREVIEW_EXAMPLE_LIMIT && record.payloadPreview) {
        items.push(`  payload preview: ${compactValue(record.payloadPreview)}`);
      }

      if (index < SCRIPT_PREVIEW_EXAMPLE_LIMIT && record.scriptPreview) {
        items.push(`  script preview: ${compactValue(record.scriptPreview, 260)}`);
      }
    });

    if (remainingCount > 0) {
      items.push(`- ${remainingCount} additional ${group.groupLabel.toLowerCase()} updates omitted from the brief for brevity`);
    }

    return [
      `## ${group.groupLabel} (${group.count})`,
      items.join('\n')
    ].join('\n');
  }).join('\n\n');

  return [
    `Mode: ${brief.mode}`,
    `Package name: ${packageMeta.name || 'Unknown'}`,
    `Package sys_id: ${packageMeta.sysId || 'Unknown'}`,
    `Application: ${packageMeta.application || packageMeta.scope || 'Unknown'}`,
    `State: ${packageMeta.state || 'Unknown'}`,
    `Description: ${packageMeta.description || 'Not captured'}`,
    `User-supplied context: ${userContext || 'Not provided'}`,
    `Inferred purpose: ${brief.inferredPurpose}`,
    `Update count: ${brief.stats?.updateCount || 0}`,
    `Deep payload updates captured: ${brief.stats?.deepUpdateCount || 0}`,
    `Updates with script previews: ${brief.stats?.scriptedUpdateCount || 0}`,
    `Questionnaire summary:`,
    `- Functional summary: ${questionnaire.functionalSummary || 'Not provided'}`,
    `- Target audience: ${questionnaire.targetAudience || 'mixed'}`,
    `- Technical depth: ${questionnaire.technicalDepth || 'balanced'}`,
    `- Tone: ${questionnaire.tone || 'internal-delivery'}`,
    `- Known constraints: ${questionnaire.knownConstraints || 'None provided'}`,
    '',
    groupedText || '## Changes\n- No customer updates were captured from the form.'
  ].join('\n');
}

export function recommendCollectionStrategy({
  visibleUpdateCount = 0,
  hasXmlExport = false,
  needsDeepPayload = false
}) {
  if (needsDeepPayload && hasXmlExport) {
    return {
      strategy: 'xml-first',
      reason: 'Deep artifact-level documentation benefits from payload details in exported XML.'
    };
  }

  if (visibleUpdateCount > 0) {
    return {
      strategy: 'list-first',
      reason: 'Visible customer updates provide enough metadata for a first-pass documentation brief.'
    };
  }

  return {
    strategy: hasXmlExport ? 'xml-fallback' : 'list-first',
    reason: hasXmlExport
      ? 'No visible updates were captured, so XML export is the safest fallback.'
      : 'Start from visible update metadata and enrich later if needed.'
  };
}
