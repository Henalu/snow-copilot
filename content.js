// SN Assistant — content.js
// Detects Monaco editors in ServiceNow and injects the assistant sidebar panel.
// Classic script (no ES modules) — required to bypass ServiceNow's strict CSP.

const SN_ASSISTANT_ID = 'sn-assistant-sidebar';
const SN_TRIGGER_ID   = 'sna-trigger-btn';
const ACTION_TIMEOUT_MS = 180000;
const ACTION_TIMEOUTS_MS = {
  documentUpdateSet: 420000
};
const MAX_MARKDOWN_RENDER_CHARS = 24000;

let activeStreamPort = null;
let activeStreamTimer = null;
let activeStreamAction = null;
let currentExecutionTrace = null;

function isExtensionContextInvalidatedError(error) {
  return /Extension context invalidated/i.test(String(error?.message || error || ''));
}

function getFriendlyRuntimeErrorMessage(error) {
  if (isExtensionContextInvalidatedError(error)) {
    return 'The extension was reloaded or updated. Refresh this ServiceNow tab and try again.';
  }

  return error?.message || 'Could not communicate with the extension background service.';
}

function connectRuntimePort(name) {
  try {
    if (!chrome?.runtime?.id) {
      throw new Error('Extension context invalidated.');
    }

    return chrome.runtime.connect({ name });
  } catch (error) {
    throw new Error(getFriendlyRuntimeErrorMessage(error));
  }
}

// ─── Record type registry ─────────────────────────────────────────────────────
// Maps ServiceNow table names → human label + expected Monaco textarea field name.
// Extend this object to support new record types without touching detection logic.

const RECORD_TYPE_MAP = {
  'sys_script':           { label: 'Business Rule',     scriptField: 'script' },
  'sys_script_include':   { label: 'Script Include',    scriptField: 'script' },
  'sys_script_client':    { label: 'Client Script',     scriptField: 'script' },
  'sys_script_fix':       { label: 'Fix Script',        scriptField: 'script' },
  'sys_ui_action':        { label: 'UI Action',         scriptField: 'script' },
  'sys_ui_script':        { label: 'UI Script',         scriptField: 'script' },
  'sys_ws_operation':     { label: 'Scripted REST API', scriptField: 'operation_script' },
  'sys_transform_map':    { label: 'Transform Map',     scriptField: 'script' },
  'sys_transform_script': { label: 'Transform Script',  scriptField: 'script' },
  'sysauto_script':       { label: 'Scheduled Script',  scriptField: 'script' },
  'sys_api_stats_script': { label: 'Scheduled Script',  scriptField: 'script' },
  'sys_update_set':       { label: 'Update Set',        scriptField: null },
};

// Selectors for the hidden textarea that Monaco uses to sync content to the form.
// ServiceNow generates these as: id="{table}.{fieldname}", name="{table}.{fieldname}".
const SCRIPT_TEXTAREA_SELECTORS = [
  'textarea[id$=".script"]',            // covers sys_script, sys_script_include, sys_script_client, sys_ui_action…
  'textarea[id$=".operation_script"]',  // sys_ws_operation (Scripted REST API)
  'textarea[id$=".action_script"]',     // legacy UI Actions in older SN releases
];

// ─── Record type detection ────────────────────────────────────────────────────

function detectRecordType() {
  const url = window.location.href;

  // Background Script has a special URL pattern, not a standard form URL
  if (url.includes('$background_script')) {
    return { table: 'background', label: 'Background Script', scriptField: null, isKnown: true };
  }

  // Standard form: /{table}.do?sys_id=...
  const tableMatch = url.match(/\/([a-z_]+)\.do/);
  if (tableMatch) {
    const table = tableMatch[1];
    const meta  = RECORD_TYPE_MAP[table];
    return {
      table,
      label:       meta ? meta.label       : table,
      scriptField: meta ? meta.scriptField : 'script',
      isKnown:     !!meta,
    };
  }

  return { table: 'unknown', label: 'unknown', scriptField: 'script', isKnown: false };
}

// Kept for backward compatibility — service worker and sidebar both consume this shape.
function getPageContext() {
  const url      = window.location.href;
  const hostname = window.location.hostname;
  const sysIdMatch = url.match(/sys_id=([a-f0-9]{32})/);
  const sysId    = sysIdMatch ? sysIdMatch[1] : null;
  const record   = detectRecordType();

  return { hostname, table: record.table, sysId, scriptType: record.label, url };
}

// ─── Shadow DOM helper ────────────────────────────────────────────────────────
// document.querySelector() does not cross shadow root boundaries.
// Polaris web components may render form fields inside shadow roots,
// so we traverse them as a last resort.

function querySelectorDeep(selector, root) {
  root = root || document;
  const direct = root.querySelector(selector);
  if (direct) return direct;

  const all = root.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].shadowRoot) {
      const found = querySelectorDeep(selector, all[i].shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

// ─── Editor detection ─────────────────────────────────────────────────────────
// Returns a descriptor object describing where the editor was found, or null.
// Strategies are ordered by reliability and cost (cheapest first).

function detectScriptEditor() {
  // Strategy 1 — Hidden textarea backing Monaco (most reliable across all SN types).
  // Monaco keeps the form textarea in sync; reading it avoids the Monaco API entirely.
  for (const sel of SCRIPT_TEXTAREA_SELECTORS) {
    const ta = document.querySelector(sel);
    if (ta) return { type: 'textarea', el: ta };
  }

  // Strategy 2 — Monaco instances exposed as window globals by ServiceNow.
  // ServiceNow stores refs as window['{something}_editor'] after editor init.
  for (const key of Object.keys(window)) {
    if (!key.endsWith('_editor')) continue;
    const candidate = window[key];
    if (!candidate) continue;

    // IStandaloneCodeEditor: has getValue() directly
    if (typeof candidate.getValue === 'function') {
      return { type: 'monaco-global', editor: candidate };
    }
    // Wrapped editor that exposes the underlying ITextModel via getModel()
    if (typeof candidate.getModel === 'function') {
      const model = candidate.getModel();
      if (model && typeof model.getValue === 'function') {
        return { type: 'monaco-wrapped', model };
      }
    }
  }

  // Strategy 3 — Monaco global API: getEditors() (active ICodeEditor instances).
  // More targeted than getModels() because it returns editors currently in the DOM.
  if (window.monaco && window.monaco.editor) {
    const editors = typeof window.monaco.editor.getEditors === 'function'
      ? window.monaco.editor.getEditors()
      : [];
    for (const ed of editors) {
      if (typeof ed.getValue === 'function') {
        return { type: 'monaco-api-editor', editor: ed };
      }
    }

    // Strategy 4 — Monaco global API: getModels().
    // Returns all loaded text models; prefer the one that looks like server-side JS.
    const models = window.monaco.editor.getModels();
    if (models && models.length > 0) {
      // Skip SN framework models (glide, _list, etc.) if possible
      const scriptModel = models.find(function(m) {
        const path = m.uri && m.uri.path ? m.uri.path : '';
        return !path.includes('glide') && !path.includes('_list') && !path.includes('angular');
      }) || models[0];
      return { type: 'monaco-api-model', model: scriptModel };
    }
  }

  // Strategy 5 — Shadow DOM traversal (expensive, Polaris last resort).
  // Only runs when all lighter strategies have failed.
  for (const sel of SCRIPT_TEXTAREA_SELECTORS) {
    const ta = querySelectorDeep(sel);
    if (ta) return { type: 'textarea-shadow', el: ta };
  }

  return null;
}

// ─── Code extraction ──────────────────────────────────────────────────────────

function extractCode() {
  const detected = detectScriptEditor();
  if (!detected) return null;

  let code = null;
  switch (detected.type) {
    case 'textarea':
    case 'textarea-shadow':
      code = detected.el.value;
      break;
    case 'monaco-global':
    case 'monaco-api-editor':
      code = detected.editor.getValue();
      break;
    case 'monaco-wrapped':
    case 'monaco-api-model':
      code = detected.model.getValue();
      break;
  }
  return code && code.trim() ? code : null;
}

// hasCodeEditor() is used by the polling loop — returns true only when
// an editor is present AND has loaded non-empty content (Monaco initialised).
function hasCodeEditor() {
  return extractCode() !== null;
}

function findFieldBySuffix(suffixes) {
  for (const suffix of suffixes) {
    const selectors = [
      `input[id$=".${suffix}"]`,
      `textarea[id$=".${suffix}"]`,
      `select[id$=".${suffix}"]`,
      `input[name$=".${suffix}"]`,
      `textarea[name$=".${suffix}"]`,
      `select[name$=".${suffix}"]`
    ];

    for (const selector of selectors) {
      const field = document.querySelector(selector) || querySelectorDeep(selector);
      if (field) return field;
    }
  }

  return null;
}

function hasUpdateSetForm() {
  if (detectRecordType().table !== 'sys_update_set') return false;

  return !!findFieldBySuffix([
    'name',
    'state',
    'description',
    'short_description',
    'application',
    'application_name',
    'scope'
  ]);
}

function isUpdateSetContext() {
  return hasUpdateSetForm();
}

function hasRelevantAssistantContext() {
  return hasCodeEditor() || isUpdateSetContext();
}

function getVisibleActions() {
  return isUpdateSetContext()
    ? [{ id: 'documentUpdateSet', label: 'Document UpdateSet', icon: '🧾', documentStyle: true, badge: 'List-first' }]
    : [
        { id: 'explain', label: 'Explain', icon: '🔍' },
        { id: 'comment', label: 'Comment', icon: '💬' },
        { id: 'refactor', label: 'Refactor', icon: '✨' },
        { id: 'ask', label: 'Ask', icon: '❓' },
        { id: 'document', label: 'Document', icon: '📄', documentStyle: true, badge: '↓ .doc' }
      ];
}

function buildActionButtonsMarkup() {
  return getVisibleActions().map((action) => {
    const className = action.documentStyle
      ? 'sna-action-btn sna-action-btn--document'
      : 'sna-action-btn';
    const badgeMarkup = action.badge
      ? `<span class="sna-doc-badge">${action.badge}</span>`
      : '';

    return `
      <button class="${className}" data-action="${action.id}">
        <span class="sna-action-icon">${action.icon}</span>
        <span>${action.label}</span>
        ${badgeMarkup}
      </button>
    `;
  }).join('');
}

// ─── Sidebar panel ────────────────────────────────────────────────────────────

function createSidebar() {
  if (document.getElementById(SN_ASSISTANT_ID)) return;
  const isUpdateSet = isUpdateSetContext();
  const contextPlaceholder = isUpdateSet
    ? 'Add functional or technical context for this Update Set'
    : 'Ask anything about this script...';

  const sidebar = document.createElement('div');
  sidebar.id = SN_ASSISTANT_ID;
  sidebar.innerHTML = `
    <div class="sna-header">
      <div class="sna-header-left">
        <span class="sna-logo">⚡</span>
        <span class="sna-title">SN Assistant</span>
      </div>
      <div class="sna-header-right">
        <span class="sna-context" id="sna-context-label"></span>
        <button class="sna-reset-pos" id="sna-reset-pos" title="Reset position &amp; size">⊞</button>
        <button class="sna-close" id="sna-close" title="Cerrar">×</button>
      </div>
    </div>

    <div class="sna-body" id="sna-body">
      <div class="sna-actions">
        ${buildActionButtonsMarkup()}
      </div>

      <div class="sna-ask-box" id="sna-ask-box" style="display:${isUpdateSet ? 'flex' : 'none'};">
        <textarea
          id="sna-question-input"
          class="sna-textarea"
          placeholder="${contextPlaceholder}"
          rows="3"
        ></textarea>
        <button class="sna-send-btn" id="sna-send-question" style="display:${isUpdateSet ? 'none' : 'inline-flex'};">Send</button>
      </div>

      <div class="sna-response-area" id="sna-response-area">
        <div class="sna-placeholder" id="sna-placeholder">
          <p>${isUpdateSet ? 'Generate change documentation for this Update Set and its visible Customer Updates.' : 'Select an action to analyze the current script.'}</p>
        </div>
        <div class="sna-loading" id="sna-loading" style="display:none;">
          <div class="sna-spinner"></div>
          <span>Analyzing...</span>
        </div>
        <div class="sna-execution-trace" id="sna-execution-trace" style="display:none;"></div>
        <div class="sna-response" id="sna-response" style="display:none;"></div>
        <div class="sna-grounding" id="sna-grounding" style="display:none;"></div>
      </div>

      <div class="sna-footer">
        <span class="sna-model" id="sna-model-label">SN Assistant</span>
        <button class="sna-copy-btn" id="sna-copy" style="display:none;" title="Copy response">Copy</button>
      </div>
    </div>
  `;

  document.body.appendChild(sidebar);
  initSidebarEvents(sidebar);
  initDragResize(sidebar);
  updateContextLabel();
}

function updateContextLabel() {
  const ctx = getPageContext();
  const label = document.getElementById('sna-context-label');
  if (label && ctx.scriptType !== 'unknown') {
    label.textContent = ctx.scriptType;
  }
}

// ─── Sidebar events ───────────────────────────────────────────────────────────

function initSidebarEvents(sidebar) {
  document.getElementById('sna-close').addEventListener('click', () => {
    cancelActiveStream();
    sidebar.remove();
    document.getElementById(SN_TRIGGER_ID)?.classList.remove('active');
  });

  const askBox = document.getElementById('sna-ask-box');
  const questionInput = document.getElementById('sna-question-input');
  const isUpdateSet = isUpdateSetContext();
  const actionBtns = sidebar.querySelectorAll('.sna-action-btn');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;

      actionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (action === 'ask') {
        askBox.style.display = 'flex';
      } else if (action === 'documentUpdateSet') {
        askBox.style.display = 'flex';
        runAction(action, questionInput.value.trim());
      } else {
        askBox.style.display = 'none';
        runAction(action);
      }
    });
  });

  document.getElementById('sna-send-question').addEventListener('click', () => {
    const question = questionInput.value.trim();
    if (question) runAction('ask', question);
  });

  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      const question = e.target.value.trim();
      if (!question) return;
      if (isUpdateSet) {
        runAction('documentUpdateSet', question);
      } else {
        runAction('ask', question);
      }
    }
  });

  document.getElementById('sna-copy').addEventListener('click', () => {
    const responseEl = document.getElementById('sna-response');
    navigator.clipboard.writeText(responseEl.innerText);
    const btn = document.getElementById('sna-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}

// ─── Action execution ─────────────────────────────────────────────────────────

function runAction(action, question = '') {
  runActionInternal(action, question).catch((error) => {
    clearActiveStreamState();
    if (action === 'documentUpdateSet') {
      finalizeExecutionTrace('error', error?.message || 'The update set action failed before generation started.');
    }
    showError(error?.message || 'Unexpected error while running the action.');
  });
}

async function runActionInternal(action, question = '') {
  if (isSidebarBusy()) {
    updateLoadingLabel('An action is already running...');
    return;
  }

  let code = '';
  const context = getPageContext();
  const isBackgroundOnlyAction = action === 'documentUpdateSet';

  if (action === 'documentUpdateSet') {
    beginExecutionTrace(action, {
      summary: 'Collecting Update Set metadata and visible Customer Updates.'
    });
    clearGrounding();
    showLoading('Collecting update set details...');
    setSidebarBusy(true);

    const collectionStartedAt = Date.now();
    const changeDocumentationSettings = await loadChangeDocumentationSettings();
    addExecutionTraceStep({
      phase: 'collect-config',
      label: 'Documentation mode resolved',
      elapsedMs: Date.now() - collectionStartedAt,
      meta: {
        mode: changeDocumentationSettings.updateSetMode,
        deepFetchLimit: changeDocumentationSettings.deepFetchLimit,
        deepFetchConcurrency: changeDocumentationSettings.deepFetchConcurrency
      }
    });

    const packageData = await collectUpdateSetData(changeDocumentationSettings, (progress) => {
      addExecutionTraceStep(progress);
    });
    if (!packageData) {
      clearActiveStreamState();
      finalizeExecutionTrace('error', 'Could not capture the Update Set form or visible related updates.');
      showError('Could not read this Update Set form. Make sure the record and the Customer Updates related list are visible.');
      return;
    }
    packageData.userContext = typeof question === 'string' ? question.trim() : '';
    context.packageData = packageData;
    addExecutionTraceStep({
      phase: 'collect',
      label: 'Captured Update Set data',
      elapsedMs: Date.now() - collectionStartedAt,
      meta: {
        mode: packageData.diagnostics?.collectionMode ?? 'list',
        updateCount: packageData.customerUpdates.length,
        groupableUpdates: packageData.customerUpdates.length,
        documentCount: packageData.diagnostics?.documentCount ?? 0,
        matchedTables: packageData.diagnostics?.tableCount ?? 0,
        rawRows: packageData.diagnostics?.rawRowCount ?? 0,
        dedupedRows: packageData.diagnostics?.dedupedCount ?? 0,
        deepCandidates: packageData.diagnostics?.deepCandidates ?? 0,
        deepFetched: packageData.diagnostics?.deepFetchedCount ?? 0,
        deepFailed: packageData.diagnostics?.deepFailedCount ?? 0,
        userContextChars: packageData.userContext.length
      }
    });
    updateLoadingLabel('Generating update set documentation...');
  } else {
    clearExecutionTrace();
    code = extractCode();
    if (!code) {
      showError('No script detected on this page. Make sure a script editor is open.');
      return;
    }
    clearGrounding();
    showLoading(action === 'document' ? 'Generating documentation...' : null);
    setSidebarBusy(true);
  }

  let port;
  try {
    port = connectRuntimePort('ai-stream');
  } catch (error) {
    clearActiveStreamState();
    throw new Error(getFriendlyRuntimeErrorMessage(error));
  }

  trackActiveStream(port, action);
  const responseChunks = [];

  port.onMessage.addListener((msg) => {
    if (msg.type !== 'done' && msg.type !== 'error') {
      refreshActiveStreamTimeout(port, action);
    } else {
      clearActiveStreamTimer();
    }

    if (msg.type === 'label') {
      const el = document.getElementById('sna-model-label');
      if (el) el.textContent = msg.label;
    } else if (msg.type === 'progress') {
      if (isBackgroundOnlyAction) {
        handleExecutionProgress(msg);
      }
    } else if (msg.type === 'retrieval') {
      if (!isBackgroundOnlyAction) renderGrounding(msg.retrieval);
    } else if (msg.type === 'chunk') {
      responseChunks.push(msg.chunk);
      if (!isBackgroundOnlyAction) {
        if (responseChunks.length === 1) showResponse('');
        appendResponseChunk(msg.chunk);
      }
    } else if (msg.type === 'done') {
      const finalText = typeof msg.fullText === 'string' ? msg.fullText : responseChunks.join('');
      port.disconnect();
      if (action === 'documentUpdateSet') {
        addExecutionTraceStep({
          phase: 'download',
          label: 'Preparing Word download',
          meta: {
            outputChars: finalText.length
          }
        });
        updateLoadingLabel('Preparing Word download...');
        setTimeout(() => {
          try {
            const filename = generateWordDoc(finalText, context);
            clearActiveStreamState(port);
            finalizeExecutionTrace('done', 'Word document generated successfully.', {
              filename,
              outputChars: finalText.length
            });
            showDownloadSuccess(filename, 'Update Set documentation downloaded successfully.');
          } catch (err) {
            console.error('[SN Assistant] Word download failed', err);
            clearActiveStreamState(port);
            finalizeExecutionTrace('error', `Word download failed: ${err.message || 'Unknown error'}`);
            showError(`Could not download the Word document: ${err.message || 'Unknown error'}`);
          }
        }, 50);
        return;
      }

      finalizeResponse(finalText);
      clearActiveStreamState(port);
      if (action === 'document') {
        // Defer doc generation: let the browser paint the rendered response first,
        // then build the Blob off the main thread tick to avoid freezing the tab.
        setTimeout(() => {
          try {
            const filename = generateWordDoc(finalText, context);
            const notice = document.createElement('p');
            notice.className = 'sna-download-notice';
            notice.textContent = '📥 Downloaded: ' + filename;
            const responseEl = document.getElementById('sna-response');
            if (responseEl) responseEl.appendChild(notice);
          } catch (err) {
            console.error('[SN Assistant] Word download failed', err);
            showError(`Could not download the Word document: ${err.message || 'Unknown error'}`);
          }
        }, 50);
      }
    } else if (msg.type === 'error') {
      clearActiveStreamState(port);
      if (isBackgroundOnlyAction) {
        finalizeExecutionTrace('error', msg.message || 'The update set action failed.');
      }
      showError(msg.message);
      port.disconnect();
    }
  });

  port.postMessage({ action, code, question, context });
}

function getFieldValueBySuffix(suffixes) {
  for (const suffix of suffixes) {
    const field = findFieldBySuffix([suffix]);
    if (!field) continue;

    if (field.tagName === 'SELECT') {
      const option = field.options[field.selectedIndex];
      return (option?.textContent?.trim() || field.value || '').trim();
    }

    const value = field.value || field.textContent || '';
    if (value && value.trim()) return value.trim();
  }

  return '';
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const CUSTOMER_UPDATE_HEADER_ALIASES = {
  type: ['type'],
  payload: ['payload'],
  targetName: ['target name', 'name'],
  table: ['table'],
  action: ['action', 'operation'],
  application: ['application', 'scope'],
  updatedBy: ['updated by'],
  created: ['created'],
  updated: ['updated']
};

function getHeaderValueByAliases(valueByHeader, aliases = []) {
  for (const alias of aliases) {
    if (valueByHeader[alias]) return valueByHeader[alias];
  }

  return '';
}

function getCellByAliases(cellByHeader, aliases = []) {
  for (const alias of aliases) {
    if (cellByHeader[alias]) return cellByHeader[alias];
  }

  return null;
}

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getCellText(cell) {
  if (!cell) return '';

  const candidates = [
    cell.innerText,
    cell.textContent,
    cell.getAttribute('title'),
    cell.getAttribute('aria-label'),
    cell.dataset?.originalTitle,
    cell.dataset?.title
  ];

  let best = '';
  for (const candidate of candidates) {
    const compact = compactWhitespace(candidate);
    if (compact.length > best.length) {
      best = compact;
    }
  }

  return best;
}

function compactPayloadPreview(value, maxLength = 220) {
  const compact = compactWhitespace(value);
  if (compact.length <= maxLength) return compact;
  return compact.slice(0, maxLength - 3) + '...';
}

function compactMultilinePreview(value, maxLength = 320) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return compact.slice(0, maxLength - 3) + '...';
}

function normalizeUpdateSetDocumentationMode(value) {
  return value === 'deep' ? 'deep' : 'list';
}

function normalizeChangeDocumentationSettings(raw = {}) {
  const deepFetchLimit = Number(raw.deepFetchLimit);
  const deepFetchConcurrency = Number(raw.deepFetchConcurrency);

  return {
    updateSetMode: normalizeUpdateSetDocumentationMode(raw.updateSetMode),
    deepFetchLimit: Number.isFinite(deepFetchLimit) && deepFetchLimit > 0 ? Math.min(deepFetchLimit, 25) : 12,
    deepFetchConcurrency: Number.isFinite(deepFetchConcurrency) && deepFetchConcurrency > 0 ? Math.min(deepFetchConcurrency, 5) : 3
  };
}

async function loadChangeDocumentationSettings() {
  try {
    const stored = await chrome.storage.sync.get('changeDocumentation');
    return normalizeChangeDocumentationSettings(stored.changeDocumentation || {});
  } catch {
    return normalizeChangeDocumentationSettings();
  }
}

function findDisplayFieldBySuffix(suffixes) {
  for (const suffix of suffixes) {
    const selectors = [
      `input[id*="sys_display"][id$=".${suffix}"]`,
      `input[name*="sys_display"][name$=".${suffix}"]`,
      `input[id*="sys_display"][id$="${suffix}"]`,
      `input[name*="sys_display"][name$="${suffix}"]`
    ];

    for (const selector of selectors) {
      const field = document.querySelector(selector) || querySelectorDeep(selector);
      if (field) return field;
    }
  }

  return null;
}

function getDisplayValueBySuffix(suffixes) {
  const displayField = findDisplayFieldBySuffix(suffixes);
  if (displayField) {
    const value = (displayField.value || displayField.textContent || '').trim();
    if (value) return value;
  }

  return getFieldValueBySuffix(suffixes);
}

function getAccessibleDocumentsForRelatedLists() {
  const docs = [document];
  const iframes = Array.from(document.querySelectorAll('iframe'));

  for (const iframe of iframes) {
    try {
      const subDoc = iframe.contentDocument;
      if (subDoc?.body) docs.push(subDoc);
    } catch {
      // Ignore inaccessible frames
    }
  }

  return docs;
}

function findCustomerUpdateTables(docRef) {
  const tables = Array.from(docRef.querySelectorAll('table'));

  return tables.filter((table) => {
    const text = normalizeHeader(table.textContent);
    if (text.includes('sys_update_xml')) return true;
    if (text.includes('customer updates')) return true;

    const headers = Array.from(table.querySelectorAll('th')).map((th) => normalizeHeader(th.textContent));
    const hasType = CUSTOMER_UPDATE_HEADER_ALIASES.type.some((alias) => headers.includes(alias));
    const hasTargetName = CUSTOMER_UPDATE_HEADER_ALIASES.targetName.some((alias) => headers.includes(alias));
    const hasAction = CUSTOMER_UPDATE_HEADER_ALIASES.action.some((alias) => headers.includes(alias));
    return hasType && hasTargetName && hasAction;
  });
}

function extractRowsFromCustomerUpdateTable(table) {
  const headers = Array.from(table.querySelectorAll('th')).map((th) => normalizeHeader(th.textContent));
  if (!headers.length) return [];

  const rows = Array.from(table.querySelectorAll('tbody tr')).filter((row) => row.querySelectorAll('td').length > 0);
  return rows.map((row) => {
    const cells = Array.from(row.querySelectorAll('td'));
    const valueByHeader = {};
    const cellByHeader = {};

    headers.forEach((header, index) => {
      cellByHeader[header] = cells[index] || null;
      valueByHeader[header] = getCellText(cells[index]);
    });

    const links = Array.from(row.querySelectorAll('a[href]'));
    const sysIdLink = links.find((link) => /sys_id=([a-f0-9]{32})/i.test(link.href));
    const sysIdMatch = sysIdLink?.href.match(/sys_id=([a-f0-9]{32})/i);
    const targetNameCell = getCellByAliases(cellByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.targetName);
    const targetNameLinkText = targetNameCell?.querySelector('a')?.innerText?.trim() || '';
    const targetName = targetNameLinkText || getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.targetName);
    const payloadPreview = compactPayloadPreview(getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.payload));
    const targetTable = getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.table);
    const application = getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.application);
    const type = getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.type) || targetTable;

    return {
      sysId: sysIdMatch ? sysIdMatch[1] : '',
      type,
      name: targetName,
      action: getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.action),
      application,
      targetTable,
      targetName,
      updatedBy: getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.updatedBy),
      createdOn: getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.created),
      updatedOn: getHeaderValueByAliases(valueByHeader, CUSTOMER_UPDATE_HEADER_ALIASES.updated),
      payloadPreview,
      payloadXml: payloadPreview,
      source: 'update_set_form'
    };
  }).filter((row) => row.name || row.type || row.action);
}

function collectCustomerUpdatesFromForm() {
  const docs = getAccessibleDocumentsForRelatedLists();
  const updates = [];
  let tableCount = 0;
  let rawRowCount = 0;

  for (const docRef of docs) {
    const tables = findCustomerUpdateTables(docRef);
    tableCount += tables.length;
    for (const table of tables) {
      const rows = extractRowsFromCustomerUpdateTable(table);
      rawRowCount += rows.length;
      updates.push(...rows);
    }
  }

  const seen = {};
  const deduped = updates.filter((row) => {
    const key = `${row.sysId}|${row.type}|${row.name}|${row.action}`;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  return {
    updates: deduped,
    diagnostics: {
      documentCount: docs.length,
      tableCount,
      rawRowCount,
      dedupedCount: deduped.length,
      collectionMode: 'list',
      deepCandidates: 0,
      deepFetchedCount: 0,
      deepFailedCount: 0
    }
  };
}

async function collectUpdateSetData(changeDocumentationSettings = {}, onProgress = null) {
  if (!hasUpdateSetForm()) return null;

  const meta = {
    sysId: getPageContext().sysId || '',
    name: getFieldValueBySuffix(['name']),
    description: getFieldValueBySuffix(['description', 'short_description']),
    application: getDisplayValueBySuffix(['application', 'application_name', 'scope']),
    state: getFieldValueBySuffix(['state']),
    source: 'update_set_form'
  };

  let customerUpdateResult = collectCustomerUpdatesFromForm();
  if (normalizeUpdateSetDocumentationMode(changeDocumentationSettings.updateSetMode) === 'deep') {
    customerUpdateResult = await enrichCustomerUpdatesWithDeepPayload(
      customerUpdateResult,
      changeDocumentationSettings,
      onProgress
    );
  }
  const customerUpdates = customerUpdateResult.updates;

  if (!meta.name && customerUpdates.length === 0) {
    return null;
  }

  return {
    meta,
    customerUpdates,
    diagnostics: customerUpdateResult.diagnostics,
    userContext: '',
    questionnaire: {}
  };
}

async function enrichCustomerUpdatesWithDeepPayload(customerUpdateResult, changeDocumentationSettings, onProgress = null) {
  const updates = customerUpdateResult.updates.map((update) => ({ ...update }));
  const candidates = updates
    .filter((update) => update.sysId)
    .slice(0, changeDocumentationSettings.deepFetchLimit);

  if (!candidates.length) {
    return {
      updates,
      diagnostics: {
        ...customerUpdateResult.diagnostics,
        collectionMode: 'deep',
        deepCandidates: 0,
        deepFetchedCount: 0,
        deepFailedCount: 0
      }
    };
  }

  if (typeof onProgress === 'function') {
    onProgress({
      phase: 'collect-deep-start',
      label: 'Deep mode: fetching XML payloads',
      meta: {
        deepCandidates: candidates.length,
        totalVisibleUpdates: updates.length
      }
    });
  }

  let completed = 0;
  let deepFetchedCount = 0;
  let deepFailedCount = 0;
  const concurrency = changeDocumentationSettings.deepFetchConcurrency;

  for (let index = 0; index < candidates.length; index += concurrency) {
    const batch = candidates.slice(index, index + concurrency);

    await Promise.all(batch.map(async (update) => {
      try {
        const deepDetails = await fetchAndParseCustomerUpdatePayload(update.sysId);
        Object.assign(update, deepDetails);
        deepFetchedCount += 1;
      } catch (error) {
        update.deepFetchError = error?.message || 'Unknown XML fetch error';
        deepFailedCount += 1;
      } finally {
        completed += 1;
        if (
          typeof onProgress === 'function' &&
          (completed === candidates.length || completed === 1 || completed % concurrency === 0)
        ) {
          onProgress({
            phase: 'collect-deep-progress',
            label: 'Deep mode: XML payload progress',
            meta: {
              deepCompleted: completed,
              deepCandidates: candidates.length,
              deepFetched: deepFetchedCount,
              deepFailed: deepFailedCount
            }
          });
        }
      }
    }));
  }

  return {
    updates,
    diagnostics: {
      ...customerUpdateResult.diagnostics,
      collectionMode: 'deep',
      deepCandidates: candidates.length,
      deepFetchedCount,
      deepFailedCount
    }
  };
}

async function fetchAndParseCustomerUpdatePayload(sysId) {
  const url = new URL('/sys_update_xml.do', window.location.origin);
  url.searchParams.set('XML', '');
  url.searchParams.set('sys_id', sysId);

  const response = await fetch(url.toString(), {
    credentials: 'include',
    headers: {
      'Accept': 'application/xml,text/xml,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xmlText = await response.text();
  return parseCustomerUpdateExportXml(xmlText);
}

function parseCustomerUpdateExportXml(xmlText) {
  const outerDoc = parseXmlDocument(xmlText);
  if (!outerDoc) {
    throw new Error('Could not parse exported Customer Update XML.');
  }

  const payloadXml = getFirstXmlTagText(outerDoc, ['payload']);
  const outerType = getFirstXmlTagText(outerDoc, ['type']);
  const outerName = getFirstXmlTagText(outerDoc, ['target_name', 'name']);
  const outerAction = getFirstXmlTagText(outerDoc, ['action']);
  const outerApplication = getFirstXmlTagText(outerDoc, ['application']);
  const payloadDetails = payloadXml ? extractPayloadDetails(payloadXml) : {};

  return {
    type: outerType || payloadDetails.deepTable || '',
    targetName: outerName || payloadDetails.deepName || '',
    name: outerName || payloadDetails.deepName || '',
    action: outerAction || '',
    application: outerApplication || '',
    payloadXml,
    payloadPreview: compactPayloadPreview(payloadXml || ''),
    deepPayloadFetched: true,
    deepTable: payloadDetails.deepTable || '',
    deepName: payloadDetails.deepName || '',
    scriptField: payloadDetails.scriptField || '',
    scriptPreview: payloadDetails.scriptPreview || '',
    fieldSummary: payloadDetails.fieldSummary || []
  };
}

function parseXmlDocument(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return null;
  }
  return doc;
}

function getFirstXmlTagText(docOrElement, tagNames = []) {
  if (!docOrElement) return '';

  for (const tagName of tagNames) {
    const node = docOrElement.getElementsByTagName(tagName)[0];
    const value = compactWhitespace(node?.textContent || '');
    if (value) return value;
  }

  return '';
}

function getElementChildren(node) {
  return Array.from(node?.childNodes || []).filter((child) => child.nodeType === Node.ELEMENT_NODE);
}

function extractPayloadDetails(payloadXml) {
  const innerDoc = parseXmlDocument(payloadXml);
  if (!innerDoc) {
    return {
      deepTable: '',
      deepName: '',
      scriptField: '',
      scriptPreview: '',
      fieldSummary: []
    };
  }

  const recordUpdate = innerDoc.getElementsByTagName('record_update')[0];
  const recordNode = recordUpdate
    ? getElementChildren(recordUpdate)[0] || null
    : innerDoc.documentElement;
  const deepTable = recordUpdate?.getAttribute('table') || recordNode?.tagName || '';
  const deepName = getFirstXmlTagText(recordNode || innerDoc, ['name', 'short_description', 'label', 'column_label', 'element']);
  const scriptField = findFirstPresentField(recordNode, [
    'script',
    'operation_script',
    'action_script',
    'condition',
    'script_true',
    'script_false'
  ]);
  const scriptPreview = scriptField ? compactMultilinePreview(getFirstXmlTagText(recordNode, [scriptField]), 360) : '';
  const fieldSummary = collectPayloadFieldSummary(recordNode);

  return {
    deepTable,
    deepName,
    scriptField,
    scriptPreview,
    fieldSummary
  };
}

function findFirstPresentField(node, fieldNames = []) {
  for (const fieldName of fieldNames) {
    if (getFirstXmlTagText(node, [fieldName])) {
      return fieldName;
    }
  }

  return '';
}

function collectPayloadFieldSummary(node) {
  if (!node) return [];

  const summaryFields = [
    'collection',
    'table',
    'when',
    'active',
    'condition',
    'element',
    'column_label',
    'reference',
    'type',
    'mandatory',
    'default_value',
    'order',
    'duration_hours',
    'queue'
  ];

  const result = [];
  for (const fieldName of summaryFields) {
    const value = getFirstXmlTagText(node, [fieldName]);
    if (!value) continue;
    result.push(`${fieldName}: ${compactMultilinePreview(value, 120)}`);
    if (result.length >= 5) break;
  }

  return result;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
// Lightweight parser — no external deps, safe for classic scripts.
// Escapes HTML first, then applies block and inline rules.

function renderMarkdown(md) {
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Inline: code → bold → italic (order matters)
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  const lines = md.split('\n');
  const out   = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];

    // Fenced code block
    if (raw.startsWith('```')) {
      i++;
      const code = [];
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(esc(lines[i])); i++; }
      i++;
      out.push('<pre><code>' + code.join('\n') + '</code></pre>');
      continue;
    }

    // Headings
    const h3 = raw.match(/^### (.+)/); if (h3) { out.push('<h3>' + inline(esc(h3[1])) + '</h3>'); i++; continue; }
    const h2 = raw.match(/^## (.+)/);  if (h2) { out.push('<h2>' + inline(esc(h2[1])) + '</h2>'); i++; continue; }
    const h1 = raw.match(/^# (.+)/);   if (h1) { out.push('<h1>' + inline(esc(h1[1])) + '</h1>'); i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(raw.trim())) { out.push('<hr>'); i++; continue; }

    // Table — collect all consecutive lines containing |
    if (raw.includes('|')) {
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) { rows.push(lines[i]); i++; }
      let isHeader = true;
      out.push('<table>');
      for (const row of rows) {
        // Separator row (|---|---|) — marks end of header
        if (/^\|[\s\-|:]+\|$/.test(row.trim())) { isHeader = false; continue; }
        const cells = row.split('|').slice(1, -1);
        const tag   = isHeader ? 'th' : 'td';
        out.push('<tr>' + cells.map(function(c) { return '<' + tag + '>' + inline(esc(c.trim())) + '</' + tag + '>'; }).join('') + '</tr>');
      }
      out.push('</table>');
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(raw)) {
      out.push('<ul>');
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        out.push('<li>' + inline(esc(lines[i].replace(/^[-*] /, ''))) + '</li>');
        i++;
      }
      out.push('</ul>');
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(raw)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        out.push('<li>' + inline(esc(lines[i].replace(/^\d+\. /, ''))) + '</li>');
        i++;
      }
      out.push('</ol>');
      continue;
    }

    // Empty line
    if (raw.trim() === '') { i++; continue; }

    // Paragraph — accumulate lines until a block-level element or blank line
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].includes('|') &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      para.push(inline(esc(lines[i])));
      i++;
    }
    if (para.length) out.push('<p>' + para.join('<br>') + '</p>');
  }

  return out.join('');
}

// ─── Word document generation ─────────────────────────────────────────────────
// Generates a .doc file (HTML with Word namespaces) that Word opens natively.
// No external libraries needed — the MIME type + Word XML hints do the trick.

function generateWordDoc(markdownText, context) {
  const date       = new Date().toISOString().slice(0, 10);
  const scriptType = (context.scriptType || 'Script').replace(/\s+/g, '_');
  const filename   = scriptType + '_Documentation_' + date + '.doc';

  const bodyHtml = context.table === 'sys_update_set'
    ? renderWordFriendlyText(markdownText)
    : renderMarkdown(markdownText);

  const html = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office"',
    '      xmlns:w="urn:schemas-microsoft-com:office:word"',
    '      xmlns="http://www.w3.org/TR/REC-html40">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>' + (context.scriptType || 'Script') + ' Documentation</title>',
    '<!--[if gte mso 9]><xml>',
    '<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument>',
    '</xml><![endif]-->',
    '<style>',
    '  body    { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a2e; line-height: 1.6; margin: 2cm; }',
    '  h1      { font-size: 20pt; color: #2E74B5; border-bottom: 2px solid #2E74B5; padding-bottom: 6pt; margin-top: 0; }',
    '  h2      { font-size: 14pt; color: #2E74B5; margin-top: 18pt; border-bottom: 1px solid #BDD6EE; padding-bottom: 3pt; }',
    '  h3      { font-size: 12pt; color: #404040; margin-top: 12pt; }',
    '  p       { margin: 6pt 0; }',
    '  code    { font-family: Consolas, "Courier New", monospace; font-size: 10pt; background: #f4f4f4; padding: 1pt 4pt; }',
    '  pre     { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; background: #f4f4f4; border: 1pt solid #ddd; padding: 8pt; margin: 8pt 0; white-space: pre-wrap; }',
    '  pre code{ background: none; padding: 0; }',
    '  table   { border-collapse: collapse; width: 100%; margin: 8pt 0; }',
    '  th      { background: #2E74B5; color: white; font-weight: bold; padding: 6pt 8pt; border: 1pt solid #2E74B5; }',
    '  td      { padding: 5pt 8pt; border: 1pt solid #BDD6EE; vertical-align: top; }',
    '  tr:nth-child(even) td { background: #EBF3FB; }',
    '  ul, ol  { margin: 4pt 0; padding-left: 20pt; }',
    '  li      { margin-bottom: 3pt; }',
    '  hr      { border: none; border-top: 1pt solid #BDD6EE; margin: 12pt 0; }',
    '  strong  { font-weight: bold; }',
    '  em      { font-style: italic; color: #555; }',
    '  .sna-meta { font-size: 9pt; color: #888; margin-bottom: 16pt; border-bottom: 1px solid #eee; padding-bottom: 8pt; }',
    '</style>',
    '</head>',
    '<body>',
    '<p class="sna-meta">Generated by SN Assistant &bull; ' + (context.scriptType || '') + ' &bull; ' + (context.hostname || '') + ' &bull; ' + date + '</p>',
    bodyHtml,
    '</body>',
    '</html>'
  ].join('\n');

  // BOM (\ufeff) ensures Word reads the encoding correctly.
  // Anchor must be appended to document body before .click() — required in iframe contexts.
  // revokeObjectURL is deferred 2s to guarantee the browser starts the download first.
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return filename;
}

function renderWordFriendlyText(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] || '';
    const line = raw.trim();

    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith('```')) {
      i++;
      const codeLines = [];
      while (i < lines.length && !(lines[i] || '').trim().startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++;
      out.push('<pre><code>' + codeLines.join('\n') + '</code></pre>');
      continue;
    }

    if (/^---+$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test((lines[i] || '').trim())) {
        quote.push(renderWordFriendlyInline((lines[i] || '').trim().replace(/^>\s?/, '')));
        i++;
      }
      out.push('<p><em>' + quote.join('<br>') + '</em></p>');
      continue;
    }

    if (line.startsWith('### ')) {
      out.push('<h3>' + renderWordFriendlyInline(line.slice(4)) + '</h3>');
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      out.push('<h2>' + renderWordFriendlyInline(line.slice(3)) + '</h2>');
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      out.push('<h1>' + renderWordFriendlyInline(line.slice(2)) + '</h1>');
      i++;
      continue;
    }

    if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length) {
        const itemLine = (lines[i] || '').trim();
        if (!itemLine || (!/^[-*] /.test(itemLine) && !/^\d+\. /.test(itemLine))) break;
        items.push(renderWordFriendlyInline(itemLine.replace(/^[-*] /, '').replace(/^\d+\. /, '')));
        i++;
      }
      out.push('<ul>' + items.map((item) => '<li>' + item + '</li>').join('') + '</ul>');
      continue;
    }

    if (line.includes('|')) {
      const rows = [];
      while (i < lines.length && (lines[i] || '').includes('|')) {
        rows.push((lines[i] || '').trim());
        i++;
      }

      let isHeader = true;
      const tableRows = [];
      for (const row of rows) {
        if (/^\|[\s\-|:]+\|$/.test(row)) {
          isHeader = false;
          continue;
        }

        const cells = row.split('|').slice(1, -1).map((cell) => renderWordFriendlyInline(cell.trim()));
        const tag = isHeader ? 'th' : 'td';
        tableRows.push('<tr>' + cells.map((cell) => `<${tag}>${cell}</${tag}>`).join('') + '</tr>');
      }

      if (tableRows.length) {
        out.push('<table>' + tableRows.join('') + '</table>');
        continue;
      }
    }

    const paragraph = [];
    while (i < lines.length) {
      const paragraphLine = (lines[i] || '').trim();
      if (
        !paragraphLine ||
        paragraphLine.startsWith('#') ||
        paragraphLine.startsWith('```') ||
        /^>\s?/.test(paragraphLine) ||
        /^[-*] /.test(paragraphLine) ||
        /^\d+\. /.test(paragraphLine) ||
        /^---+$/.test(paragraphLine) ||
        paragraphLine.includes('|')
      ) {
        break;
      }
      paragraph.push(renderWordFriendlyInline(paragraphLine));
      i++;
    }

    if (paragraph.length) {
      out.push('<p>' + paragraph.join('<br>') + '</p>');
    } else {
      i++;
    }
  }

  return out.join('');
}

function renderWordFriendlyInline(text) {
  return escapeHtml(text || '')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function showLoading(label) {
  document.getElementById('sna-placeholder').style.display = 'none';
  const loadingEl = document.getElementById('sna-loading');
  loadingEl.style.display = 'flex';
  loadingEl.querySelector('span').textContent = label || 'Analyzing...';
  document.getElementById('sna-response').style.display = 'none';
  document.getElementById('sna-copy').style.display = 'none';
}

function updateLoadingLabel(label) {
  const loadingEl = document.getElementById('sna-loading');
  if (!loadingEl) return;
  loadingEl.style.display = 'flex';
  const labelEl = loadingEl.querySelector('span');
  if (labelEl) labelEl.textContent = label || 'Analyzing...';
}

function setSidebarBusy(isBusy) {
  const sidebar = document.getElementById(SN_ASSISTANT_ID);
  if (!sidebar) return;

  sidebar.dataset.busy = isBusy ? 'true' : 'false';

  const controls = sidebar.querySelectorAll('.sna-action-btn, #sna-send-question, #sna-question-input');
  controls.forEach((control) => {
    control.disabled = isBusy;
  });
}

function isSidebarBusy() {
  return document.getElementById(SN_ASSISTANT_ID)?.dataset.busy === 'true';
}

function clearActiveStreamState(port) {
  if (activeStreamPort && port && activeStreamPort !== port) return;

  clearActiveStreamTimer();
  activeStreamPort = null;
  activeStreamAction = null;
  setSidebarBusy(false);
}

function cancelActiveStream() {
  if (activeStreamPort) {
    try {
      activeStreamPort.disconnect();
    } catch {
      // Ignore disconnect race
    }
  }

  clearActiveStreamState();
}

function trackActiveStream(port, action) {
  activeStreamPort = port;
  activeStreamAction = action;
  refreshActiveStreamTimeout(port, action);
}

function clearActiveStreamTimer() {
  if (activeStreamTimer) {
    clearTimeout(activeStreamTimer);
    activeStreamTimer = null;
  }
}

function refreshActiveStreamTimeout(port, action = activeStreamAction) {
  if (activeStreamPort && port && activeStreamPort !== port) return;

  clearActiveStreamTimer();

  activeStreamTimer = setTimeout(() => {
    if (activeStreamPort !== port) return;

    try {
      port.disconnect();
    } catch {
      // Ignore disconnect race
    }

    clearActiveStreamState(port);
    if (shouldShowExecutionTrace(action)) {
      finalizeExecutionTrace('timeout', `No progress detected for ${Math.round(getActionTimeoutMs(action) / 1000)} seconds.`, {
        timeoutSeconds: Math.round(getActionTimeoutMs(action) / 1000),
        lastPhase: currentExecutionTrace?.lastPhase || 'unknown'
      });
    }
    showError(`The ${action} action stopped making progress and was cancelled.`);
  }, getActionTimeoutMs(action));
}

function getActionTimeoutMs(action) {
  return ACTION_TIMEOUTS_MS[action] || ACTION_TIMEOUT_MS;
}

function showDownloadSuccess(filename, message) {
  document.getElementById('sna-loading').style.display = 'none';
  const responseEl = document.getElementById('sna-response');
  responseEl.style.display = 'block';
  responseEl.classList.add('sna-response--rendered');
  responseEl.innerHTML = `
    <p><strong>${escapeHtml(message || 'Document downloaded successfully.')}</strong></p>
    <p>${escapeHtml(filename)}</p>
  `;
  document.getElementById('sna-copy').style.display = 'none';
}

function shouldShowExecutionTrace(action) {
  return action === 'documentUpdateSet';
}

function beginExecutionTrace(action, seed = {}) {
  if (!shouldShowExecutionTrace(action)) {
    clearExecutionTrace();
    return;
  }

  currentExecutionTrace = {
    action,
    startedAt: Date.now(),
    status: 'running',
    summary: seed.summary || '',
    lastPhase: 'start',
    steps: []
  };
  renderExecutionTrace();
}

function addExecutionTraceStep(step = {}) {
  if (!currentExecutionTrace || !shouldShowExecutionTrace(currentExecutionTrace.action)) return;

  currentExecutionTrace.lastPhase = step.phase || currentExecutionTrace.lastPhase || 'info';
  currentExecutionTrace.steps.push({
    phase: step.phase || 'info',
    label: step.label || 'Trace update',
    detail: step.detail || '',
    meta: step.meta || null,
    elapsedMs: typeof step.elapsedMs === 'number'
      ? step.elapsedMs
      : (Date.now() - currentExecutionTrace.startedAt)
  });

  renderExecutionTrace();
}

function finalizeExecutionTrace(status, summary = '', meta = null) {
  if (!currentExecutionTrace || !shouldShowExecutionTrace(currentExecutionTrace.action)) return;

  currentExecutionTrace.status = status || 'done';
  if (summary) currentExecutionTrace.summary = summary;
  if (meta) {
    addExecutionTraceStep({
      phase: status || 'done',
      label: summary || 'Trace finished',
      meta
    });
  } else {
    renderExecutionTrace();
  }
}

function clearExecutionTrace() {
  currentExecutionTrace = null;
  const el = document.getElementById('sna-execution-trace');
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
}

function handleExecutionProgress(progress = {}) {
  if (!shouldShowExecutionTrace('documentUpdateSet')) return;

  if (progress.message) {
    updateLoadingLabel(progress.message);
  }

  addExecutionTraceStep({
    phase: progress.phase || 'progress',
    label: progress.label || progress.message || 'Progress update',
    detail: progress.detail || '',
    meta: progress.meta || null,
    elapsedMs: progress.elapsedMs
  });
}

function renderExecutionTrace() {
  const el = document.getElementById('sna-execution-trace');
  if (!el) return;

  if (!currentExecutionTrace || !shouldShowExecutionTrace(currentExecutionTrace.action)) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const status = currentExecutionTrace.status || 'running';
  const statusLabels = {
    running: 'Running',
    done: 'Done',
    error: 'Error',
    timeout: 'Timeout'
  };
  const metricsHtml = (currentExecutionTrace.steps || [])
    .slice(-8)
    .map((step) => {
      const metaPairs = step.meta
        ? Object.entries(step.meta)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => `<span>${escapeHtml(key)}: ${escapeHtml(String(value))}</span>`)
            .join('')
        : '';

      return `
        <li class="sna-trace-item">
          <div class="sna-trace-row">
            <span class="sna-trace-time">${escapeHtml(formatTraceElapsed(step.elapsedMs))}</span>
            <span class="sna-trace-label">${escapeHtml(step.label)}</span>
          </div>
          ${step.detail ? `<p class="sna-trace-detail">${escapeHtml(step.detail)}</p>` : ''}
          ${metaPairs ? `<div class="sna-trace-meta">${metaPairs}</div>` : ''}
        </li>
      `;
    }).join('');

  el.innerHTML = `
    <details class="sna-trace-card" open>
      <summary class="sna-trace-summary">
        <span class="sna-trace-title">Execution Trace</span>
        <span class="sna-trace-badge sna-trace-badge--${escapeHtml(status)}">${escapeHtml(statusLabels[status] || status)}</span>
      </summary>
      ${currentExecutionTrace.summary ? `<p class="sna-trace-detail">${escapeHtml(currentExecutionTrace.summary)}</p>` : ''}
      <ol class="sna-trace-list">
        ${metricsHtml || '<li class="sna-trace-item"><span class="sna-trace-label">Waiting for progress updates...</span></li>'}
      </ol>
    </details>
  `;
  el.style.display = 'block';
}

function formatTraceElapsed(ms) {
  if (!Number.isFinite(ms)) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clearGrounding() {
  const el = document.getElementById('sna-grounding');
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
}

function renderGrounding(retrieval) {
  const el = document.getElementById('sna-grounding');
  if (!el) return;

  const hasHits = retrieval?.selectedChunks?.length > 0;
  const shouldShow = retrieval?.includeTraceInPanel && (hasHits || retrieval?.trace?.error);

  if (!shouldShow) {
    clearGrounding();
    return;
  }

  if (retrieval?.trace?.error && !hasHits) {
    el.innerHTML = `
      <div class="sna-grounding-card">
        <div class="sna-grounding-summary">
          <span class="sna-grounding-title">Grounding</span>
          <span class="sna-grounding-badge sna-grounding-badge--warn">Unavailable</span>
        </div>
        <p class="sna-grounding-note">${escapeHtml(retrieval.trace.error)}</p>
      </div>
    `;
    el.style.display = 'block';
    return;
  }

  const sourceNames = Array.from(new Set((retrieval.selectedChunks || []).map((chunk) => chunk.sourceName))).join(', ');
  const strategy = escapeHtml(retrieval.strategy || retrieval.trace?.strategy || 'servicenow-hybrid-v1');
  const itemsHtml = (retrieval.selectedChunks || []).map((chunk) => `
    <li class="sna-grounding-item">
      <a class="sna-grounding-link" href="${escapeHtml(chunk.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(chunk.title)}</a>
      <div class="sna-grounding-meta">
        <span>${escapeHtml(chunk.category || 'general')}</span>
        ${chunk.heading ? `<span>${escapeHtml(chunk.heading)}</span>` : ''}
        <span>score ${escapeHtml(chunk.score)}</span>
      </div>
      ${chunk.reasons?.length ? `<p class="sna-grounding-note">${escapeHtml(chunk.reasons.join(' | '))}</p>` : ''}
      <p class="sna-grounding-excerpt">${escapeHtml(chunk.excerpt)}</p>
    </li>
  `).join('');

  el.innerHTML = `
    <details class="sna-grounding-card">
      <summary class="sna-grounding-summary">
        <span class="sna-grounding-title">Grounding</span>
        <span class="sna-grounding-badge">${escapeHtml(retrieval.selectedChunks.length)} refs</span>
      </summary>
      <p class="sna-grounding-note">Using ${escapeHtml(sourceNames)} with ${strategy} retrieval.</p>
      <ul class="sna-grounding-list">
        ${itemsHtml}
      </ul>
    </details>
  `;
  el.style.display = 'block';
}

function showResponse(text) {
  document.getElementById('sna-loading').style.display = 'none';
  const el = document.getElementById('sna-response');
  el.style.display = 'block';
  el.classList.remove('sna-response--rendered');
  el.textContent = text; // raw text during streaming
  document.getElementById('sna-copy').style.display = 'inline-block';
}

// Called on each chunk — appends only the new text to avoid O(n^2) DOM rewrites.
function appendResponseChunk(chunk) {
  const el = document.getElementById('sna-response');
  el.textContent += chunk;
  const area = document.getElementById('sna-response-area');
  area.scrollTop = area.scrollHeight;
}

// Called once on 'done' — switches to rendered markdown.
function finalizeResponse(text) {
  const el = document.getElementById('sna-response');
  el.classList.add('sna-response--rendered');

  // Long grounded explanations can become expensive to fully markdown-render.
  // Fall back to preformatted plain text to keep the tab responsive.
  if ((text || '').length > MAX_MARKDOWN_RENDER_CHARS) {
    el.innerHTML = '<pre><code>' + escapeHtml(text) + '</code></pre>';
  } else {
    el.innerHTML = renderMarkdown(text);
  }

  const area = document.getElementById('sna-response-area');
  area.scrollTop = area.scrollHeight;
}

function showError(msg) {
  document.getElementById('sna-loading').style.display = 'none';
  document.getElementById('sna-placeholder').style.display = 'none';
  const responseEl = document.getElementById('sna-response');
  responseEl.style.display = 'block';
  responseEl.innerHTML = `<span class="sna-error">⚠️ ${msg}</span>`;
  document.getElementById('sna-copy').style.display = 'none';
}

// ─── Drag & resize ────────────────────────────────────────────────────────────

function initDragResize(sidebar) {
  const MIN_W = 280, MIN_H = 300;

  // CSS variable helpers — lets us override !important rules cleanly
  function setVar(name, value) { sidebar.style.setProperty(name, value); }
  function clearVar(name)      { sidebar.style.removeProperty(name); }

  // ── Reset to original docked position ──────────────────────────────────────
  function resetPosition() {
    ['--sna-pos-top','--sna-pos-left','--sna-pos-right','--sna-pos-width','--sna-pos-height'].forEach(clearVar);
    sidebar.classList.remove('sna-sidebar--free', 'sna-sidebar--sized');
  }

  document.getElementById('sna-reset-pos').addEventListener('click', resetPosition);

  // ── Drag (grab header) ─────────────────────────────────────────────────────
  const header = sidebar.querySelector('.sna-header');
  let dragging = false, dragStartX = 0, dragStartY = 0, dragOrigL = 0, dragOrigT = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return; // don't interfere with header buttons
    e.preventDefault();

    const rect = sidebar.getBoundingClientRect();
    dragging   = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOrigL  = rect.left;
    dragOrigT  = rect.top;

    // Switch to absolute left/top positioning and go free-floating
    sidebar.classList.add('sna-sidebar--free');
    setVar('--sna-pos-right', 'auto');
    setVar('--sna-pos-left',  rect.left  + 'px');
    setVar('--sna-pos-top',   rect.top   + 'px');
    setVar('--sna-pos-width', rect.width + 'px');
    document.body.style.userSelect = 'none';
  });

  // ── Resize handles ─────────────────────────────────────────────────────────
  const leftHandle   = document.createElement('div');
  const bottomHandle = document.createElement('div');
  const cornerHandle = document.createElement('div');
  leftHandle.className   = 'sna-resize-handle sna-resize-left';
  bottomHandle.className = 'sna-resize-handle sna-resize-bottom';
  cornerHandle.className = 'sna-resize-handle sna-resize-corner';
  sidebar.appendChild(leftHandle);
  sidebar.appendChild(bottomHandle);
  sidebar.appendChild(cornerHandle);

  let resizing = false, resizeDir = '';
  let rsX = 0, rsY = 0, rsW = 0, rsH = 0, rsL = 0, rsT = 0;

  function startResize(e, dir) {
    e.preventDefault();
    e.stopPropagation();
    const rect = sidebar.getBoundingClientRect();
    resizing = true;
    resizeDir = dir;
    rsX = e.clientX; rsY = e.clientY;
    rsW = rect.width; rsH = rect.height;
    rsL = rect.left;  rsT = rect.top;

    sidebar.classList.add('sna-sidebar--free', 'sna-sidebar--sized');
    setVar('--sna-pos-right',  'auto');
    setVar('--sna-pos-left',   rsL + 'px');
    setVar('--sna-pos-top',    rsT + 'px');
    setVar('--sna-pos-width',  rsW + 'px');
    setVar('--sna-pos-height', rsH + 'px');
    document.body.style.userSelect = 'none';
  }

  leftHandle.addEventListener('mousedown',   e => startResize(e, 'left'));
  bottomHandle.addEventListener('mousedown', e => startResize(e, 'bottom'));
  cornerHandle.addEventListener('mousedown', e => startResize(e, 'corner'));

  // ── Shared document-level listeners (cleaned up when sidebar is removed) ───
  const controller = new AbortController();
  const { signal } = controller;

  document.addEventListener('mousemove', (e) => {
    if (dragging) {
      const dx   = e.clientX - dragStartX;
      const dy   = e.clientY - dragStartY;
      const newL = Math.max(0, Math.min(window.innerWidth  - sidebar.offsetWidth,  dragOrigL + dx));
      const newT = Math.max(0, Math.min(window.innerHeight - MIN_H,                dragOrigT + dy));
      setVar('--sna-pos-left', newL + 'px');
      setVar('--sna-pos-top',  newT + 'px');
    }

    if (resizing) {
      const dx = e.clientX - rsX;
      const dy = e.clientY - rsY;

      if (resizeDir === 'left' || resizeDir === 'corner') {
        // Left edge drag: grow/shrink width and move left anchor accordingly
        const newW = Math.max(MIN_W, rsW - dx);
        const newL = rsL + (rsW - newW);
        setVar('--sna-pos-width', newW + 'px');
        setVar('--sna-pos-left',  newL + 'px');
      }
      if (resizeDir === 'bottom' || resizeDir === 'corner') {
        const newH = Math.max(MIN_H, rsH + dy);
        setVar('--sna-pos-height', newH + 'px');
      }
    }
  }, { signal });

  document.addEventListener('mouseup', () => {
    if (dragging || resizing) {
      dragging  = false;
      resizing  = false;
      document.body.style.userSelect = '';
    }
  }, { signal });

  // Clean up when sidebar is removed from DOM
  const observer = new MutationObserver(() => {
    if (!document.contains(sidebar)) {
      controller.abort();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}

// ─── Trigger button ───────────────────────────────────────────────────────────

function createTriggerButton() {
  if (document.getElementById(SN_TRIGGER_ID)) return;

  const btn = document.createElement('button');
  btn.id = SN_TRIGGER_ID;
  btn.title = 'SN Assistant — script detected';
  btn.innerHTML = `<span class="sna-trigger-icon">⚡</span><span class="sna-trigger-badge" id="sna-trigger-badge"></span>`;
  btn.addEventListener('click', toggleSidebar);
  document.body.appendChild(btn);
}

function toggleSidebar() {
  const existing = document.getElementById(SN_ASSISTANT_ID);
  if (existing) {
    cancelActiveStream();
    existing.remove();
    document.getElementById(SN_TRIGGER_ID)?.classList.remove('active');
  } else {
    createSidebar();
    dismissBadge();
    document.getElementById(SN_TRIGGER_ID)?.classList.add('active');
  }
}

function dismissBadge() {
  const badge = document.getElementById('sna-trigger-badge');
  if (badge) badge.classList.add('dismissed');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  // Case 1: inner iframe that is NOT gsft_main (widget, portal component, etc.) → skip.
  if (window !== window.top && window.name !== 'gsft_main') return;

  // Case 2: we are the top-level frame.
  if (window === window.top) {
    // If gsft_main exists, the form lives inside it — that frame will handle detection.
    if (document.getElementById('gsft_main')) return;

    // If the URL does not match a known SN script record type, nothing to do here.
    // This avoids running on the portal, list views, dashboards, etc.
    if (!detectRecordType().isKnown) return;

    // URL matches a known script type and there is no gsft_main embedding —
    // Polaris renders these forms directly in the top frame. Fall through.
  }

  // At this point we are either inside gsft_main OR in a top-level Polaris script page.

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (window === window.top && document.getElementById('gsft_main')) {
      clearInterval(interval);
      return;
    }
    if (hasRelevantAssistantContext()) {
      clearInterval(interval);
      createTriggerButton();
    }
    if (attempts > 40) clearInterval(interval); // max ~20s (was 10s — longer for Client Scripts)
  }, 500);
}

try {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_SIDEBAR') {
      toggleSidebar();
    }
  });
} catch (error) {
  console.warn('[SN Assistant] Runtime listener unavailable', error);
}

init();
