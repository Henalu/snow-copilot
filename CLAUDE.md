# CLAUDE.md - SN Assistant Chrome Extension

Contexto para Claude Code. Leer antes de cualquier tarea.

## Que es este proyecto

SN Assistant es una extension Chrome (Manifest V3) que actua como copiloto IA para desarrolladores ServiceNow.

Hoy trabaja sobre dos grandes contextos:

- scripts de ServiceNow detectados directamente en la instancia
- Update Sets, con documentacion automatica en modo rapido o profundo

El objetivo del producto no es solo reenviar codigo a un modelo, sino aportar:

- prompts especificos de ServiceNow
- routing multi-provider
- grounding con RAG
- documentacion tecnica util
- una experiencia ligera dentro de la UI de ServiceNow

## Stack

- **Extension:** JavaScript vanilla, Chrome MV3, sin bundler
- **content.js:** script clasico, nunca modulo
- **service-worker.js:** ES module
- **options.js:** ES module cargado desde `options.html`
- **Backend opcional:** `api/chat.js` para Custom Endpoint
- **Providers soportados:** Anthropic, OpenAI, Gemini, OpenRouter, Custom Endpoint, Local LLM
- **RAG:** indice local empaquetado en `rag/`
- **Change documentation:** normalizacion y brief builder en `change-documentation/`

## Estructura de archivos

```text
snow-copilot/
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── manifest.json
├── content.js
├── service-worker.js
├── options.html
├── options.js
├── sidebar.css
├── api/
│   └── chat.js
├── storage/
│   └── schema.js
├── providers/
│   ├── catalog.js
│   ├── prompts.js
│   ├── manager.js
│   ├── streaming.js
│   ├── outputBudget.js
│   ├── anthropic.js
│   ├── openai.js
│   ├── gemini.js
│   ├── openrouter.js
│   ├── customEndpoint.js
│   └── localLlm.js
├── rag/
│   ├── config.js
│   ├── engine.js
│   ├── index.js
│   ├── prompt.js
│   ├── retrieval.js
│   └── indexes/
├── change-documentation/
│   ├── schema.js
│   └── planner.js
├── recommendation/
│   └── engine.js
├── scripts/
│   └── build-rag-index.mjs
└── docs/
    ├── RAG.md
    ├── ChangeDocumentation.md
    └── wiki/
```

## Decisiones tecnicas clave - NO reabrir

### `content.js` es script clasico

ServiceNow tiene CSP estricto. `content.js` debe seguir siendo script clasico y no puede usar `import` estatico.

**Nunca**:

- anadir `"type": "module"` al `content_script`
- usar `import` estatico en `content.js`

### `service-worker.js` si es modulo

El service worker debe seguir en modo ES module desde `manifest.json`.

### `all_frames: true`

ServiceNow sigue mezclando iframe `gsft_main`, top frame Polaris y related lists. La extension depende de ejecutarse en todos los frames y luego filtrar.

### Toda llamada a providers pasa por el service worker

`content.js` solo gestiona DOM, deteccion de contexto y mensajeria por `chrome.runtime.connect`.

### Arquitectura de providers

Cada adapter implementa:

- `isConfigured(config)`
- `sendPrompt(...)`
- `testConnection(config)`

La resolucion del provider vive en `providers/manager.js`.

### Streaming

Los adapters devuelven async generators.

Notas actuales:

- parser robusto SSE/NDJSON en `providers/streaming.js`
- `Document UpdateSet` usa salida bufferizada para evitar castigar el DOM

### `chrome.storage.sync`

Toda la configuracion vive en `chrome.storage.sync`, incluyendo:

- providers
- routing
- preferred language
- RAG settings
- Update Set documentation mode

## Estado actual - 2026-03-24

### Funcionalidad principal

- deteccion generica de editores Monaco con varios fallbacks
- Explain, Comment, Refactor, Ask y Document para scripts
- Document UpdateSet para `sys_update_set`
- descarga automatica a Word para `Document` y `Document UpdateSet`
- panel arrastrable y redimensionable
- preferred response language en ingles o espanol

### RAG

Implementado y funcional:

- fuente prioritaria: Breaking Trail
- indice local empaquetado
- retrieval heuristico ServiceNow-aware
- grounding visible en panel
- politica selectiva por accion

Politica por defecto:

- `Explain`: on
- `Ask`: on
- `Comment`: off
- `Refactor`: off
- `Document`: off
- `Document UpdateSet`: off

### Update Set documentation

Implementado y funcional:

- deteccion real de `sys_update_set`
- flujo one-click
- contexto libre del usuario en textarea
- captura de Customer Updates visibles
- `List-first` mode
- `Deep` mode con enriquecimiento desde `sys_update_xml`
- execution trace en panel

### Estabilidad y rendimiento

Ultimas mejoras importantes:

- parser de streaming mas robusto
- timeout por inactividad en vez de reloj ciego
- Update Set docs sin streaming visible de texto largo
- mejor postproceso para Word
- mejor manejo de contexto invalidado tras recargar la extension

## Flujo local de desarrollo

1. `chrome://extensions/`
2. activar modo desarrollador
3. cargar descomprimida apuntando a la raiz del repo
4. tras cambios en extension: recargar extension
5. tras recargar extension: refrescar tambien la pestana de ServiceNow

Para rebuild del indice RAG:

```bash
npm run rag:build
```

## Modelo de configuracion

Referencia actual:

```js
{
  autoShow: true,
  preferredLanguage: 'en' | 'es',
  changeDocumentation: {
    updateSetMode: 'list' | 'deep',
    deepFetchLimit: number,
    deepFetchConcurrency: number
  },
  providers: {
    anthropic,
    openai,
    gemini,
    openrouter,
    customEndpoint,
    localLlm
  },
  routing: {
    defaultProvider,
    actionRouting
  },
  rag: {
    enabled,
    debug,
    strategy,
    maxChunks,
    maxChunksPerDocument,
    maxContextChars,
    includeTraceInPanel,
    enabledActions,
    activeSources
  }
}
```

La fuente real de defaults y migraciones esta en `storage/schema.js`.

## Contextos ServiceNow soportados

- Business Rules (`sys_script`) - verificado
- Script Includes (`sys_script_include`) - verificado
- Client Scripts (`sys_script_client`) - verificado
- Fix Scripts (`sys_script_fix`) - verificado
- UI Actions (`sys_ui_action`) - verificado
- Scripted REST Resource (`sys_ws_operation`) - verificado
- Scheduled Scripts (`sysauto_script`) - verificado
- Update Sets (`sys_update_set`) - verificado
- UI Scripts (`sys_ui_script`) - pendiente verificar
- Transform Scripts (`sys_transform_script`) - pendiente verificar
- Background Scripts - pendiente verificar

## Notas de debugging

### Scripts

Si no aparece el trigger en un script:

1. cambiar contexto DevTools a `gsft_main` o al frame correcto
2. ejecutar `detectRecordType()`
3. ejecutar `detectScriptEditor()`

### Update Sets

La primera herramienta de debug ya no es la consola, sino el execution trace del panel.

Fases importantes:

- `Captured Update Set data`
- `Prompt prepared`
- `Model started responding`
- `Generation in progress`
- `Preparing Word download`

Si falla tras recargar la extension y no refrescar la pagina, puede aparecer `Extension context invalidated`.

## Agentes Disponibles - Cuándo Activar Cada Uno

| Casuistica | Agente | Ejemplo |
|---|---|---|
| Nuevo provider adapter | `engineering-ai-engineer` | Crear adapter y mantener el patron actual |
| Cambios fuertes en `content.js` | `engineering-frontend-developer` | Implementar UI o deteccion en ServiceNow |
| Revision de `content.js` o `manifest.json` | `engineering-code-reviewer` | Verificar CSP y seguridad de la integracion |
| Cambios de arquitectura | `engineering-software-architect` | Disenar fases grandes o storage nuevo |
| Pruebas de providers | `testing-api-tester` | Validar streaming y errores reales |
| Documentacion de usuario | `engineering-technical-writer` | Actualizar README o wiki |

### Regla general

- cualquier toque serio a `content.js`: revisar con mentalidad CSP-first
- cualquier cambio de arquitectura: pensar primero en `content.js` + `service-worker.js` + `storage/schema.js`
- antes de merge a `main`: revisar `content.js` y `manifest.json`

## Comandos Impeccable - Cuándo Ejecutar

| Momento | Comando | Por que |
|---|---|---|
| Despues de modificar panel o estilos | `/polish` | El panel vive siempre encima de ServiceNow |
| Antes de publicar version | `/audit` | Revisar accesibilidad, coherencia y estados |
| Al tocar labels, placeholders o mensajes | `/clarify` | El copy es parte central de la UX |
| Al reorganizar layout del panel | `/arrange` | El ancho del panel es limitado |
| Al anadir secciones a settings | `/normalize` | Mantener consistencia visual |
| Al mejorar errores y fallbacks | `/harden` | El producto depende mucho de edge cases |

## Tareas pendientes

- [ ] eliminar `chat.js` duplicado en la raiz del repo
- [ ] verificar UI Scripts, Transform Scripts y Background Scripts
- [ ] probar todos los providers end-to-end en uso real
- [ ] preparar privacidad, listing y release checklist para publicacion

## Proximas fases

- **Fase siguiente:** pulir `Deep` mode para Update Sets y documentacion package-level mas rica
- **Despues:** soporte de Customer Updates seleccionados y `Document Solution`
- **Mas adelante:** evaluacion y mejora del grounding RAG
- **Monetizacion/publicacion:** preparar beta publica, politica de privacidad y modelo de suscripcion
