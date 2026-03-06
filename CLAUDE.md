# SN Assistant — Project Context for Claude Code

## Estado actual del proyecto

**Última actualización:** 2026-03-06

**Fase actual:** Fase 1 — MVP 🔄 En curso

**Completado:**
- ✅ Arquitectura decidida: extensión MV3 + Vercel Edge Function (API key segura)
- ✅ Scope MVP definido: 4 acciones (Explain, Comment, Refactor, Ask)
- ✅ Contextos soportados: Script Fields + Fix Scripts / Background Scripts
- ✅ Comportamiento: auto-show configurable (ON por defecto)
- ✅ Todos los archivos base creados (extension + backend)
- ✅ CLAUDE.md creado

**Pendiente para primera prueba:**
- [ ] Crear iconos placeholder (`extension/icons/icon16.png`, `icon48.png`, `icon128.png`)
- [ ] Deploy backend en Vercel + añadir `ANTHROPIC_API_KEY`
- [ ] Cargar extensión en Chrome (developer mode)
- [ ] Configurar URL de Vercel en options de la extensión
- [ ] Probar extracción de CodeMirror en instancia real de ServiceNow
- [ ] Verificar streaming SSE end-to-end

**Próximo paso inmediato:**
Crear iconos placeholder y cargar la extensión en Chrome para primera prueba.

---

## What this is
A Chrome Extension (MV3) that injects an AI-powered sidebar into ServiceNow to help developers **explain, comment, refactor, and query scripts** using Claude as the LLM backend.

## Current phase
**MVP — Phase 1.** Single user (personal use). No auth, no rate limiting, no multi-user support yet.

## Architecture

```
Chrome Extension (MV3)
├── content.js        ← Detects CodeMirror editors, injects sidebar, extracts code
├── sidebar.css       ← Injected styles for the panel
├── service-worker.js ← Message relay
├── options.html/js   ← User settings (backend URL, auto-show toggle)
└── manifest.json     ← MV3, host_permissions: *.service-now.com

Vercel Edge Function
└── api/chat.js       ← Receives { action, code, context, question }, streams Claude response via SSE
```

The extension **never holds the API key**. The key lives only in Vercel environment variables.

## Tech stack
- Extension: vanilla JS, no build step, no bundler
- Backend: Vercel Edge Functions, `@anthropic-ai/sdk`
- LLM: Claude (model: `claude-sonnet-4-20250514`)
- Streaming: SSE (text/event-stream)

## Key decisions already made — do not revisit
- **MV3** (not MV2) — required for Chrome Web Store
- **Vercel + Edge Function** (not direct API calls from extension) — API key security
- **No bundler on the extension** — keep it simple for MVP
- **Streaming responses** — better UX than waiting for full response
- **Auto-show behavior is configurable** — default ON, user can switch to manual in options

## ServiceNow context
ServiceNow uses **CodeMirror** as its script editor. Code is extracted via:
```javascript
document.querySelector('.CodeMirror').CodeMirror.getValue()
```
Fallback: `textarea[id*="script"]`

### Supported script types (MVP)
- Business Rules (`sys_script`)
- Script Includes (`sys_script_include`)
- UI Actions (`sys_ui_action`)
- UI Scripts (`sys_ui_script`)
- Fix Scripts (`sys_script_fix`)
- Background Scripts (`$background_script`)

### NOT supported in MVP
- Studio / IDE (complex nested iframes — Phase 2)
- ServiceNow mobile

## File structure
```
sn-assistant/
├── CLAUDE.md             ← you are here
├── README.md
├── package.json          ← backend only (Vercel deps)
├── extension/
│   ├── manifest.json
│   ├── content.js
│   ├── sidebar.css
│   ├── service-worker.js
│   ├── options.html
│   ├── options.js
│   └── icons/            ← needs icon16.png, icon48.png, icon128.png
├── api/
│   └── chat.js           ← Vercel Edge Function
└── prompts/
    └── prompts.js        ← prompt reference (not imported directly)
```

## Environment variables
| Variable | Where | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel only | Never in the extension, never committed |

## Known issues / TODO before first test
- [ ] Icons missing (`extension/icons/`) — Chrome requires them to load the extension
- [ ] Test CodeMirror extraction on real ServiceNow instance
- [ ] Verify SSE streaming works end-to-end

## Out of scope for MVP
- User authentication on the backend
- Conversation history / multi-turn chat
- Diff view for refactored code
- Support for ServiceNow Studio
- Multi-instance configuration
- Publishing to Chrome Web Store (Phase 3)

## Communication style for this project
- Prefer small, focused changes over large rewrites
- Always explain what changed and why
- When in doubt about ServiceNow behavior, ask — don't assume
- Keep the extension vanilla JS (no React, no bundler) unless there's a strong reason
