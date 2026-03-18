# CLAUDE.md — SN Assistant Chrome Extension

Contexto para Claude Code. Leer antes de cualquier tarea.

## Qué es este proyecto
Extensión Chrome (Manifest V3) que actúa como copiloto IA para desarrolladores ServiceNow.
Lee el código del editor directamente desde la instancia y lo envía al proveedor de IA configurado por el usuario.

## Stack
- **Extensión:** JavaScript vanilla, Chrome MV3, sin bundler
- **content.js:** script clásico (sin `"type": "module"`) — necesario para bypasear el CSP estricto de ServiceNow
- **service-worker.js:** ES module (`"type": "module"` en background del manifest) — puede usar `import` estático
- **options.js:** ES module cargado desde options.html con `<script type="module">`
- **Backend (opcional):** Vercel Edge Functions (`api/chat.js`) — accesible como proveedor "Custom Endpoint"
- **Providers soportados:** Anthropic Claude, OpenAI, Google Gemini, OpenRouter, Custom Endpoint, Local LLM (Ollama)
- **Streaming:** SSE — adapters en service-worker.js, chunks enviados a content.js via port messaging
- **Repo GitHub:** `Henalu/snow-copilot`
- **Backend URL de referencia:** `https://snow-copilot.vercel.app`

## Estructura de archivos
```
snow-copilot/
├── CLAUDE.md
├── README.md
├── package.json
├── manifest.json          ← MV3, background type:"module", all_frames, host_permissions
├── content.js             ← Script clásico. Trigger button, sidebar panel, port messaging al SW
├── service-worker.js      ← ES module. Init defaults, relay TOGGLE_SIDEBAR, streaming AI via ports
├── options.html           ← Página de settings multi-proveedor
├── options.js             ← ES module. Controller completo de la página de settings
├── sidebar.css            ← Estilos del panel lateral
├── api/
│   └── chat.js            ← Vercel Edge Function (proxy para Anthropic, compatibilidad)
├── storage/
│   └── schema.js          ← Esquema de config, DEFAULT_SETTINGS, migrateSettings(), loadSettings()
├── providers/
│   ├── catalog.js         ← PROVIDER_META, MODEL_CATALOG, ACTION_PRIORITIES
│   ├── prompts.js         ← buildPrompt() — prompts por acción (extraídos de api/chat.js)
│   ├── manager.js         ← resolveProvider(), sendAction(), resolveProviderLabel()
│   ├── anthropic.js       ← Adapter directo a api.anthropic.com
│   ├── openai.js          ← Adapter directo a api.openai.com (o custom baseUrl)
│   ├── gemini.js          ← Adapter directo a generativelanguage.googleapis.com
│   ├── openrouter.js      ← Adapter para openrouter.ai (formato OpenAI-compatible)
│   ├── customEndpoint.js  ← Adapter para proxy propio (Vercel backend, etc.)
│   └── localLlm.js        ← Adapter para Ollama / LM Studio
└── recommendation/
    └── engine.js          ← computeRecommendations(), applyRecommendations(), refreshRecommendedFields()
```

## Decisiones técnicas clave — NO reabrir

### all_frames: true en manifest.json (content_scripts)
ServiceNow carga el formulario dentro de un iframe (`gsft_main`). El content script se ejecuta dentro del iframe.

### Guard clause en content.js init()
Filtra en qué contexto actúa el script:
- `window.name === 'gsft_main'` → continúa (aquí vive el editor)
- Otro iframe → return
- Documento principal sin gsft_main → return

### Editor: Monaco (no CodeMirror)
Extracción en este orden:
1. `textarea[id$=".script"][name$=".script"]` — textarea oculto de Monaco (más fiable)
2. `window[key]` con `key.endsWith('_editor')` — variable global dinámica de ServiceNow
3. `window.monaco.editor.getModels()` — API global de Monaco como último recurso

### Arquitectura de providers (adapter pattern)
Cada provider implementa: `isConfigured(config)`, `sendPrompt(...)` (async generator), `testConnection(config)`.
`providers/manager.js` resuelve qué provider usar según la configuración guardada.
Resolution order: action routing → default provider → primer provider configurado.

### Migración de backendUrl
El campo antiguo `backendUrl` se migra automáticamente a `providers.customEndpoint.url` en `migrateSettings()` y en `service-worker.js onInstalled`. No rompe instalaciones existentes.

### content.js como script clásico (sin "type": "module") — CRÍTICO
ServiceNow tiene un CSP estricto (`script-src 'self'`) que bloquea la carga de módulos ES cuando se inyectan como `<script type="module">`. Los content scripts clásicos bypasan el CSP completamente.

**Why:** `"type": "module"` en content_scripts hace que Chrome inyecte el script como `<script type="module" src="chrome-extension://...">` en el DOM de la página, quedando sujeto al CSP. Un content script clásico se inyecta por mecanismo interno de Chrome, sin pasar por el CSP.

**How to apply:** NUNCA añadir `"type": "module"` al content_scripts en manifest.json. NUNCA usar `import` estático en content.js. Para acceder a providers, usar el port messaging al service worker.

---

### service-worker.js como ES module ("type": "module" en background)
El service worker SÍ puede ser un módulo. `import()` dinámico está prohibido en service workers clásicos por la spec HTML.

**How to apply:** Mantener `"type": "module"` en la sección `background` del manifest. Usar `import` estático en service-worker.js para cargar providers.

---

### Port messaging para streaming (content.js ↔ service-worker.js)
content.js abre un port con `chrome.runtime.connect({ name: 'ai-stream' })` y envía `{ action, code, question, context }`. El service worker hace la llamada al provider y devuelve chunks vía `port.postMessage({ type: 'chunk', chunk })`.

**Why:** content.js no puede importar providers (CSP). El service worker sí puede. Los ports permiten streaming bidireccional y mantienen el service worker activo durante la operación.

**How to apply:** Toda llamada a providers debe pasar por el service worker. content.js solo gestiona DOM y ports.

---

### Llamadas a APIs externas desde service worker
`host_permissions` en manifest.json incluye los dominios de APIs externas. Las llamadas se hacen desde el service worker (no desde content.js).
- Anthropic requiere header `anthropic-dangerous-direct-browser-access: true`.

### CORS del backend propio (customEndpoint)
El backend Vercel tiene `Access-Control-Allow-Origin: *`. El preflight OPTIONS devuelve 204.

### Streaming
Todos los adapters devuelven async generators que yielden strings. El service worker los consume con `for await` y reenvía cada chunk al content script via port. content.js acumula chunks y actualiza el DOM.

### chrome.storage.sync
Toda la configuración (incluyendo API keys) se guarda en `chrome.storage.sync`. Sincroniza entre dispositivos del mismo perfil Chrome. Limits: 100KB total, 8KB por key — bien dentro del límite con 6 providers.

## Estado actual — 2026-03-18

### ✅ v0.3 — Trigger button + arquitectura CSP-safe

**Providers implementados:**
- Anthropic Claude, OpenAI, Google Gemini, OpenRouter, Custom Endpoint, Local LLM (Ollama)

**Features:**
- Trigger button ⚡ flotante en el borde derecho — aparece al detectar código, con badge pulsante
- Click en el trigger → despliega el panel lateral; click de nuevo → lo cierra
- Badge desaparece al abrir el panel por primera vez
- Botón × en el header del panel para cerrarlo (el trigger queda visible)
- Settings page completa con 6 provider cards expandibles
- Badge de estado por proveedor: Configured / Missing key / Disabled / Experimental
- Test connection con resultado visible (fix: el resultado ahora se muestra correctamente)
- Routing: default provider + action-based routing (Explain/Comment/Refactor/Ask → provider+model)
- Recommendation engine: recomienda provider+model por acción según tiers de coste/calidad/latencia
- Smart defaults: "Apply recommended setup" y "Recalculate" sin pisar overrides manuales
- Estado por acción: Auto vs Custom con botón "Reset to recommended"
- Export / Import de settings en JSON
- Show/hide API keys
- Migración automática de backendUrl → customEndpoint.url
- Footer del panel muestra provider activo

### Flujo de deploy (backend Vercel, si se usa)
```
git push origin main → Vercel detecta → redeploy automático
```

### Para cargar la extensión localmente
1. `chrome://extensions/` → activar modo desarrollador
2. "Cargar descomprimida" → seleccionar la carpeta raíz del repo (donde está manifest.json)
3. Tras cambios en manifest.json → recargar extensión
4. Tras cambios en content.js/sidebar.css/providers/* → recargar extensión
5. Ir a Settings de la extensión → configurar al menos un proveedor

## Modelo de configuración (chrome.storage.sync)
```js
{
  autoShow: true,
  providers: {
    anthropic:     { enabled, apiKey, model },
    openai:        { enabled, apiKey, model, baseUrl },
    gemini:        { enabled, apiKey, model },
    openrouter:    { enabled, apiKey, model, siteName },
    customEndpoint:{ enabled, url, apiKey, model, headersJson },
    localLlm:      { enabled, baseUrl, model }
  },
  routing: {
    defaultProvider: 'anthropic' | null,
    actionRouting: {
      enabled: false,
      actions: {
        explain: { providerId, modelId, isUserOverride, recommendedProviderId, recommendedModelId },
        comment: { ... },
        refactor: { ... },
        ask:      { ... }
      }
    }
  }
}
```

## Catálogo de modelos (providers/catalog.js)
Cada modelo tiene: `id`, `name`, `costTier` (cheap/medium/premium), `qualityTier` (basic/strong/best), `latencyTier` (fast/medium/slow), `strengths` (acciones donde destaca).

Proveedores con catálogo estático: anthropic, openai, gemini.
Proveedores sin catálogo (user-defined): openrouter, customEndpoint, localLlm.

## Contextos ServiceNow soportados
- Business Rules (`sys_script`) ✅ probado
- Script Includes (`sys_script_include`) — pendiente probar
- UI Actions (`sys_ui_action`) — pendiente probar
- UI Scripts (`sys_ui_script`) — pendiente probar
- Fix Scripts (`sys_script_fix`) — pendiente probar
- Background Scripts — pendiente probar

## Tareas pendientes
- [ ] Eliminar `chat.js` duplicado de la raíz del repo
- [ ] Probar en los demás contextos de script
- [ ] Verificar cada proveedor end-to-end en producción
- [ ] Renderizado Markdown en el panel lateral (actualmente textContent)

## Próximas fases
- **Fase 2:** Contexto enriquecido — metadata de la instancia, sys_dictionary
- **Fase 3:** UX copiloto — chat contextual, historial, diff de refactor, selector de modelo en el panel
- **Fase 4:** Studio/IDE support
- **Fase 5:** RAG sobre breaking-trail knowledge base

## Notas de debugging
- DevTools en ServiceNow: cambiar contexto de `top` a `gsft_main` para ver el DOM del formulario
- Errores del service worker: chrome://extensions/ → "Service Worker" → "Inspect"
- Los errores de CSP que aparecen en la consola de ServiceNow son de ServiceNow mismo (usa onclick= inline) — ignorar
- Si el trigger button no aparece: verificar que `hasCodeEditor()` detecta el textarea o la variable global
- Filtrar Network por el dominio del provider (api.anthropic.com, api.openai.com, etc.) — en el inspector del service worker
- Anthropic: si error 400 "direct browser access not allowed" → verificar header `anthropic-dangerous-direct-browser-access: true`
- La petición OPTIONS (204) al custom endpoint es el preflight CORS — normal
- Si la URL en customEndpoint no tiene `https://`, la normalización la añade automáticamente
- NUNCA añadir `"type": "module"` a content_scripts — rompe el CSP de ServiceNow
