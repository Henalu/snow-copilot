const EN_STOP_WORDS = [
  'a', 'about', 'after', 'all', 'also', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'before', 'between', 'but', 'by', 'can', 'do', 'does', 'for',
  'from', 'get', 'has', 'have', 'how', 'if', 'in', 'into', 'is', 'it', 'its',
  'more', 'not', 'of', 'on', 'or', 'other', 'our', 'out', 'over', 'same',
  'should', 'so', 'such', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'through', 'to', 'too', 'use', 'using',
  'very', 'was', 'what', 'when', 'where', 'which', 'while', 'with', 'would',
  'you', 'your'
];

const ES_STOP_WORDS = [
  'al', 'algo', 'algun', 'alguna', 'algunas', 'algunos', 'ante', 'aqui', 'asi',
  'como', 'con', 'contra', 'cual', 'cuales', 'cuando', 'de', 'del', 'desde',
  'donde', 'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'era', 'es', 'esa',
  'ese', 'eso', 'esta', 'este', 'esto', 'ha', 'hay', 'la', 'las', 'lo', 'los',
  'mas', 'mi', 'mis', 'muy', 'ni', 'no', 'nos', 'o', 'para', 'pero', 'por',
  'porque', 'que', 'se', 'si', 'sin', 'sobre', 'su', 'sus', 'tambien', 'te',
  'tiene', 'tu', 'un', 'una', 'unas', 'unos', 'ya'
];

export const STOP_WORDS = new Set([...EN_STOP_WORDS, ...ES_STOP_WORDS]);

export const SERVICE_NOW_API_PATTERN = /\b(?:AbstractAjaxProcessor|Class\.create|GlideAggregate|GlideAjax|GlideDateTime|GlideDate|GlideElement|GlideQuery|GlideRecord|GlideRecordSecure|GlideSchedule|GlideScopedEvaluator|GlideSystem|GlideURI|GlideUser|Object\.extendsObject|action|current|g_form|g_list|g_modal|g_scratchpad|g_user|gs|helpers\.snHttp|previous|request|response|sn_ws)\b/g;

export const ARTIFACT_HINTS = {
  businessRule: ['business rule', 'business-rule', 'sys_script', 'before insert', 'before update', 'after update', 'current', 'previous'],
  scriptInclude: ['script include', 'script-include', 'class.create', 'object.extendsobject', 'abstractajaxprocessor'],
  clientScript: ['client script', 'client-side', 'g_form', 'g_user', 'glideajax', 'onchange', 'onload', 'onsubmit'],
  uiAction: ['ui action', 'ui-action', 'sys_ui_action', 'action.setredirecturl', 'action.getglideuri', 'onclick'],
  scriptedRest: ['scripted rest', 'scripted-rest', 'rest resource', 'sys_ws_operation', 'request', 'response', 'api'],
  workspace: ['workspace', 'workspaces', 'agent workspace', 'declarative action', 'declarative actions', 'record watcher'],
  uiBuilder: ['ui builder', 'ui-builder', 'helpers.snhttp', 'event handler', 'component state'],
  scheduledScript: ['scheduled script', 'sysauto_script', 'job context', 'scheduled job'],
  transformScript: ['transform map', 'transform script', 'onbefore', 'onafter', 'source script', 'target script'],
  flow: ['flow designer', 'subflow', 'action designer', 'flow']
};

export const CATEGORY_HINTS = {
  awa: ['awa', 'advanced work assignment', 'assignment'],
  cmdb: ['cmdb', 'configuration item', 'ci'],
  'assignment-engine': ['assignment', 'assignment engine'],
  integraciones: ['integration', 'integraciones', 'rest', 'soap', 'excel'],
  'business-rules': ['business rule', 'business-rules', 'sys_script'],
  'transform-maps': ['transform map', 'transform-maps', 'import set'],
  'ui-actions': ['ui action', 'ui-actions', 'sys_ui_action'],
  workspaces: ['workspace', 'agent workspace', 'workspaces'],
  'ui-builder': ['ui builder', 'ui-builder', 'workspace component']
};

export const CONTEXT_TABLE_HINTS = {
  sys_script: ['business rule', 'sys_script'],
  sys_script_include: ['script include', 'sys_script_include'],
  sys_script_client: ['client script', 'sys_script_client'],
  sys_script_fix: ['fix script', 'sys_script_fix'],
  sys_ui_action: ['ui action', 'sys_ui_action'],
  sys_ui_script: ['ui script', 'sys_ui_script'],
  sys_ws_operation: ['scripted rest', 'sys_ws_operation', 'rest resource'],
  sys_transform_script: ['transform script', 'sys_transform_script'],
  sys_transform_map: ['transform map', 'sys_transform_map'],
  sysauto_script: ['scheduled script', 'sysauto_script'],
  background: ['background script']
};

export function stripDiacritics(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(value = '') {
  return stripDiacritics(String(value).toLowerCase())
    .replace(/[_./]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function tokenizeText(value = '', options = {}) {
  const {
    minLength = 3,
    preserve = []
  } = options;

  const preserved = unique((preserve || []).map((item) => normalizeText(item)).filter(Boolean));
  const normalized = normalizeText(value);
  const rawTokens = normalized.split(' ').filter(Boolean);

  return unique([
    ...preserved,
    ...rawTokens.filter((token) => token.length >= minLength && !STOP_WORDS.has(token))
  ]);
}

export function collectServiceNowApis(value = '') {
  return unique(String(value).match(SERVICE_NOW_API_PATTERN) || [])
    .map((token) => normalizeText(token))
    .filter(Boolean);
}

function collectHintMatches(hintMap, haystack) {
  const normalizedHaystack = normalizeText(haystack);
  return Object.entries(hintMap)
    .filter(([, hints]) => hints.some((hint) => normalizedHaystack.includes(normalizeText(hint))))
    .map(([key]) => key);
}

export function inferScope(haystack = '') {
  const normalized = normalizeText(haystack);
  const scopes = [];

  if (
    normalized.includes('g form') ||
    normalized.includes('glideajax') ||
    normalized.includes('client script') ||
    normalized.includes('client-side')
  ) {
    scopes.push('client');
  }

  if (
    normalized.includes('current') ||
    normalized.includes('previous') ||
    normalized.includes('gliderecord') ||
    normalized.includes('abstractajaxprocessor') ||
    normalized.includes('server')
  ) {
    scopes.push('server');
  }

  if (normalized.includes('workspace')) scopes.push('workspace');
  if (normalized.includes('ui builder') || normalized.includes('helpers snhttp')) scopes.push('ui-builder');

  if (scopes.length === 0) scopes.push('general');
  return unique(scopes);
}

export function inferArtifactTypes(haystack = '', category = '') {
  return unique([
    ...collectHintMatches(ARTIFACT_HINTS, haystack),
    ...collectHintMatches(CATEGORY_HINTS, category)
  ]);
}

export function excerptText(value = '', maxLength = 240) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).trimEnd() + '...';
}
