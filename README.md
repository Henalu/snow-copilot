# SN Assistant

AI copilot for ServiceNow developers. Explain, comment, refactor, ask questions about scripts, and generate technical documentation directly from the browser.

SN Assistant is no longer just a generic LLM wrapper. The current build includes:

- multi-provider AI routing
- ServiceNow-aware prompts and guardrails
- RAG grounded with Breaking Trail content
- one-click script documentation as a Word document
- one-click Update Set documentation
- `DEEP` mode for richer Update Set grounding from `sys_update_xml`
- preferred response language in English or Spanish

## Core actions

| Action | Purpose |
|---|---|
| `Explain` | Explain what the current script does, with ServiceNow-aware grounding when useful |
| `Comment` | Add JSDoc and inline comments |
| `Refactor` | Improve structure and ServiceNow implementation quality |
| `Ask` | Ask a free-form question about the current script |
| `Document` | Generate technical documentation for the current script and download it as a Word document |
| `Document UpdateSet` | Generate change documentation for the current Update Set and its visible Customer Updates |

## What is special about this build

- **Provider flexibility:** Anthropic, OpenAI, Gemini, OpenRouter, Custom Endpoint, and Local LLM
- **Grounding:** Breaking Trail is bundled as a local RAG source for higher-quality `Ask` and `Explain` answers
- **ServiceNow-specific change docs:** Update Set documentation can run in `List-first` or `DEEP` mode
- **Practical UX:** draggable and resizable panel, execution trace for long-running Update Set docs, direct Word download
- **Language control:** all responses can be generated in English or Spanish from settings

## Quick start

### 1. Load the extension locally

1. Clone or download this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the repository root, where `manifest.json` lives

### 2. Configure at least one provider

1. Open the extension **Options**
2. Enable one or more AI providers
3. Enter the required API key or local endpoint
4. Save settings

Optional but recommended:

- choose a preferred response language
- enable or tune RAG
- choose the Update Set documentation mode: `List-first` or `Deep`

### 3. Use it in ServiceNow

#### Script context

1. Open a supported script form in ServiceNow
2. Click the floating trigger button
3. Choose `Explain`, `Comment`, `Refactor`, `Ask`, or `Document`

#### Update Set context

1. Open a `sys_update_set` record
2. Optionally add extra business or technical context in the sidebar textarea
3. Click `Document UpdateSet`
4. Wait for the action to complete
5. The Word document downloads automatically

## RAG

RAG is currently focused on answer quality, not raw speed.

- default source: Breaking Trail
- default actions: `Explain` and `Ask`
- default behavior: off for `Comment`, `Refactor`, `Document`, and `Document UpdateSet`

See [docs/RAG.md](docs/RAG.md) for the full architecture and tuning notes.

## Update Set documentation

Current modes:

- **List-first:** uses the Update Set form plus visible `Customer Updates` metadata
- **Deep:** attempts to enrich visible Customer Updates with `sys_update_xml` payload details and script previews

See [docs/ChangeDocumentation.md](docs/ChangeDocumentation.md) for the current design and roadmap.

## Supported AI providers

| Provider | Notes |
|---|---|
| Anthropic Claude | Strong default for most coding and documentation tasks |
| OpenAI | Good general-purpose alternative |
| Google Gemini | Fast option with solid quality |
| OpenRouter | Useful when you want many models through one key |
| Custom Endpoint | Good for proxying requests through your own backend |
| Local LLM | Ollama or LM Studio for local usage |

## Supported ServiceNow contexts

| Context | Status |
|---|---|
| Business Rules | Verified |
| Script Includes | Verified |
| Client Scripts | Verified |
| Fix Scripts | Verified |
| UI Actions | Verified |
| Scripted REST Resources | Verified |
| Scheduled Scripts | Verified |
| Update Sets | Verified |
| UI Scripts | Pending verification |
| Transform Scripts | Pending verification |
| Background Scripts | Pending verification |

## Architecture summary

- `content.js`: classic content script for CSP-safe DOM integration inside ServiceNow
- `service-worker.js`: ES module background worker for provider calls and streaming
- `providers/`: provider adapters, prompt assembly, streaming parsing, action budgets
- `rag/`: bundled index loading, retrieval, and grounding prompt assembly
- `change-documentation/`: normalization and planning for Update Set documentation
- `storage/schema.js`: defaults, migrations, and persisted settings

## Documentation

Project docs:

- [docs/RAG.md](docs/RAG.md)
- [docs/ChangeDocumentation.md](docs/ChangeDocumentation.md)

Wiki source:

- [docs/wiki/Home.md](docs/wiki/Home.md)
- [docs/wiki/Installation.md](docs/wiki/Installation.md)
- [docs/wiki/Configuration.md](docs/wiki/Configuration.md)
- [docs/wiki/Actions.md](docs/wiki/Actions.md)
- [docs/wiki/FAQ-and-Troubleshooting.md](docs/wiki/FAQ-and-Troubleshooting.md)

## Privacy

- API keys are stored in `chrome.storage.sync`
- keys are only sent to the provider you configure, unless you choose `Custom Endpoint`
- the bundled RAG index is local to the extension package
- Update Set `DEEP` mode reads `sys_update_xml` from the active ServiceNow instance when enabled

You should still provide a public privacy policy before publishing to the Chrome Web Store.

## License

Proprietary - see [LICENSE](LICENSE).
