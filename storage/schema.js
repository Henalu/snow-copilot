// storage/schema.js — Config schema, defaults, and migration helpers

import { DEFAULT_RAG_SETTINGS } from '../rag/config.js';

export const ACTIONS = ['explain', 'comment', 'refactor', 'ask', 'document'];
export const PROVIDER_IDS = ['anthropic', 'openai', 'gemini', 'openrouter', 'customEndpoint', 'localLlm'];
export const RESPONSE_LANGUAGES = ['en', 'es'];
export const COMMAND_PALETTE_ALIAS_REGEX = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const COMMAND_PALETTE_RESERVED_ALIASES = ['help', 'ask', 'explain', 'comment', 'refactor', 'document', 'docset', 'imp'];
export const PROVIDER_SECRET_FIELDS = {
  anthropic: ['apiKey'],
  openai: ['apiKey'],
  gemini: ['apiKey'],
  openrouter: ['apiKey'],
  customEndpoint: ['apiKey', 'headersJson'],
  localLlm: []
};

const LOCAL_PROVIDER_SECRETS_KEY = 'providerSecrets';

export const DEFAULT_COMMAND_PALETTE_SETTINGS = {
  confirmImpersonation: true,
  customCommands: []
};

function normalizePreferredLanguage(value) {
  return RESPONSE_LANGUAGES.includes(value) ? value : 'en';
}

export const DEFAULT_SETTINGS = {
  autoShow: true,
  preferredLanguage: 'en',
  commandPalette: DEFAULT_COMMAND_PALETTE_SETTINGS,
  changeDocumentation: {
    updateSetMode: 'list',
    deepFetchLimit: 12,
    deepFetchConcurrency: 3
  },
  providers: {
    anthropic:     { enabled: false, apiKey: '',  model: 'claude-sonnet-4-6' },
    openai:        { enabled: false, apiKey: '',  model: 'gpt-4o-mini', baseUrl: '' },
    gemini:        { enabled: false, apiKey: '',  model: 'gemini-2.0-flash' },
    openrouter:    { enabled: false, apiKey: '',  model: '', siteName: '' },
    customEndpoint:{ enabled: false, url: '',     apiKey: '', model: '', headersJson: '' },
    localLlm:      { enabled: false, baseUrl: 'http://localhost:11434', model: 'llama3.2' }
  },
  routing: {
    defaultProvider: null,
    actionRouting: {
      enabled: false,
      actions: {
        explain:  { providerId: null, modelId: null, isUserOverride: false },
        comment:  { providerId: null, modelId: null, isUserOverride: false },
        refactor: { providerId: null, modelId: null, isUserOverride: false },
        ask:      { providerId: null, modelId: null, isUserOverride: false },
        document: { providerId: null, modelId: null, isUserOverride: false }
      }
    }
  },
  rag: DEFAULT_RAG_SETTINGS
};

function deepMerge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source ?? target;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target?.[key] ?? {}, source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

function isSafeCommandUrlTemplate(template) {
  if (typeof template !== 'string') return false;
  const trimmed = template.trim();
  if (!trimmed) return false;
  if (/^(?:https?|javascript|data|chrome|about|file):/i.test(trimmed)) return false;
  if (trimmed.startsWith('//')) return false;

  try {
    const resolved = new URL(
      trimmed.replace(/\{\{origin\}\}/g, 'https://example.service-now.com'),
      'https://example.service-now.com'
    );
    return resolved.origin === 'https://example.service-now.com';
  } catch {
    return false;
  }
}

function normalizeCustomCommand(raw, seenAliases) {
  if (!raw || typeof raw !== 'object') return null;

  const alias = String(raw.alias || '').trim().replace(/^\//, '').toLowerCase();
  if (!COMMAND_PALETTE_ALIAS_REGEX.test(alias)) return null;
  if (COMMAND_PALETTE_RESERVED_ALIASES.includes(alias)) return null;
  if (seenAliases.has(alias)) return null;

  const title = String(raw.title || '').trim();
  const description = String(raw.description || '').trim();
  const urlTemplate = String(raw.urlTemplate || '').trim();
  if (!title || !urlTemplate || !isSafeCommandUrlTemplate(urlTemplate)) return null;

  const id = String(raw.id || `cmd_${alias}`).trim() || `cmd_${alias}`;
  seenAliases.add(alias);

  return {
    id,
    alias,
    title,
    description,
    urlTemplate
  };
}

export function normalizeCommandPaletteSettings(raw = {}) {
  const seenAliases = new Set();
  const customCommands = Array.isArray(raw.customCommands)
    ? raw.customCommands
        .map((command) => normalizeCustomCommand(command, seenAliases))
        .filter(Boolean)
    : [];

  return {
    confirmImpersonation: raw.confirmImpersonation !== false,
    customCommands
  };
}

function buildEmptyProviderSecrets() {
  const secrets = {};
  for (const providerId of PROVIDER_IDS) {
    secrets[providerId] = {};
    for (const field of PROVIDER_SECRET_FIELDS[providerId] || []) {
      secrets[providerId][field] = '';
    }
  }
  return secrets;
}

function extractProviderSecrets(providers = {}) {
  const secrets = buildEmptyProviderSecrets();
  for (const providerId of PROVIDER_IDS) {
    const provider = providers[providerId] || {};
    for (const field of PROVIDER_SECRET_FIELDS[providerId] || []) {
      secrets[providerId][field] = provider[field] ?? '';
    }
  }
  return secrets;
}

function stripProviderSecrets(providers = {}) {
  const sanitizedProviders = {};
  for (const providerId of PROVIDER_IDS) {
    sanitizedProviders[providerId] = { ...(providers[providerId] || {}) };
    for (const field of PROVIDER_SECRET_FIELDS[providerId] || []) {
      sanitizedProviders[providerId][field] = '';
    }
  }
  return sanitizedProviders;
}

function mergeProviderSecrets(providers = {}, storedSecrets = {}) {
  const mergedProviders = {};

  for (const providerId of PROVIDER_IDS) {
    const provider = { ...(providers[providerId] || {}) };
    const providerSecrets = storedSecrets?.[providerId] || {};

    for (const field of PROVIDER_SECRET_FIELDS[providerId] || []) {
      const localSecret = providerSecrets[field];
      if (typeof localSecret === 'string' && localSecret.length > 0) {
        provider[field] = localSecret;
      } else if (provider[field] == null) {
        provider[field] = '';
      }
    }

    mergedProviders[providerId] = provider;
  }

  return mergedProviders;
}

export function migrateSettings(stored = {}, localState = {}) {
  const settings = deepMerge(DEFAULT_SETTINGS, stored);
  settings.preferredLanguage = normalizePreferredLanguage(
    stored.preferredLanguage || stored.responseLanguage || settings.preferredLanguage
  );
  settings.commandPalette = normalizeCommandPaletteSettings(
    deepMerge(DEFAULT_COMMAND_PALETTE_SETTINGS, stored.commandPalette || {})
  );
  settings.changeDocumentation = {
    ...DEFAULT_SETTINGS.changeDocumentation,
    ...(stored.changeDocumentation || {})
  };
  if (!['list', 'deep'].includes(settings.changeDocumentation.updateSetMode)) {
    settings.changeDocumentation.updateSetMode = DEFAULT_SETTINGS.changeDocumentation.updateSetMode;
  }

  if (stored.backendUrl && !stored.providers?.customEndpoint?.url) {
    settings.providers.customEndpoint.url = stored.backendUrl;
    settings.providers.customEndpoint.enabled = true;
    if (!settings.routing.defaultProvider) {
      settings.routing.defaultProvider = 'customEndpoint';
    }
  }

  settings.providers = mergeProviderSecrets(
    settings.providers,
    localState?.[LOCAL_PROVIDER_SECRETS_KEY] || {}
  );

  return settings;
}

export async function loadSettings() {
  const [storedSync, storedLocal] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get(LOCAL_PROVIDER_SECRETS_KEY)
  ]);
  return migrateSettings(storedSync, storedLocal);
}

export async function saveSettings(settings) {
  await Promise.all([
    chrome.storage.sync.set({
      autoShow: settings.autoShow,
      preferredLanguage: normalizePreferredLanguage(settings.preferredLanguage),
      commandPalette: normalizeCommandPaletteSettings(settings.commandPalette),
      changeDocumentation: settings.changeDocumentation,
      providers: stripProviderSecrets(settings.providers),
      routing: settings.routing,
      rag: settings.rag
    }),
    chrome.storage.local.set({
      [LOCAL_PROVIDER_SECRETS_KEY]: extractProviderSecrets(settings.providers)
    })
  ]);
}
