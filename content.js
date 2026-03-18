// SN Assistant — content.js
// Detects Monaco editors in ServiceNow and injects the assistant sidebar panel.

const SN_ASSISTANT_ID = 'sn-assistant-sidebar';
const SN_TRIGGER_ID   = 'sna-trigger-btn';

// ─── Page context detection ───────────────────────────────────────────────────

function getPageContext() {
  const url = window.location.href;
  const hostname = window.location.hostname;

  const tableMatch = url.match(/\/([a-z_]+)\.do/);
  const table = tableMatch ? tableMatch[1] : 'unknown';

  const sysIdMatch = url.match(/sys_id=([a-f0-9]{32})/);
  const sysId = sysIdMatch ? sysIdMatch[1] : null;

  let scriptType = 'unknown';
  if (table === 'sys_script')         scriptType = 'Business Rule';
  else if (table === 'sys_script_include') scriptType = 'Script Include';
  else if (table === 'sys_script_fix')     scriptType = 'Fix Script';
  else if (table === 'sys_ui_action')      scriptType = 'UI Action';
  else if (table === 'sys_ui_script')      scriptType = 'UI Script';
  else if (url.includes('$background_script')) scriptType = 'Background Script';

  return { hostname, table, sysId, scriptType, url };
}

// ─── Code extraction ──────────────────────────────────────────────────────────

function extractCode() {
  // Method 1: Hidden textarea (most reliable for Monaco/ServiceNow)
  const exactTextarea = document.querySelector('textarea[id$=".script"][name$=".script"]');
  if (exactTextarea && exactTextarea.value.trim().length > 0) return exactTextarea.value;

  // Method 2: Global Monaco editor instances exposed by ServiceNow
  for (const key of Object.keys(window)) {
    if (key.endsWith('_editor')) {
      const editor = window[key];
      if (editor && typeof editor.getValue === 'function') {
        const code = editor.getValue();
        if (code && code.trim().length > 0) return code;
      }
      if (editor && typeof editor.getModel === 'function') {
        const model = editor.getModel();
        if (model && typeof model.getValue === 'function') {
          const code = model.getValue();
          if (code && code.trim().length > 0) return code;
        }
      }
    }
  }

  // Method 3: Monaco global API
  if (window.monaco && window.monaco.editor) {
    const models = window.monaco.editor.getModels();
    for (const model of models) {
      const code = model.getValue();
      if (code && code.trim().length > 0) return code;
    }
  }

  return null;
}

// ─── Sidebar panel ────────────────────────────────────────────────────────────

function createSidebar() {
  if (document.getElementById(SN_ASSISTANT_ID)) return;

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
        <button class="sna-close" id="sna-close" title="Cerrar">×</button>
      </div>
    </div>

    <div class="sna-body" id="sna-body">
      <div class="sna-actions">
        <button class="sna-action-btn" data-action="explain">
          <span class="sna-action-icon">🔍</span>
          <span>Explain</span>
        </button>
        <button class="sna-action-btn" data-action="comment">
          <span class="sna-action-icon">💬</span>
          <span>Comment</span>
        </button>
        <button class="sna-action-btn" data-action="refactor">
          <span class="sna-action-icon">✨</span>
          <span>Refactor</span>
        </button>
        <button class="sna-action-btn" data-action="ask">
          <span class="sna-action-icon">❓</span>
          <span>Ask</span>
        </button>
      </div>

      <div class="sna-ask-box" id="sna-ask-box" style="display:none;">
        <textarea
          id="sna-question-input"
          class="sna-textarea"
          placeholder="Ask anything about this script..."
          rows="3"
        ></textarea>
        <button class="sna-send-btn" id="sna-send-question">Send</button>
      </div>

      <div class="sna-response-area" id="sna-response-area">
        <div class="sna-placeholder" id="sna-placeholder">
          <p>Select an action to analyze the current script.</p>
        </div>
        <div class="sna-loading" id="sna-loading" style="display:none;">
          <div class="sna-spinner"></div>
          <span>Analyzing...</span>
        </div>
        <div class="sna-response" id="sna-response" style="display:none;"></div>
      </div>

      <div class="sna-footer">
        <span class="sna-model" id="sna-model-label">SN Assistant</span>
        <button class="sna-copy-btn" id="sna-copy" style="display:none;" title="Copy response">Copy</button>
      </div>
    </div>
  `;

  document.body.appendChild(sidebar);
  initSidebarEvents(sidebar);
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
    sidebar.remove();
    document.getElementById(SN_TRIGGER_ID)?.classList.remove('active');
  });

  const actionBtns = sidebar.querySelectorAll('.sna-action-btn');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;

      actionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (action === 'ask') {
        document.getElementById('sna-ask-box').style.display = 'flex';
      } else {
        document.getElementById('sna-ask-box').style.display = 'none';
        runAction(action);
      }
    });
  });

  document.getElementById('sna-send-question').addEventListener('click', () => {
    const question = document.getElementById('sna-question-input').value.trim();
    if (question) runAction('ask', question);
  });

  document.getElementById('sna-question-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      const question = e.target.value.trim();
      if (question) runAction('ask', question);
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
  const code = extractCode();

  if (!code) {
    showError('No script detected on this page. Make sure a script editor is open.');
    return;
  }

  const context = getPageContext();
  showLoading();

  const port = chrome.runtime.connect({ name: 'ai-stream' });
  let fullText = '';

  port.onMessage.addListener((msg) => {
    if (msg.type === 'label') {
      const el = document.getElementById('sna-model-label');
      if (el) el.textContent = msg.label;
    } else if (msg.type === 'chunk') {
      if (fullText === '') showResponse('');
      fullText += msg.chunk;
      updateResponse(fullText);
    } else if (msg.type === 'done') {
      port.disconnect();
    } else if (msg.type === 'error') {
      showError(msg.message);
      port.disconnect();
    }
  });

  port.postMessage({ action, code, question, context });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function showLoading() {
  document.getElementById('sna-placeholder').style.display = 'none';
  document.getElementById('sna-loading').style.display = 'flex';
  document.getElementById('sna-response').style.display = 'none';
  document.getElementById('sna-copy').style.display = 'none';
}

function showResponse(text) {
  document.getElementById('sna-loading').style.display = 'none';
  document.getElementById('sna-response').style.display = 'block';
  document.getElementById('sna-response').textContent = text;
  document.getElementById('sna-copy').style.display = 'inline-block';
}

function updateResponse(text) {
  document.getElementById('sna-response').textContent = text;
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

// ─── Auto-detection ───────────────────────────────────────────────────────────

function hasCodeEditor() {
  const exactTextarea = document.querySelector('textarea[id$=".script"][name$=".script"]');
  if (exactTextarea && exactTextarea.value.trim().length > 0) return true;
  for (const key of Object.keys(window)) {
    if (key.endsWith('_editor') && typeof window[key]?.getValue === 'function') return true;
  }
  return false;
}

async function init() {
  // Only run inside the gsft_main iframe where the Monaco editor lives
  if (window.name !== 'gsft_main' && window !== window.top) return;
  if (window === window.top && !document.getElementById('gsft_main')) return;

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (hasCodeEditor()) {
      clearInterval(interval);
      createTriggerButton();
    }
    if (attempts > 20) clearInterval(interval); // max 10s
  }, 500);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    toggleSidebar();
  }
});

init();
