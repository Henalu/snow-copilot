// storage/schema.js — Config schema, defaults, and migration helpers

export const ACTIONS = ['explain', 'comment', 'refactor', 'ask'];
export const PROVIDER_IDS = ['anthropic', 'openai', 'gemini', 'openrouter', 'customEndpoint', 'localLlm'];

export const DEFAULT_SETTINGS = {
  autoShow: true,
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
        explain: { providerId: null, modelId: null, isUserOverride: false },
        comment: { providerId: null, modelId: null, isUserOverride: false },
        refactor: { providerId: null, modelId: null, isUserOverride: false },
        ask:     { providerId: null, modelId: null, isUserOverride: false }
      }
    }
  }
};

/** Recursively merge source into target, preserving existing values where source is undefined */
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

/**
 * Migrate from old settings format to new multi-provider format.
 * Preserves existing user config (e.g. backendUrl → customEndpoint.url).
 */
export function migrateSettings(stored) {
  const settings = deepMerge(DEFAULT_SETTINGS, stored);

  // Migrate old backendUrl → customEndpoint.url
  if (stored.backendUrl && !stored.providers?.customEndpoint?.url) {
    settings.providers.customEndpoint.url = stored.backendUrl;
    settings.providers.customEndpoint.enabled = true;
    // If we migrated, set customEndpoint as default provider
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
  // Store the entire settings object. chrome.storage.sync limit is 100KB total / 8KB per key.
  // Splitting providers so each key is small and stays within per-key limit.
  const toStore = {
    autoShow: settings.autoShow,
    providers: settings.providers,
    routing: settings.routing
  };
  await chrome.storage.sync.set(toStore);
}
