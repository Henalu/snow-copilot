// SN Assistant — content.js
// Detects Monaco editors in ServiceNow and injects the assistant sidebar panel.
// Classic script (no ES modules) — required to bypass ServiceNow's strict CSP.

const SN_ASSISTANT_ID = 'sn-assistant-sidebar';
const SN_TRIGGER_ID   = 'sna-trigger-btn';

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
        <button class="sna-reset-pos" id="sna-reset-pos" title="Reset position &amp; size">⊞</button>
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
        <button class="sna-action-btn sna-action-btn--document" data-action="document">
          <span class="sna-action-icon">📄</span>
          <span>Document</span>
          <span class="sna-doc-badge">↓ .doc</span>
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
  showLoading(action === 'document' ? 'Generating documentation...' : null);

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
      finalizeResponse(fullText);
      if (action === 'document') {
        const filename = generateWordDoc(fullText, context);
        // Append download confirmation below the rendered response
        const notice = document.createElement('p');
        notice.className = 'sna-download-notice';
        notice.textContent = '📥 Downloaded: ' + filename;
        document.getElementById('sna-response').appendChild(notice);
      }
      port.disconnect();
    } else if (msg.type === 'error') {
      showError(msg.message);
      port.disconnect();
    }
  });

  port.postMessage({ action, code, question, context });
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

  const bodyHtml = renderMarkdown(markdownText);

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

  // BOM (\ufeff) ensures Word reads the encoding correctly
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return filename;
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

function showResponse(text) {
  document.getElementById('sna-loading').style.display = 'none';
  const el = document.getElementById('sna-response');
  el.style.display = 'block';
  el.classList.remove('sna-response--rendered');
  el.textContent = text; // raw text during streaming
  document.getElementById('sna-copy').style.display = 'inline-block';
}

// Called on each chunk — keeps raw text so streaming feels responsive.
function updateResponse(text) {
  document.getElementById('sna-response').textContent = text;
  const area = document.getElementById('sna-response-area');
  area.scrollTop = area.scrollHeight;
}

// Called once on 'done' — switches to rendered markdown.
function finalizeResponse(text) {
  const el = document.getElementById('sna-response');
  el.classList.add('sna-response--rendered');
  el.innerHTML = renderMarkdown(text);
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
    if (hasCodeEditor()) {
      clearInterval(interval);
      createTriggerButton();
    }
    if (attempts > 40) clearInterval(interval); // max ~20s (was 10s — longer for Client Scripts)
  }, 500);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    toggleSidebar();
  }
});

init();
