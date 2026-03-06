// SN Assistant — content.js
// Detecta editores CodeMirror en ServiceNow e inyecta el panel lateral

const SN_ASSISTANT_ID = 'sn-assistant-sidebar';

// ─── Detección de contexto ────────────────────────────────────────────────────

function getPageContext() {
  const url = window.location.href;
  const hostname = window.location.hostname; // empresa.service-now.com

  // Detectar tabla desde la URL
  // Ejemplos: /incident.do, /sys_script_fix.do, /sys_script_include.do
  const tableMatch = url.match(/\/([a-z_]+)\.do/);
  const table = tableMatch ? tableMatch[1] : 'unknown';

  // Detectar sys_id si está en la URL
  const sysIdMatch = url.match(/sys_id=([a-f0-9]{32})/);
  const sysId = sysIdMatch ? sysIdMatch[1] : null;

  // Tipo de script
  let scriptType = 'unknown';
  if (table === 'sys_script') scriptType = 'Business Rule';
  else if (table === 'sys_script_include') scriptType = 'Script Include';
  else if (table === 'sys_script_fix') scriptType = 'Fix Script';
  else if (table === 'sys_ui_action') scriptType = 'UI Action';
  else if (table === 'sys_ui_script') scriptType = 'UI Script';
  else if (url.includes('$background_script')) scriptType = 'Background Script';

  return { hostname, table, sysId, scriptType, url };
}

// ─── Extracción de código ─────────────────────────────────────────────────────

function extractCode() {
  // Método 1: Textarea oculto con selector exacto (más fiable en Monaco/ServiceNow)
  const exactTextarea = document.querySelector('textarea[id$=".script"][name$=".script"]');
  if (exactTextarea && exactTextarea.value.trim().length > 0) return exactTextarea.value;

  // Método 2: Variable global Monaco dinámica
  // ServiceNow expone el editor como window['{tabla}_{campo}_editor'], ej: sys_script_script_editor
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

  // Método 3: Monaco via API del DOM (último recurso)
  if (window.monaco && window.monaco.editor) {
    const models = window.monaco.editor.getModels();
    for (const model of models) {
      const code = model.getValue();
      if (code && code.trim().length > 0) return code;
    }
  }

  return null;
}

// ─── Panel lateral ────────────────────────────────────────────────────────────

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
        <button class="sna-toggle" id="sna-toggle" title="Minimizar">−</button>
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
        <span class="sna-model">Claude 3.5 Sonnet</span>
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

// ─── Eventos del panel ────────────────────────────────────────────────────────

function initSidebarEvents(sidebar) {
  // Toggle minimizar/expandir
  const toggleBtn = document.getElementById('sna-toggle');
  const body = document.getElementById('sna-body');
  toggleBtn.addEventListener('click', () => {
    const isCollapsed = body.style.display === 'none';
    body.style.display = isCollapsed ? 'flex' : 'none';
    toggleBtn.textContent = isCollapsed ? '−' : '+';
  });

  // Botones de acción
  const actionBtns = sidebar.querySelectorAll('.sna-action-btn');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;

      // Resaltar botón activo
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

  // Botón send para "Ask"
  document.getElementById('sna-send-question').addEventListener('click', () => {
    const question = document.getElementById('sna-question-input').value.trim();
    if (question) runAction('ask', question);
  });

  // Enter en textarea también envía
  document.getElementById('sna-question-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      const question = e.target.value.trim();
      if (question) runAction('ask', question);
    }
  });

  // Copiar respuesta
  document.getElementById('sna-copy').addEventListener('click', () => {
    const responseEl = document.getElementById('sna-response');
    navigator.clipboard.writeText(responseEl.innerText);
    const btn = document.getElementById('sna-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}

// ─── Llamada al backend ───────────────────────────────────────────────────────

async function runAction(action, question = '') {
  const code = extractCode();

  if (!code) {
    showError('No script detected on this page. Make sure a script editor is open.');
    return;
  }

  const context = getPageContext();

  showLoading();

  try {
    // Leer la URL del backend desde storage
    let { backendUrl } = await chrome.storage.sync.get({ backendUrl: '' });

    if (!backendUrl) {
      showError('Backend URL not configured. Go to extension options to set it up.');
      return;
    }

    if (!backendUrl.startsWith('http')) backendUrl = 'https://' + backendUrl;
    backendUrl = backendUrl.replace(/\/$/, '');

    const response = await fetch(`${backendUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        code,
        question,
        context: {
          scriptType: context.scriptType,
          table: context.table,
          hostname: context.hostname
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    // Streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    showResponse('');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Parsear SSE chunks
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const text = parsed.delta?.text || '';
            fullText += text;
            updateResponse(fullText);
          } catch {}
        }
      }
    }

  } catch (err) {
    showError(`Error: ${err.message}`);
  }
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

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
  // Auto-scroll al final
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

// ─── Detección automática ─────────────────────────────────────────────────────

function hasCodeEditor() {
  // Mismo selector exacto que extractCode() — textarea oculto de Monaco
  const exactTextarea = document.querySelector('textarea[id$=".script"][name$=".script"]');
  if (exactTextarea && exactTextarea.value.trim().length > 0) return true;
  // Fallback: cualquier variable global _editor con getValue
  for (const key of Object.keys(window)) {
    if (key.endsWith('_editor') && typeof window[key]?.getValue === 'function') return true;
  }
  return false;
}

async function init() {
  // Solo actuar si estamos dentro del iframe gsft_main
  if (window.name !== 'gsft_main' && window !== window.top) return;
  if (window === window.top && !document.getElementById('gsft_main')) {
    // Estamos en el doc principal sin iframe visible — esperar
    return;
  }

  const { autoShow } = await chrome.storage.sync.get({ autoShow: true });

  if (autoShow) {
    // Esperar a que el editor cargue (ServiceNow puede tardar)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (hasCodeEditor()) {
        clearInterval(interval);
        createSidebar();
      }
      if (attempts > 20) clearInterval(interval); // máx 10s
    }, 500);
  }
}

// Escuchar mensajes del service worker (para activación manual futura)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    if (document.getElementById(SN_ASSISTANT_ID)) {
      document.getElementById(SN_ASSISTANT_ID).remove();
    } else {
      createSidebar();
    }
  }
});

init();
