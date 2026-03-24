// storage/schema.js — Config schema, defaults, and migration helpers

import { DEFAULT_RAG_SETTINGS } from '../rag/config.js';

export const ACTIONS = ['explain', 'comment', 'refactor', 'ask', 'document'];
export const PROVIDER_IDS = ['anthropic', 'openai', 'gemini', 'openrouter', 'customEndpoint', 'localLlm'];
export const RESPONSE_LANGUAGES = ['en', 'es'];

function normalizePreferredLanguage(value) {
  return RESPONSE_LANGUAGES.includes(value) ? value : 'en';
}

export const DEFAULT_SETTINGS = {
  autoShow: true,
  preferredLanguage: 'en',
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

export function migrateSettings(stored) {
  const settings = deepMerge(DEFAULT_SETTINGS, stored);
  settings.preferredLanguage = normalizePreferredLanguage(
    stored.preferredLanguage || stored.responseLanguage || settings.preferredLanguage
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

  return settings;
}

export async function loadSettings() {
  const stored = await chrome.storage.sync.get(null);
  return migrateSettings(stored);
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set({
    autoShow: settings.autoShow,
    preferredLanguage: normalizePreferredLanguage(settings.preferredLanguage),
    changeDocumentation: settings.changeDocumentation,
    providers: settings.providers,
    routing: settings.routing,
    rag: settings.rag
  });
}
