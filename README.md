# SN Assistant

AI copilot for ServiceNow developers. Explain, ask, refactor, and document scripts or Update Sets directly inside the browser.

SN Assistant is built to be more than a generic LLM wrapper. The current build includes:

- multi-provider AI routing
- ServiceNow-aware prompts and guardrails
- local RAG grounded with Breaking Trail content
- one-click script documentation as a Word document
- one-click Update Set documentation
- `Deep` mode for richer Update Set grounding from `sys_update_xml`
- preferred response language in English or Spanish
- public trust foundations for privacy, terms, support, and release operations

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
- **ServiceNow-specific change docs:** Update Set documentation can run in `List-first` or `Deep` mode
- **Practical UX:** draggable and resizable panel, execution trace for long-running Update Set docs, direct Word download
- **Language control:** all responses can be generated in English or Spanish from settings

## Quick start

### 1. Install SN Assistant

Public release channels are intended to be:

- Chrome Web Store
- Microsoft Edge Add-ons

For local development or pre-release testing, use the unpacked workflow:

1. Clone or download this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the repository root, where `manifest.json` lives

### 2. Configure at least one provider

1. Open SN Assistant from the browser toolbar
2. If you are not on a ServiceNow page, the toolbar action opens **Options**
3. Enable one or more AI providers
4. Enter the required API key or local endpoint
5. Save settings

Optional but recommended:

- choose a preferred response language
- enable or tune RAG
- choose the Update Set documentation mode: `List-first` or `Deep`

### 3. Use it in ServiceNow

#### Script context

1. Open a supported script form in ServiceNow
2. Click the floating trigger button, or click the toolbar icon while on the ServiceNow tab
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

Additional contexts such as UI Scripts, Transform Scripts, and Background Scripts are still evolving and should not be treated as guaranteed public support scope.

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
- [docs/BrandFoundation.md](docs/BrandFoundation.md)
- [docs/PrivacyPolicy.md](docs/PrivacyPolicy.md)
- [docs/TermsOfUse.md](docs/TermsOfUse.md)
- [docs/Support.md](docs/Support.md)

Release ops:

- [docs/release/README.md](docs/release/README.md)
- [docs/release/PublicLaunchChecklist.md](docs/release/PublicLaunchChecklist.md)
- [docs/release/StoreListing.md](docs/release/StoreListing.md)
- [docs/release/SmokeTestChecklist.md](docs/release/SmokeTestChecklist.md)
- [docs/release/ReleaseAudit.md](docs/release/ReleaseAudit.md)
- [docs/release/Monetization.md](docs/release/Monetization.md)

Wiki source:

- [docs/wiki/Home.md](docs/wiki/Home.md)
- [docs/wiki/Installation.md](docs/wiki/Installation.md)
- [docs/wiki/Configuration.md](docs/wiki/Configuration.md)
- [docs/wiki/Actions.md](docs/wiki/Actions.md)
- [docs/wiki/FAQ-and-Troubleshooting.md](docs/wiki/FAQ-and-Troubleshooting.md)

## Trust and support

Public foundations:

- [Homepage](https://snow-copilot.vercel.app/)
- [Privacy Policy](https://snow-copilot.vercel.app/privacy/)
- [Terms of Use](https://snow-copilot.vercel.app/terms/)
- [Support](https://snow-copilot.vercel.app/support/)
- [Brand Foundation](docs/BrandFoundation.md)

Current support channels:

- [GitHub Issues](https://github.com/Henalu/snow-copilot/issues)
- [GitHub Discussions](https://github.com/Henalu/snow-copilot/discussions)

Operationally:

- provider secrets such as API keys and custom auth headers are stored in `chrome.storage.local` on the current device
- non-sensitive preferences such as routing, language, and RAG settings are stored in `chrome.storage.sync`
- keys are only sent to the provider or endpoint you configure
- the bundled RAG index is local to the extension package
- Update Set `Deep` mode reads `sys_update_xml` from the active ServiceNow instance when enabled

## License

Proprietary - see [LICENSE](LICENSE).
