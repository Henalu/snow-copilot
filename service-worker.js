// SN Assistant — service-worker.js
// Initializes defaults on install/update, relays sidebar toggle messages,
// and streams AI provider responses to content scripts via ports.

import { sendAction, resolveProviderLabel } from './providers/manager.js';

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.sync.get(null);

  // Build provider defaults, migrating old backendUrl to customEndpoint if needed
  const migratedCustomEndpointUrl  = stored.backendUrl || '';
  const migratedCustomEndpointEnabled = !!stored.backendUrl;

  const providerDefaults = {
    anthropic:     { enabled: false, apiKey: '',  model: 'claude-sonnet-4-6' },
    openai:        { enabled: false, apiKey: '',  model: 'gpt-4o-mini', baseUrl: '' },
    gemini:        { enabled: false, apiKey: '',  model: 'gemini-2.0-flash' },
    openrouter:    { enabled: false, apiKey: '',  model: '', siteName: '' },
    customEndpoint:{ enabled: migratedCustomEndpointEnabled, url: migratedCustomEndpointUrl, apiKey: '', model: '', headersJson: '' },
    localLlm:      { enabled: false, baseUrl: 'http://localhost:11434', model: 'llama3.2' }
  };

  const routingDefaults = {
    defaultProvider: migratedCustomEndpointEnabled ? 'customEndpoint' : null,
    actionRouting: {
      enabled: false,
      actions: {
        explain: { providerId: null, modelId: null, isUserOverride: false },
        comment: { providerId: null, modelId: null, isUserOverride: false },
        refactor: { providerId: null, modelId: null, isUserOverride: false },
        ask:     { providerId: null, modelId: null, isUserOverride: false }
      }
    }
  };

  const toSet = {};
  if (stored.autoShow === undefined) toSet.autoShow = true;
  if (!stored.providers) toSet.providers = providerDefaults;
  if (!stored.routing)   toSet.routing   = routingDefaults;

  if (Object.keys(toSet).length > 0) {
    await chrome.storage.sync.set(toSet);
  }
});

// Relay TOGGLE_SIDEBAR messages from options/popup to the active tab's content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SIDEBAR' });
      }
    });
  }
  return true;
});

// Stream AI responses to content scripts via long-lived ports.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream') return;

  let cancelled = false;
  port.onDisconnect.addListener(() => { cancelled = true; });

  port.onMessage.addListener(async ({ action, code, question, context }) => {
    try {
      const label = await resolveProviderLabel(action);
      if (!cancelled) port.postMessage({ type: 'label', label });

      const stream = await sendAction({ action, code, question, context });
      for await (const chunk of stream) {
        if (cancelled) break;
        port.postMessage({ type: 'chunk', chunk });
      }
      if (!cancelled) port.postMessage({ type: 'done' });
    } catch (err) {
      if (!cancelled) port.postMessage({ type: 'error', message: err.message });
    }
  });
});
