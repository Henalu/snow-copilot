// options.js — Settings page controller (ES module)

import { loadSettings, saveSettings, PROVIDER_IDS, ACTIONS } from './storage/schema.js';
import { PROVIDER_META, MODEL_CATALOG, getModelName }         from './providers/catalog.js';
import { computeRecommendations, applyRecommendations, refreshRecommendedFields } from './recommendation/engine.js';
import { anthropicProvider }     from './providers/anthropic.js';
import { openaiProvider }        from './providers/openai.js';
import { geminiProvider }        from './providers/gemini.js';
import { openrouterProvider }    from './providers/openrouter.js';
import { customEndpointProvider }from './providers/customEndpoint.js';
import { localLlmProvider }      from './providers/localLlm.js';

const PROVIDER_ADAPTERS = {
  anthropic:      anthropicProvider,
  openai:         openaiProvider,
  gemini:         geminiProvider,
  openrouter:     openrouterProvider,
  customEndpoint: customEndpointProvider,
  localLlm:       localLlmProvider
};

const ACTION_ICONS  = { explain: '🔍', comment: '💬', refactor: '✨', ask: '❓', document: '📄' };
const ACTION_LABELS = { explain: 'Explain', comment: 'Comment', refactor: 'Refactor', ask: 'Ask', document: 'Document' };

// ─── State ────────────────────────────────────────────────────────────────────

let settings = null; // will be loaded on init

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  settings = await loadSettings();
  renderAll();
  bindStaticEvents();
}

function renderAll() {
  renderBehavior();
  renderProviders();
  renderRouting();
  renderRecommendations();
}

// ─── Behavior section ─────────────────────────────────────────────────────────

function renderBehavior() {
  document.getElementById('autoShow').checked = settings.autoShow ?? true;
}

// ─── Providers section ────────────────────────────────────────────────────────

function renderProviders() {
  for (const id of PROVIDER_IDS) {
    const config = settings.providers?.[id] ?? {};

    // Toggle state
    const enabledEl = document.getElementById(`enabled-${id}`);
    if (enabledEl) enabledEl.checked = !!config.enabled;

    // Fields visibility
    const fieldsEl = document.getElementById(`fields-${id}`);
    if (fieldsEl) fieldsEl.style.display = config.enabled ? 'block' : 'none';

    // Populate fields
    populateProviderFields(id, config);

    // Badge
    updateProviderBadge(id, config);
  }
}

function populateProviderFields(id, config) {
  const setVal = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) el.value = val ?? '';
  };

  switch (id) {
    case 'anthropic':
      setVal('anthropic-apiKey', config.apiKey);
      setVal('anthropic-model', config.model);
      break;
    case 'openai':
      setVal('openai-apiKey', config.apiKey);
      setVal('openai-model', config.model);
      setVal('openai-baseUrl', config.baseUrl);
      break;
    case 'gemini':
      setVal('gemini-apiKey', config.apiKey);
      setVal('gemini-model', config.model);
      break;
    case 'openrouter':
      setVal('openrouter-apiKey', config.apiKey);
      setVal('openrouter-model', config.model);
      setVal('openrouter-siteName', config.siteName);
      break;
    case 'customEndpoint':
      setVal('customEndpoint-url', config.url);
      setVal('customEndpoint-apiKey', config.apiKey);
      setVal('customEndpoint-model', config.model);
      setVal('customEndpoint-headersJson', config.headersJson);
      break;
    case 'localLlm':
      setVal('localLlm-baseUrl', config.baseUrl);
      setVal('localLlm-model', config.model);
      break;
  }
}

function updateProviderBadge(id, config) {
  const badge = document.getElementById(`badge-${id}`);
  if (!badge) return;

  if (PROVIDER_META[id]?.experimental && !config.enabled) {
    badge.textContent = 'Experimental';
    badge.className = 'provider-badge badge-experimental';
    return;
  }

  if (!config.enabled) {
    badge.textContent = 'Disabled';
    badge.className = 'provider-badge badge-disabled';
    return;
  }

  const adapter = PROVIDER_ADAPTERS[id];
  if (adapter?.isConfigured(config)) {
    badge.textContent = 'Configured';
    badge.className = 'provider-badge badge-configured';
  } else {
    badge.textContent = 'Missing key';
    badge.className = 'provider-badge badge-missing';
  }
}

// ─── Routing section ──────────────────────────────────────────────────────────

function renderRouting() {
  renderDefaultProviderDropdown();

  const enabled = settings.routing?.actionRouting?.enabled ?? false;
  document.getElementById('actionRoutingEnabled').checked = enabled;
  document.getElementById('action-routing-section').style.display = enabled ? 'block' : 'none';

  if (enabled) renderActionRoutingTable();
}

function renderDefaultProviderDropdown() {
  const select = document.getElementById('defaultProvider');
  const current = settings.routing?.defaultProvider ?? '';

  select.innerHTML = '<option value="">— None (use first available) —</option>';

  for (const id of PROVIDER_IDS) {
    const config = settings.providers?.[id] ?? {};
    const adapter = PROVIDER_ADAPTERS[id];
    if (!config.enabled || !adapter?.isConfigured(config)) continue;

    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = PROVIDER_META[id]?.name ?? id;
    if (id === current) opt.selected = true;
    select.appendChild(opt);
  }

  if (current && !select.querySelector(`option[value="${current}"]`)) {
    const hint = document.getElementById('default-provider-hint');
    if (hint) hint.textContent = `⚠ Previously selected provider "${current}" is not configured.`;
  }
}

function renderActionRoutingTable() {
  const container = document.getElementById('action-routing-table-container');
  const configuredProviders = getConfiguredProviders();

  if (configuredProviders.length === 0) {
    container.innerHTML = '<p class="no-providers-msg">Enable and configure at least one provider to set up action routing.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'routing-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Action</th>
        <th>Provider</th>
        <th>Model</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="routing-tbody"></tbody>
  `;

  container.innerHTML = '';
  container.appendChild(table);

  const tbody = table.querySelector('#routing-tbody');
  const actions = settings.routing?.actionRouting?.actions ?? {};

  for (const action of ACTIONS) {
    const actionConfig = actions[action] ?? {};
    tbody.appendChild(buildRoutingRow(action, actionConfig, configuredProviders));
  }
}

function buildRoutingRow(action, actionConfig, configuredProviders) {
  const tr = document.createElement('tr');
  tr.dataset.action = action;

  const selectedProvider = actionConfig.providerId || '';
  const selectedModel    = actionConfig.modelId    || '';
  const isOverride       = !!actionConfig.isUserOverride;

  // Provider selector
  const providerSelect = document.createElement('select');
  providerSelect.className = 'routing-select';
  providerSelect.id = `route-provider-${action}`;

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Use default';
  providerSelect.appendChild(defaultOpt);

  for (const id of configuredProviders) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = PROVIDER_META[id]?.name ?? id;
    if (id === selectedProvider) opt.selected = true;
    providerSelect.appendChild(opt);
  }

  // Model selector
  const modelSelect = document.createElement('select');
  modelSelect.className = 'routing-select';
  modelSelect.id = `route-model-${action}`;
  populateModelSelect(modelSelect, selectedProvider, selectedModel);

  // Update model dropdown when provider changes
  providerSelect.addEventListener('change', () => {
    const newProvider = providerSelect.value;
    populateModelSelect(modelSelect, newProvider, '');
    markActionCustom(action);
  });
  modelSelect.addEventListener('change', () => markActionCustom(action));

  // Status badge
  const badge = document.createElement('span');
  badge.className = `provider-badge ${isOverride ? 'badge-custom' : 'badge-auto'}`;
  badge.textContent = isOverride ? 'Custom' : 'Auto';
  badge.id = `route-badge-${action}`;

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn-reset';
  resetBtn.textContent = 'Reset';
  resetBtn.id = `route-reset-${action}`;
  resetBtn.style.display = isOverride ? 'inline-block' : 'none';
  resetBtn.addEventListener('click', () => resetActionToRecommended(action));

  tr.innerHTML = `
    <td><span class="action-label">${ACTION_ICONS[action]} ${ACTION_LABELS[action]}</span></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
  `;

  tr.cells[1].appendChild(providerSelect);
  tr.cells[2].appendChild(modelSelect);
  tr.cells[3].appendChild(badge);
  tr.cells[4].appendChild(resetBtn);

  return tr;
}

function populateModelSelect(select, providerId, selectedModelId) {
  select.innerHTML = '';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Provider default';
  select.appendChild(defaultOpt);

  const models = MODEL_CATALOG[providerId] ?? [];
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    if (m.id === selectedModelId) opt.selected = true;
    select.appendChild(opt);
  }
}

function markActionCustom(action) {
  const badge = document.getElementById(`route-badge-${action}`);
  const resetBtn = document.getElementById(`route-reset-${action}`);
  if (badge) { badge.textContent = 'Custom'; badge.className = 'provider-badge badge-custom'; }
  if (resetBtn) resetBtn.style.display = 'inline-block';
}

function resetActionToRecommended(action) {
  const recs = computeRecommendations(settings.providers);
  const rec = recs?.[action];
  if (!rec) return;

  const providerSelect = document.getElementById(`route-provider-${action}`);
  const modelSelect    = document.getElementById(`route-model-${action}`);
  const badge          = document.getElementById(`route-badge-${action}`);
  const resetBtn       = document.getElementById(`route-reset-${action}`);

  if (providerSelect) providerSelect.value = rec.providerId || '';
  if (modelSelect) {
    populateModelSelect(modelSelect, rec.providerId || '', rec.modelId || '');
    if (rec.modelId) modelSelect.value = rec.modelId;
  }
  if (badge) { badge.textContent = 'Auto'; badge.className = 'provider-badge badge-auto'; }
  if (resetBtn) resetBtn.style.display = 'none';

  // Update internal state
  if (!settings.routing.actionRouting.actions[action]) {
    settings.routing.actionRouting.actions[action] = {};
  }
  settings.routing.actionRouting.actions[action].isUserOverride = false;
}

// ─── Recommendations section ──────────────────────────────────────────────────

function renderRecommendations() {
  const container = document.getElementById('recommendations-container');
  const recs = computeRecommendations(settings.providers);

  if (!recs) {
    container.innerHTML = '<p class="no-providers-msg">Enable and configure providers to see recommendations.</p>';
    return;
  }

  const actions = settings.routing?.actionRouting?.actions ?? {};

  container.innerHTML = '';
  for (const action of ACTIONS) {
    const rec = recs[action];
    const current = actions[action] ?? {};
    const isOverride = !!current.isUserOverride;

    const recProviderName = PROVIDER_META[rec.providerId]?.name ?? rec.providerId ?? '—';
    const recModelName    = getModelName(rec.providerId, rec.modelId);

    const curProviderName = PROVIDER_META[current.providerId]?.name ?? current.providerId ?? recProviderName;
    const curModelName    = getModelName(current.providerId || rec.providerId, current.modelId || rec.modelId);

    const row = document.createElement('div');
    row.className = 'rec-row';
    row.innerHTML = `
      <span class="rec-action">${ACTION_ICONS[action]} ${ACTION_LABELS[action]}</span>
      <div class="rec-detail">
        <div>Recommended: <strong>${recProviderName}</strong> / ${recModelName}</div>
        <div>Current: <strong>${curProviderName}</strong> / ${curModelName}
          <span class="provider-badge ${isOverride ? 'badge-custom' : 'badge-auto'}" style="margin-left:6px">
            ${isOverride ? 'Custom' : 'Auto'}
          </span>
        </div>
      </div>
    `;
    container.appendChild(row);
  }
}

// ─── Helper: get configured providers ────────────────────────────────────────

function getConfiguredProviders() {
  return PROVIDER_IDS.filter(id => {
    const config = settings.providers?.[id] ?? {};
    return config.enabled && PROVIDER_ADAPTERS[id]?.isConfigured(config);
  });
}

// ─── Read form state back to settings object ─────────────────────────────────

function collectSettings() {
  const s = JSON.parse(JSON.stringify(settings)); // deep clone

  s.autoShow = document.getElementById('autoShow').checked;

  // Providers
  for (const id of PROVIDER_IDS) {
    const config = s.providers[id] ?? {};
    config.enabled = document.getElementById(`enabled-${id}`)?.checked ?? false;

    const getVal = elId => document.getElementById(elId)?.value ?? '';

    switch (id) {
      case 'anthropic':
        config.apiKey = getVal('anthropic-apiKey');
        config.model  = getVal('anthropic-model');
        break;
      case 'openai':
        config.apiKey   = getVal('openai-apiKey');
        config.model    = getVal('openai-model');
        config.baseUrl  = getVal('openai-baseUrl');
        break;
      case 'gemini':
        config.apiKey = getVal('gemini-apiKey');
        config.model  = getVal('gemini-model');
        break;
      case 'openrouter':
        config.apiKey    = getVal('openrouter-apiKey');
        config.model     = getVal('openrouter-model');
        config.siteName  = getVal('openrouter-siteName');
        break;
      case 'customEndpoint':
        config.url         = getVal('customEndpoint-url');
        config.apiKey      = getVal('customEndpoint-apiKey');
        config.model       = getVal('customEndpoint-model');
        config.headersJson = getVal('customEndpoint-headersJson');
        break;
      case 'localLlm':
        config.baseUrl = getVal('localLlm-baseUrl');
        config.model   = getVal('localLlm-model');
        break;
    }

    s.providers[id] = config;
  }

  // Routing
  s.routing.defaultProvider = document.getElementById('defaultProvider').value || null;
  const routingEnabled = document.getElementById('actionRoutingEnabled').checked;
  s.routing.actionRouting.enabled = routingEnabled;

  if (routingEnabled) {
    for (const action of ACTIONS) {
      const providerEl = document.getElementById(`route-provider-${action}`);
      const modelEl    = document.getElementById(`route-model-${action}`);
      if (!providerEl) continue;

      const currentAction = s.routing.actionRouting.actions[action] ?? {};
      const newProviderId = providerEl.value || null;
      const newModelId    = modelEl?.value || null;

      // Detect if user changed from the recommended value
      const wasOverride = currentAction.isUserOverride;
      const recProvider = currentAction.recommendedProviderId;
      const recModel    = currentAction.recommendedModelId;
      const isNowOverride = wasOverride ||
        (newProviderId && newProviderId !== recProvider) ||
        (newModelId && newModelId !== recModel);

      s.routing.actionRouting.actions[action] = {
        ...currentAction,
        providerId: newProviderId,
        modelId: newModelId,
        isUserOverride: !!isNowOverride
      };
    }
  }

  return s;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(s) {
  const errors = [];
  const configured = [];

  for (const id of PROVIDER_IDS) {
    const config = s.providers[id];
    if (!config?.enabled) continue;
    const adapter = PROVIDER_ADAPTERS[id];
    if (!adapter?.isConfigured(config)) {
      errors.push(`${PROVIDER_META[id]?.name ?? id} is enabled but missing required fields.`);
    } else {
      configured.push(id);
    }
  }

  if (s.routing.defaultProvider && !configured.includes(s.routing.defaultProvider)) {
    errors.push('Default provider is not configured. Please select a working provider or clear the selection.');
  }

  if (s.routing.actionRouting?.enabled) {
    for (const action of ACTIONS) {
      const ac = s.routing.actionRouting.actions?.[action];
      if (ac?.providerId && !configured.includes(ac.providerId)) {
        errors.push(`${ACTION_LABELS[action]}: selected provider is not configured.`);
      }
    }
  }

  return errors;
}

// ─── Static event bindings ────────────────────────────────────────────────────

function bindStaticEvents() {
  // Prevent toggle label clicks from bubbling up to the provider header (which collapses the card).
  // Replaces the removed inline onclick="event.stopPropagation()" — MV3 CSP forbids inline handlers.
  document.querySelectorAll('.sna-provider-toggle').forEach(label => {
    label.addEventListener('click', e => e.stopPropagation());
  });

  // Provider enable toggles — show/hide fields, update badge, re-render routing
  document.querySelectorAll('.provider-enabled').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const id = toggle.dataset.provider;
      const fieldsEl = document.getElementById(`fields-${id}`);
      if (fieldsEl) fieldsEl.style.display = toggle.checked ? 'block' : 'none';

      // Update badge optimistically based on current field values
      const tmpConfig = collectProviderConfig(id);
      updateProviderBadge(id, tmpConfig);

      // Re-render routing and recommendations
      onProvidersChanged();
    });
  });

  // Provider header click — toggle expand/collapse fields
  document.querySelectorAll('[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const id = header.dataset.toggle;
      const enabledEl = document.getElementById(`enabled-${id}`);
      if (!enabledEl?.checked) return; // only collapsible when enabled
      const fieldsEl = document.getElementById(`fields-${id}`);
      if (fieldsEl) {
        fieldsEl.style.display = fieldsEl.style.display === 'none' ? 'block' : 'none';
      }
    });
  });

  // Show/hide API key
  document.querySelectorAll('[data-showhide]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.showhide);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });

  // Test connection buttons
  document.querySelectorAll('[data-test]').forEach(btn => {
    btn.addEventListener('click', () => testProvider(btn.dataset.test, btn));
  });

  // Action routing toggle
  document.getElementById('actionRoutingEnabled').addEventListener('change', (e) => {
    const section = document.getElementById('action-routing-section');
    section.style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked) renderActionRoutingTable();
  });

  // Save button
  document.getElementById('btnSave').addEventListener('click', saveAll);

  // Smart defaults buttons
  document.getElementById('btnApplyRecommended').addEventListener('click', applyRecommended);
  document.getElementById('btnRecalculate').addEventListener('click', recalculate);

  // Export / import
  document.getElementById('btnExport').addEventListener('click', exportSettings);
  document.getElementById('btnImport').addEventListener('click', () =>
    document.getElementById('importFile').click()
  );
  document.getElementById('importFile').addEventListener('change', importSettings);
}

function collectProviderConfig(id) {
  const config = { ...(settings.providers?.[id] ?? {}) };
  config.enabled = document.getElementById(`enabled-${id}`)?.checked ?? false;
  const getVal = elId => document.getElementById(elId)?.value ?? '';
  switch (id) {
    case 'anthropic':      config.apiKey = getVal('anthropic-apiKey'); break;
    case 'openai':         config.apiKey = getVal('openai-apiKey');    break;
    case 'gemini':         config.apiKey = getVal('gemini-apiKey');    break;
    case 'openrouter':
      config.apiKey = getVal('openrouter-apiKey');
      config.model  = getVal('openrouter-model');
      break;
    case 'customEndpoint': config.url  = getVal('customEndpoint-url'); break;
    case 'localLlm':
      config.baseUrl = getVal('localLlm-baseUrl');
      config.model   = getVal('localLlm-model');
      break;
  }
  return config;
}

function onProvidersChanged() {
  // Rebuild providers snapshot from current form state for live re-renders
  const tmpProviders = {};
  for (const id of PROVIDER_IDS) tmpProviders[id] = collectProviderConfig(id);

  // Re-render default provider dropdown and routing table
  const tmpSettings = { ...settings, providers: tmpProviders };
  const prevSettings = settings;
  settings = tmpSettings;

  renderDefaultProviderDropdown();
  if (document.getElementById('actionRoutingEnabled').checked) {
    renderActionRoutingTable();
  }
  renderRecommendations();

  settings = prevSettings; // restore — real save happens on btnSave
}

// ─── Test connection ──────────────────────────────────────────────────────────

async function testProvider(id, btn) {
  const resultEl = document.getElementById(`test-${id}`);
  if (!resultEl) return;

  btn.disabled = true;
  btn.textContent = 'Testing…';
  resultEl.className = 'test-result';
  resultEl.style.display = 'none';

  const config = collectProviderConfig(id);
  const adapter = PROVIDER_ADAPTERS[id];

  if (!adapter) {
    showTestResult(resultEl, btn, false, 'Unknown provider');
    return;
  }
  if (!adapter.isConfigured(config)) {
    showTestResult(resultEl, btn, false, 'Missing required fields — fill in the form first');
    return;
  }

  try {
    const result = await adapter.testConnection(config);
    showTestResult(resultEl, btn, result.success, result.message);
  } catch (err) {
    showTestResult(resultEl, btn, false, err.message);
  }
}

function showTestResult(el, btn, success, message) {
  el.textContent = (success ? '✓ ' : '✕ ') + message;
  el.className = `test-result ${success ? 'success' : 'error'}`;
  el.style.display = 'block';
  btn.disabled = false;
  btn.textContent = 'Test connection';
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveAll() {
  const collected = collectSettings();
  const errors = validate(collected);

  if (errors.length > 0) {
    showStatus('⚠ ' + errors[0], true);
    return;
  }

  // Auto-refresh recommended fields before saving
  const recs = computeRecommendations(collected.providers);
  if (recs) {
    collected.routing.actionRouting = refreshRecommendedFields(
      collected.routing.actionRouting,
      collected.providers
    );
  }

  await saveSettings(collected);
  settings = collected;

  renderAll(); // re-render to reflect saved state
  showStatus('✓ Settings saved');
}

function showStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = isError ? 'status show error' : 'status show';
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Smart defaults ───────────────────────────────────────────────────────────

function applyRecommended() {
  const collected = collectSettings();
  const recs = computeRecommendations(collected.providers);
  if (!recs) {
    showStatus('⚠ No configured providers to generate recommendations from.', true);
    return;
  }

  collected.routing.actionRouting = applyRecommendations(
    collected.routing.actionRouting,
    recs
  );

  // Merge back into live settings object so re-render picks it up
  settings = collected;
  renderRouting();
  renderRecommendations();
  showStatus('✓ Recommendations applied — click Save to persist');
}

function recalculate() {
  const collected = collectSettings();
  const recs = computeRecommendations(collected.providers);
  if (!recs) {
    showStatus('⚠ No configured providers to generate recommendations from.', true);
    return;
  }

  collected.routing.actionRouting = refreshRecommendedFields(
    collected.routing.actionRouting,
    collected.providers
  );

  settings = collected;
  renderRecommendations();
  if (document.getElementById('actionRoutingEnabled').checked) {
    renderActionRoutingTable();
  }
  showStatus('✓ Recommendations recalculated');
}

// ─── Export / Import ──────────────────────────────────────────────────────────

function exportSettings() {
  const collected = collectSettings();
  const json = JSON.stringify(collected, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sn-assistant-settings.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function importSettings(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    // Merge imported over defaults (migrateSettings handles unknown shapes)
    const { migrateSettings } = await import('./storage/schema.js');
    settings = migrateSettings(imported);
    renderAll();
    showStatus('✓ Settings imported — click Save to apply');
  } catch (err) {
    showStatus('⚠ Import failed: ' + err.message, true);
  }

  // Reset file input so same file can be re-imported
  e.target.value = '';
}

// ─── Run ─────────────────────────────────────────────────────────────────────

init();
