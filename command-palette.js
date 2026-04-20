// SN Assistant - command-palette.js
// Classic script loaded before content.js so the sidebar can reuse these helpers.

const SNA_COMMAND_PALETTE_DEFAULTS = {
  confirmImpersonation: true,
  customCommands: []
};

const SNA_COMMAND_ALIAS_REGEX = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const SNA_RESERVED_COMMAND_ALIASES = new Set(['help', 'ask', 'explain', 'comment', 'refactor', 'document', 'docset', 'imp']);
const SNA_COMMAND_PALETTE_STATE = {
  settings: SNA_COMMAND_PALETTE_DEFAULTS,
  results: [],
  selectedIndex: 0,
  mode: 'search',
  notice: null,
  impersonationQuery: '',
  impersonationUsers: [],
  confirmUser: null
};

function getSnAssistantSidebar() {
  return document.getElementById('sn-assistant-sidebar');
}

function getCommandPaletteInput() {
  return document.getElementById('sna-command-input');
}

function getCommandPaletteResultsEl() {
  return document.getElementById('sna-command-results');
}

function getCommandPaletteMetaEl() {
  return document.getElementById('sna-command-meta');
}

function normalizeCommandPaletteAlias(value) {
  return String(value || '').trim().replace(/^\//, '').toLowerCase();
}

function isSafeCommandTemplate(template) {
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

function normalizeStoredCustomCommand(raw, seenAliases) {
  if (!raw || typeof raw !== 'object') return null;

  const alias = normalizeCommandPaletteAlias(raw.alias);
  if (!SNA_COMMAND_ALIAS_REGEX.test(alias)) return null;
  if (SNA_RESERVED_COMMAND_ALIASES.has(alias)) return null;
  if (seenAliases.has(alias)) return null;

  const title = String(raw.title || '').trim();
  const description = String(raw.description || '').trim();
  const urlTemplate = String(raw.urlTemplate || '').trim();
  if (!title || !urlTemplate || !isSafeCommandTemplate(urlTemplate)) return null;

  seenAliases.add(alias);
  return {
    id: String(raw.id || `cmd_${alias}`).trim() || `cmd_${alias}`,
    alias,
    title,
    description,
    urlTemplate
  };
}

function normalizeStoredCommandPaletteSettings(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const seenAliases = new Set();
  const customCommands = Array.isArray(base.customCommands)
    ? base.customCommands
        .map((command) => normalizeStoredCustomCommand(command, seenAliases))
        .filter(Boolean)
    : [];

  return {
    confirmImpersonation: base.confirmImpersonation !== false,
    customCommands
  };
}

async function loadCommandPaletteSettings() {
  try {
    const stored = await chrome.storage.sync.get('commandPalette');
    SNA_COMMAND_PALETTE_STATE.settings = normalizeStoredCommandPaletteSettings(stored.commandPalette);
  } catch {
    SNA_COMMAND_PALETTE_STATE.settings = normalizeStoredCommandPaletteSettings();
  }

  return SNA_COMMAND_PALETTE_STATE.settings;
}

function getPaletteInputValue() {
  return getCommandPaletteInput()?.value || '';
}

function parseCommandPaletteInput(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return { raw: '', normalized: '', alias: '', args: '' };
  }

  const normalized = trimmed.replace(/^\//, '');
  const firstSpaceIdx = normalized.indexOf(' ');
  if (firstSpaceIdx === -1) {
    return {
      raw: trimmed,
      normalized,
      alias: normalized.toLowerCase(),
      args: ''
    };
  }

  return {
    raw: trimmed,
    normalized,
    alias: normalized.slice(0, firstSpaceIdx).toLowerCase(),
    args: normalized.slice(firstSpaceIdx + 1).trim()
  };
}

function commandPaletteUsesInput(template) {
  return template.includes('{{input}}') || template.includes('{{inputEncoded}}');
}

function compileCustomCommandUrl(command, args) {
  const template = String(command.urlTemplate || '').trim();
  const input = String(args || '').trim();
  const needsInput = commandPaletteUsesInput(template);

  if (needsInput && !input) {
    return { ok: false, error: `Use /${command.alias} <input>.` };
  }

  if (!needsInput && input) {
    return { ok: false, error: `/${command.alias} does not accept extra input.` };
  }

  const resolvedTemplate = template
    .replace(/\{\{origin\}\}/g, window.location.origin)
    .replace(/\{\{inputEncoded\}\}/g, encodeURIComponent(input))
    .replace(/\{\{input\}\}/g, input);

  if (!isSafeCommandTemplate(resolvedTemplate)) {
    return { ok: false, error: 'This command points outside the current ServiceNow origin.' };
  }

  try {
    const resolved = new URL(resolvedTemplate, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      return { ok: false, error: 'This command points outside the current ServiceNow origin.' };
    }

    return {
      ok: true,
      url: resolved.toString(),
      preview: `${resolved.pathname}${resolved.search}${resolved.hash}`
    };
  } catch {
    return { ok: false, error: 'The generated URL is invalid.' };
  }
}

function buildBuiltInCommandDefinitions() {
  const scriptAvailable = typeof hasCodeEditor === 'function' && hasCodeEditor();
  const updateSetAvailable = typeof isUpdateSetContext === 'function' && isUpdateSetContext();
  const impersonationAvailable = !!resolveImpersonationToken();

  return [
    {
      id: 'help',
      alias: 'help',
      title: 'Help',
      description: 'List built-in and custom commands.',
      kind: 'builtin',
      available: true
    },
    {
      id: 'ask',
      alias: 'ask',
      title: 'Ask',
      description: 'Ask a free-form question about the current script.',
      kind: 'builtin',
      available: scriptAvailable,
      unavailableReason: 'Only available on a detected script form.',
      requiresArgs: true
    },
    {
      id: 'explain',
      alias: 'explain',
      title: 'Explain',
      description: 'Explain the current script.',
      kind: 'builtin',
      available: scriptAvailable,
      unavailableReason: 'Only available on a detected script form.'
    },
    {
      id: 'comment',
      alias: 'comment',
      title: 'Comment',
      description: 'Add comments to the current script.',
      kind: 'builtin',
      available: scriptAvailable,
      unavailableReason: 'Only available on a detected script form.'
    },
    {
      id: 'refactor',
      alias: 'refactor',
      title: 'Refactor',
      description: 'Refactor the current script.',
      kind: 'builtin',
      available: scriptAvailable,
      unavailableReason: 'Only available on a detected script form.'
    },
    {
      id: 'document',
      alias: 'document',
      title: 'Document',
      description: 'Generate a Word document for the current script.',
      kind: 'builtin',
      available: scriptAvailable,
      unavailableReason: 'Only available on a detected script form.'
    },
    {
      id: 'docset',
      alias: 'docset',
      title: 'Document UpdateSet',
      description: 'Generate Update Set documentation. Optional extra context is allowed.',
      kind: 'builtin',
      available: updateSetAvailable,
      unavailableReason: 'Only available on an Update Set form.',
      acceptsOptionalArgs: true
    },
    {
      id: 'imp',
      alias: 'imp',
      title: 'Impersonate user',
      description: 'Search active users and impersonate one after confirmation.',
      kind: 'builtin',
      available: impersonationAvailable,
      unavailableReason: 'Impersonation is not available from this page; open a standard form/classic page and try again.',
      requiresArgs: true
    }
  ];
}

function buildCustomCommandDefinitions() {
  const customCommands = SNA_COMMAND_PALETTE_STATE.settings.customCommands || [];
  return customCommands.map((command) => ({
    id: command.id,
    alias: command.alias,
    title: command.title,
    description: command.description || 'Open a ServiceNow page in the current tab.',
    kind: 'custom',
    available: true,
    urlTemplate: command.urlTemplate
  }));
}

function selectFirstEnabledIndex(results) {
  const enabledIndex = results.findIndex((result) => result.enabled !== false);
  return enabledIndex >= 0 ? enabledIndex : 0;
}

function buildCommandSearchResult(command, parsedInput) {
  const exactAliasMatch = parsedInput.alias === command.alias;
  const args = exactAliasMatch ? parsedInput.args : '';
  let enabled = command.available !== false;
  let description = command.description;
  let detail = '';

  if (!enabled && command.unavailableReason) {
    detail = command.unavailableReason;
  }

  if (command.kind === 'builtin') {
    if (command.alias === 'help') {
      if (parsedInput.alias === 'help' && parsedInput.args) {
        enabled = false;
        detail = 'Use /help without extra input.';
      }
    } else if (command.alias === 'ask') {
      if (!args) {
        enabled = false;
        detail = 'Use /ask <question>.';
      } else {
        description = `Ask about the current script: "${args}".`;
      }
    } else if (command.alias === 'docset') {
      if (args) {
        description = `Generate Update Set documentation with extra context: "${args}".`;
      }
    } else if (command.alias === 'imp') {
      if (!args) {
        enabled = false;
        detail = 'Use /imp <user_name or name>.';
      } else {
        description = `Search active users matching "${args}".`;
      }
    } else if (args) {
      enabled = false;
      detail = `/${command.alias} does not accept extra input.`;
    }
  }

  if (command.kind === 'custom') {
    const preview = compileCustomCommandUrl(command, args);
    if (!preview.ok) {
      enabled = false;
      detail = preview.error;
    } else {
      description = command.description || `Open ${preview.preview}`;
      detail = preview.preview;
    }
  }

  return {
    type: command.kind,
    actionId: command.id,
    alias: command.alias,
    title: command.title,
    description,
    detail,
    enabled,
    command,
    args
  };
}

function buildSearchResults() {
  const parsed = parseCommandPaletteInput(getPaletteInputValue());
  const commandDefinitions = buildBuiltInCommandDefinitions().concat(buildCustomCommandDefinitions());

  if (!parsed.normalized || (parsed.alias === 'help' && !parsed.args)) {
    const helpResults = commandDefinitions.map((command) => buildCommandSearchResult(command, parsed));
    return {
      results: helpResults,
      notice: 'Type a slash command and press Enter. Tab autocompletes the highlighted result.'
    };
  }

  const exactMatch = commandDefinitions.find((command) => command.alias === parsed.alias);
  if (exactMatch) {
    return {
      results: [buildCommandSearchResult(exactMatch, parsed)],
      notice: null
    };
  }

  const query = parsed.normalized.toLowerCase();
  const filtered = commandDefinitions
    .filter((command) => {
      return [command.alias, command.title, command.description]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
    .map((command) => buildCommandSearchResult(command, parsed));

  return {
    results: filtered,
    notice: filtered.length ? null : 'No command matched that search.'
  };
}

function buildImpersonationResults() {
  const results = (SNA_COMMAND_PALETTE_STATE.impersonationUsers || []).map((user) => ({
    type: 'impersonation-user',
    alias: 'imp',
    title: user.name || user.user_name,
    description: user.user_name,
    detail: `sys_id ${user.sys_id}`,
    enabled: true,
    user
  }));

  return {
    results,
    notice: results.length
      ? 'Select a user and press Enter to continue.'
      : `No active users matched "${SNA_COMMAND_PALETTE_STATE.impersonationQuery}".`
  };
}

function buildImpersonationConfirmationResults() {
  const user = SNA_COMMAND_PALETTE_STATE.confirmUser;
  if (!user) {
    return buildSearchResults();
  }

  return {
    results: [
      {
        type: 'confirm-impersonation',
        alias: 'imp',
        title: `Confirm impersonation as ${user.name || user.user_name}`,
        description: user.user_name,
        detail: 'Press Enter again to continue.',
        enabled: true,
        user
      },
      {
        type: 'cancel-impersonation',
        alias: 'imp',
        title: 'Cancel impersonation',
        description: 'Return to the user search results.',
        detail: '',
        enabled: true
      }
    ],
    notice: 'Explicit confirmation is required before changing user context.'
  };
}

function renderCommandPaletteMeta() {
  const el = getCommandPaletteMetaEl();
  if (!el) return;

  const notice = SNA_COMMAND_PALETTE_STATE.notice;
  if (!notice) {
    el.textContent = 'Type /help to see built-in commands and your custom shortcuts.';
    el.className = 'sna-command-meta';
    return;
  }

  el.textContent = notice;
  el.className = `sna-command-meta ${notice.toLowerCase().includes('no ') || notice.toLowerCase().includes('error') ? 'sna-command-meta--warn' : ''}`;
}

function renderCommandPaletteResults() {
  const resultsEl = getCommandPaletteResultsEl();
  if (!resultsEl) return;

  let payload;
  if (SNA_COMMAND_PALETTE_STATE.mode === 'impersonation-results') {
    payload = buildImpersonationResults();
  } else if (SNA_COMMAND_PALETTE_STATE.mode === 'impersonation-confirm') {
    payload = buildImpersonationConfirmationResults();
  } else {
    payload = buildSearchResults();
  }

  SNA_COMMAND_PALETTE_STATE.results = payload.results || [];
  SNA_COMMAND_PALETTE_STATE.selectedIndex = Math.min(
    SNA_COMMAND_PALETTE_STATE.selectedIndex,
    Math.max(SNA_COMMAND_PALETTE_STATE.results.length - 1, 0)
  );
  if (SNA_COMMAND_PALETTE_STATE.selectedIndex < 0 || !SNA_COMMAND_PALETTE_STATE.results.length) {
    SNA_COMMAND_PALETTE_STATE.selectedIndex = 0;
  }
  if (!SNA_COMMAND_PALETTE_STATE.results[SNA_COMMAND_PALETTE_STATE.selectedIndex]) {
    SNA_COMMAND_PALETTE_STATE.selectedIndex = selectFirstEnabledIndex(SNA_COMMAND_PALETTE_STATE.results);
  }

  SNA_COMMAND_PALETTE_STATE.notice = payload.notice || null;
  renderCommandPaletteMeta();

  if (!SNA_COMMAND_PALETTE_STATE.results.length) {
    resultsEl.innerHTML = '<div class="sna-command-empty">No commands to show for the current input.</div>';
    return;
  }

  resultsEl.innerHTML = SNA_COMMAND_PALETTE_STATE.results.map((result, index) => {
    const stateLabel = result.enabled === false ? 'Disabled' : 'Available';
    const stateClass = result.enabled === false ? 'sna-command-state--disabled' : 'sna-command-state--available';
    const activeClass = index === SNA_COMMAND_PALETTE_STATE.selectedIndex ? 'sna-command-result--active' : '';
    const disabledClass = result.enabled === false ? 'sna-command-result--disabled' : '';

    return `
      <button class="sna-command-result ${activeClass} ${disabledClass}" data-command-result-index="${index}">
        <div class="sna-command-result-top">
          <span class="sna-command-alias">/${escapeHtml(result.alias || '')}</span>
          <span class="sna-command-state ${stateClass}">${escapeHtml(stateLabel)}</span>
        </div>
        <div class="sna-command-title">${escapeHtml(result.title || '')}</div>
        <div class="sna-command-description">${escapeHtml(result.description || '')}</div>
        ${result.detail ? `<div class="sna-command-detail">${escapeHtml(result.detail)}</div>` : ''}
      </button>
    `;
  }).join('');
}

function resetCommandPaletteTransientState() {
  SNA_COMMAND_PALETTE_STATE.mode = 'search';
  SNA_COMMAND_PALETTE_STATE.notice = null;
  SNA_COMMAND_PALETTE_STATE.impersonationQuery = '';
  SNA_COMMAND_PALETTE_STATE.impersonationUsers = [];
  SNA_COMMAND_PALETTE_STATE.confirmUser = null;
}

function syncCommandPaletteStateToInput() {
  const parsed = parseCommandPaletteInput(getPaletteInputValue());
  if (SNA_COMMAND_PALETTE_STATE.mode === 'search') return;

  if (parsed.alias !== 'imp' || !parsed.args) {
    resetCommandPaletteTransientState();
    return;
  }

  if (SNA_COMMAND_PALETTE_STATE.mode === 'impersonation-results' && parsed.args !== SNA_COMMAND_PALETTE_STATE.impersonationQuery) {
    resetCommandPaletteTransientState();
    return;
  }

  if (SNA_COMMAND_PALETTE_STATE.mode === 'impersonation-confirm') {
    const confirmUser = SNA_COMMAND_PALETTE_STATE.confirmUser;
    if (!confirmUser || parsed.args !== SNA_COMMAND_PALETTE_STATE.impersonationQuery) {
      resetCommandPaletteTransientState();
    }
  }
}

function focusCommandPaletteInput() {
  const input = getCommandPaletteInput();
  if (!input) return;

  setTimeout(() => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, 0);
}

function isPaletteStandalone() {
  return getSnAssistantSidebar()?.dataset.openedByPaletteOnly === 'true';
}

function setSidebarMode(mode, options) {
  const sidebar = getSnAssistantSidebar();
  if (!sidebar) return;

  const hasAssistantContext = typeof hasRelevantAssistantContext === 'function' && hasRelevantAssistantContext();
  const nextMode = mode === 'palette' || !hasAssistantContext ? 'palette' : 'assistant';
  sidebar.dataset.mode = nextMode;

  const actions = document.querySelector('.sna-actions');
  const askBox = document.getElementById('sna-ask-box');
  const responseArea = document.getElementById('sna-response-area');
  const footer = document.querySelector('.sna-footer');
  const palette = document.getElementById('sna-command-palette');
  const commandsBtn = document.getElementById('sna-open-commands');
  const modelLabel = document.getElementById('sna-model-label');
  const activeAction = document.querySelector('.sna-action-btn.active')?.dataset.action || '';

  const paletteActive = nextMode === 'palette';
  if (actions) actions.style.display = paletteActive ? 'none' : 'grid';
  if (askBox) {
    const shouldShowAskBox = activeAction === 'ask' || activeAction === 'documentUpdateSet';
    askBox.style.display = paletteActive
      ? 'none'
      : shouldShowAskBox
        ? 'flex'
        : askBox.dataset.defaultDisplay || askBox.style.display;
  }
  if (responseArea) responseArea.style.display = paletteActive ? 'none' : 'block';
  if (footer) footer.style.display = paletteActive ? 'none' : 'flex';
  if (palette) palette.style.display = paletteActive ? 'flex' : 'none';
  if (commandsBtn) commandsBtn.classList.toggle('active', paletteActive);
  if (modelLabel && !paletteActive && !modelLabel.textContent) {
    modelLabel.textContent = 'SN Assistant';
  }

  if (paletteActive) {
    if (options && Object.prototype.hasOwnProperty.call(options, 'openedByPaletteOnly')) {
      sidebar.dataset.openedByPaletteOnly = options.openedByPaletteOnly ? 'true' : 'false';
    }
    resetCommandPaletteTransientState();
    renderCommandPaletteResults();
    focusCommandPaletteInput();
  }
}

async function openCommandPalette(options) {
  await loadCommandPaletteSettings();
  setSidebarMode('palette', options || {});
}

function closeCommandPaletteMode() {
  const hasAssistantContext = typeof hasRelevantAssistantContext === 'function' && hasRelevantAssistantContext();
  if (!hasAssistantContext || isPaletteStandalone()) {
    if (typeof closeSidebar === 'function') {
      closeSidebar();
    }
    return;
  }

  setSidebarMode('assistant');
}

function toggleCommandPaletteMode() {
  const sidebar = getSnAssistantSidebar();
  if (!sidebar) return;

  if (sidebar.dataset.mode === 'palette') {
    closeCommandPaletteMode();
    return;
  }

  openCommandPalette();
}

function moveCommandPaletteSelection(delta) {
  const results = SNA_COMMAND_PALETTE_STATE.results || [];
  if (!results.length) return;

  const nextIndex = SNA_COMMAND_PALETTE_STATE.selectedIndex + delta;
  if (nextIndex < 0) {
    SNA_COMMAND_PALETTE_STATE.selectedIndex = results.length - 1;
  } else if (nextIndex >= results.length) {
    SNA_COMMAND_PALETTE_STATE.selectedIndex = 0;
  } else {
    SNA_COMMAND_PALETTE_STATE.selectedIndex = nextIndex;
  }

  renderCommandPaletteResults();
}

function autocompleteCommandPaletteSelection() {
  const input = getCommandPaletteInput();
  const selected = SNA_COMMAND_PALETTE_STATE.results[SNA_COMMAND_PALETTE_STATE.selectedIndex];
  if (!input || !selected || !selected.alias) return;

  const suffix = selected.type === 'builtin' && (selected.command?.requiresArgs || selected.command?.acceptsOptionalArgs)
    ? ' '
    : selected.type === 'custom' && commandPaletteUsesInput(selected.command?.urlTemplate || '')
      ? ' '
      : '';

  input.value = `/${selected.alias}${suffix}`;
  SNA_COMMAND_PALETTE_STATE.selectedIndex = 0;
  syncCommandPaletteStateToInput();
  renderCommandPaletteResults();
}

function activateAssistantAction(action) {
  if (typeof setActiveSidebarAction === 'function') {
    setActiveSidebarAction(action);
  }
}

function runAssistantActionFromPalette(action, question) {
  const questionInput = document.getElementById('sna-question-input');
  const cleanedQuestion = String(question || '').trim();

  setSidebarMode('assistant');
  activateAssistantAction(action);
  if (questionInput) {
    questionInput.value = cleanedQuestion;
  }

  if (typeof runAction === 'function') {
    runAction(action, cleanedQuestion);
  }
}

async function executeCustomCommand(result) {
  const compiled = compileCustomCommandUrl(result.command, result.args);
  if (!compiled.ok) {
    SNA_COMMAND_PALETTE_STATE.notice = compiled.error;
    renderCommandPaletteMeta();
    return;
  }

  window.location.href = compiled.url;
}

function resolveImpersonationTokenFromDocument(docRef) {
  if (!docRef) return '';

  const selectors = [
    'input#sysparm_ck',
    'input[name="sysparm_ck"]',
    'input[id$=".sysparm_ck"]',
    'input[name$=".sysparm_ck"]'
  ];

  for (const selector of selectors) {
    const field = docRef.querySelector(selector);
    const value = String(field?.value || '').trim();
    if (value) return value;
  }

  return '';
}

function resolveImpersonationToken() {
  const docs = [document];

  try {
    if (window.top && window.top !== window && window.top.document) {
      docs.push(window.top.document);
    }
  } catch {
    // ignore
  }

  try {
    const gsft = document.getElementById('gsft_main') || window.top?.document?.getElementById?.('gsft_main');
    if (gsft?.contentDocument) {
      docs.push(gsft.contentDocument);
    }
  } catch {
    // ignore
  }

  for (const docRef of docs) {
    const token = resolveImpersonationTokenFromDocument(docRef);
    if (token) return token;
  }

  return '';
}

async function fetchImpersonationUsers(query) {
  const token = resolveImpersonationToken();
  if (!token) {
    throw new Error('Impersonation is not available from this page; open a standard form/classic page and try again.');
  }

  const url = new URL('/api/now/table/sys_user', window.location.origin);
  url.searchParams.set('sysparm_display_value', 'false');
  url.searchParams.set('sysparm_exclude_reference_link', 'true');
  url.searchParams.set('sysparm_suppress_pagination_header', 'true');
  url.searchParams.set('sysparm_fields', 'sys_id,user_name,name');
  url.searchParams.set('sysparm_limit', '10');
  url.searchParams.set(
    'sysparm_query',
    `active=true^user_nameLIKE${query}^ORactive=true^nameLIKE${query}`
  );

  const response = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'X-UserToken': token
    }
  });

  if (!response.ok) {
    throw new Error(`User lookup failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.result) ? payload.result : [];
}

async function runImpersonationLookup(query) {
  try {
    const users = await fetchImpersonationUsers(query);
    SNA_COMMAND_PALETTE_STATE.mode = 'impersonation-results';
    SNA_COMMAND_PALETTE_STATE.impersonationQuery = query;
    SNA_COMMAND_PALETTE_STATE.impersonationUsers = users;
    SNA_COMMAND_PALETTE_STATE.confirmUser = null;
    SNA_COMMAND_PALETTE_STATE.selectedIndex = 0;
    renderCommandPaletteResults();
  } catch (error) {
    resetCommandPaletteTransientState();
    renderCommandPaletteResults();
    SNA_COMMAND_PALETTE_STATE.notice = error?.message || 'Could not search impersonation candidates.';
    renderCommandPaletteMeta();
  }
}

async function performImpersonation(user) {
  const token = resolveImpersonationToken();
  if (!token) {
    SNA_COMMAND_PALETTE_STATE.notice = 'Impersonation is not available from this page; open a standard form/classic page and try again.';
    renderCommandPaletteMeta();
    return;
  }

  try {
    const response = await fetch(`/api/now/ui/impersonate/${encodeURIComponent(user.user_name)}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-UserToken': token
      }
    });

    if (!response.ok) {
      throw new Error(`Impersonation failed: HTTP ${response.status}`);
    }

    SNA_COMMAND_PALETTE_STATE.notice = `Impersonating ${user.user_name}...`;
    renderCommandPaletteMeta();
    window.location.reload();
  } catch (error) {
    SNA_COMMAND_PALETTE_STATE.notice = error?.message || 'Impersonation failed.';
    renderCommandPaletteMeta();
  }
}

async function executeCommandPaletteResult(result) {
  if (!result || result.enabled === false) return;

  switch (result.type) {
    case 'builtin':
      if (result.actionId === 'help') {
        const input = getCommandPaletteInput();
        if (input) input.value = '/help';
        resetCommandPaletteTransientState();
        renderCommandPaletteResults();
        return;
      }
      if (result.actionId === 'ask') {
        runAssistantActionFromPalette('ask', result.args);
        return;
      }
      if (result.actionId === 'explain') {
        runAssistantActionFromPalette('explain');
        return;
      }
      if (result.actionId === 'comment') {
        runAssistantActionFromPalette('comment');
        return;
      }
      if (result.actionId === 'refactor') {
        runAssistantActionFromPalette('refactor');
        return;
      }
      if (result.actionId === 'document') {
        runAssistantActionFromPalette('document');
        return;
      }
      if (result.actionId === 'docset') {
        runAssistantActionFromPalette('documentUpdateSet', result.args);
        return;
      }
      if (result.actionId === 'imp') {
        await runImpersonationLookup(result.args);
      }
      return;

    case 'custom':
      await executeCustomCommand(result);
      return;

    case 'impersonation-user':
      if (SNA_COMMAND_PALETTE_STATE.settings.confirmImpersonation !== false) {
        SNA_COMMAND_PALETTE_STATE.mode = 'impersonation-confirm';
        SNA_COMMAND_PALETTE_STATE.confirmUser = result.user;
        SNA_COMMAND_PALETTE_STATE.selectedIndex = 0;
        renderCommandPaletteResults();
      } else {
        await performImpersonation(result.user);
      }
      return;

    case 'confirm-impersonation':
      await performImpersonation(result.user);
      return;

    case 'cancel-impersonation':
      SNA_COMMAND_PALETTE_STATE.mode = 'impersonation-results';
      SNA_COMMAND_PALETTE_STATE.confirmUser = null;
      SNA_COMMAND_PALETTE_STATE.selectedIndex = 0;
      renderCommandPaletteResults();
      return;
  }
}

function handleCommandPaletteEnter() {
  const selected = SNA_COMMAND_PALETTE_STATE.results[SNA_COMMAND_PALETTE_STATE.selectedIndex];
  if (!selected) return;
  executeCommandPaletteResult(selected);
}

function handleCommandPaletteInput() {
  syncCommandPaletteStateToInput();
  SNA_COMMAND_PALETTE_STATE.selectedIndex = 0;
  renderCommandPaletteResults();
}

function handleCommandPaletteResultClick(event) {
  const button = event.target.closest('[data-command-result-index]');
  if (!button) return;

  const index = Number(button.dataset.commandResultIndex);
  if (!Number.isFinite(index)) return;

  SNA_COMMAND_PALETTE_STATE.selectedIndex = index;
  renderCommandPaletteResults();
  const result = SNA_COMMAND_PALETTE_STATE.results[index];
  if (result?.enabled !== false) {
    executeCommandPaletteResult(result);
  }
}

function initializeCommandPalette(sidebar, options) {
  if (!sidebar) return;

  sidebar.dataset.openedByPaletteOnly = options?.openedByPaletteOnly ? 'true' : 'false';

  const askBox = document.getElementById('sna-ask-box');
  if (askBox) {
    askBox.dataset.defaultDisplay = askBox.style.display || 'none';
  }

  const commandsBtn = document.getElementById('sna-open-commands');
  if (commandsBtn) {
    commandsBtn.addEventListener('click', toggleCommandPaletteMode);
  }

  const input = getCommandPaletteInput();
  if (input) {
    input.addEventListener('input', handleCommandPaletteInput);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveCommandPaletteSelection(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveCommandPaletteSelection(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        handleCommandPaletteEnter();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        autocompleteCommandPaletteSelection();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandPaletteMode();
      }
    });
  }

  const results = getCommandPaletteResultsEl();
  if (results) {
    results.addEventListener('click', handleCommandPaletteResultClick);
  }

  loadCommandPaletteSettings().then(() => {
    setSidebarMode(options?.initialMode || 'assistant', {
      openedByPaletteOnly: options?.openedByPaletteOnly
    });
  });
}
