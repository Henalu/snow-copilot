# SN Assistant ⚡

AI copilot for ServiceNow developers. Explain, comment, refactor, and document scripts directly from your browser — using any AI provider you choose.

---

## Features

| Action | What it does |
|---|---|
| **Explain** | Understand what a script does — logic, APIs used, side effects |
| **Comment** | Generate JSDoc + inline comments following SN conventions |
| **Refactor** | Improve code quality, readability, and ServiceNow best practices |
| **Ask** | Ask any specific question about the script |
| **Document** | Generate full technical documentation and download as a Word file |

**Supported AI providers:** Anthropic Claude · OpenAI · Google Gemini · OpenRouter · Custom Endpoint · Local LLM (Ollama)

**Supported record types:** Business Rules · Script Includes · Client Scripts · Fix Scripts · UI Actions · Scripted REST Resources · Scheduled Scripts · and more

---

## Quick Start

### 1. Install the extension

> Chrome Web Store listing coming soon.

**Load unpacked (developer mode):**
1. Clone or download this repo
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the repo folder (where `manifest.json` lives)

### 2. Configure a provider

1. Click the SN Assistant icon in the Chrome toolbar → **Options**
2. Enable at least one AI provider and enter your API key
3. Click **Save settings**

No API key yet? Try:
- **OpenRouter** — unified API that gives access to Claude, GPT, Gemini and 100+ other models with a single key
- **Local LLM** — run [Ollama](https://ollama.ai) locally and use it for free with no API key

### 3. Use it in ServiceNow

1. Open any script editor in ServiceNow (Business Rule, Script Include, etc.)
2. The ⚡ trigger button appears on the right edge of the screen
3. Click it to open the assistant panel
4. Choose an action and wait for the AI response

The panel is draggable and resizable. Use the ⊞ button to reset its position.

---

## Documentation

Full documentation is available in the [GitHub Wiki](https://github.com/Henalu/snow-copilot/wiki):

- [Installation Guide](https://github.com/Henalu/snow-copilot/wiki/Installation)
- [Provider Configuration](https://github.com/Henalu/snow-copilot/wiki/Configuration)
- [Actions Reference](https://github.com/Henalu/snow-copilot/wiki/Actions)
- [FAQ & Troubleshooting](https://github.com/Henalu/snow-copilot/wiki/FAQ-and-Troubleshooting)

---

## Supported AI Providers

| Provider | API Key required | Notes |
|---|---|---|
| Anthropic Claude | Yes | Best for code tasks; Sonnet 4.6 recommended |
| OpenAI | Yes | GPT-4o, GPT-4.1, GPT-4o Mini |
| Google Gemini | Yes | Gemini 2.0/2.5 Flash/Pro |
| OpenRouter | Yes | Access 100+ models with one key |
| Custom Endpoint | Optional | Point to your own proxy (Vercel, etc.) |
| Local LLM | No | Ollama / LM Studio — fully local, no data sent externally |

---

## Supported ServiceNow Record Types

| Record type | Table | Status |
|---|---|---|
| Business Rules | `sys_script` | Verified |
| Script Includes | `sys_script_include` | Verified |
| Client Scripts | `sys_script_client` | Verified |
| Fix Scripts | `sys_script_fix` | Verified |
| UI Actions | `sys_ui_action` | Verified |
| Scripted REST Resources | `sys_ws_operation` | Verified |
| Scheduled Scripts | `sysauto_script` | Verified |
| UI Scripts | `sys_ui_script` | Pending verification |
| Transform Scripts | `sys_transform_script` | Pending verification |
| Background Scripts | — | Pending verification |

---

## Architecture

- **Manifest V3** Chrome extension — no background page, uses a service worker
- **No bundler** — vanilla JavaScript, no build step required
- **CSP-safe** — content script runs as a classic script, bypassing ServiceNow's strict Content Security Policy
- **Streaming** — responses streamed via Chrome port messaging, rendered with a lightweight Markdown parser
- **Privacy** — API keys stored locally in `chrome.storage.sync`, never sent to any third party beyond your chosen AI provider

---

## Feedback & Support

- **Bug reports:** [Open a bug report](https://github.com/Henalu/snow-copilot/issues/new?template=bug_report.yml)
- **Feature requests:** [Submit a feature request](https://github.com/Henalu/snow-copilot/issues/new?template=feature_request.yml)
- **Questions & discussion:** [GitHub Discussions](https://github.com/Henalu/snow-copilot/discussions)

---

## Project Structure

```
snow-copilot/
├── manifest.json          ← MV3, background type:"module", all_frames, host_permissions
├── content.js             ← Classic script: trigger button, sidebar panel, port messaging
├── service-worker.js      ← ES module: streaming AI calls via provider adapters
├── sidebar.css            ← Panel styles
├── options.html           ← Settings page
├── options.js             ← Settings controller
├── api/
│   └── chat.js            ← Vercel Edge Function (optional proxy)
├── storage/
│   └── schema.js          ← Config schema, defaults, migration
├── providers/
│   ├── catalog.js         ← Provider metadata, model catalog, action priorities
│   ├── prompts.js         ← Prompt templates per action
│   ├── manager.js         ← Provider resolution and streaming relay
│   ├── anthropic.js
│   ├── openai.js
│   ├── gemini.js
│   ├── openrouter.js
│   ├── customEndpoint.js
│   └── localLlm.js
├── recommendation/
│   └── engine.js          ← Smart defaults recommendation engine
└── docs/
    └── wiki/              ← Source for GitHub Wiki pages
```

---

## License

Proprietary — © 2025 CoreX. All rights reserved.

The source code is available for transparency and community feedback. Personal and internal organizational use is permitted. Redistribution, resale, and use as the basis for competing products are prohibited without written permission. See [LICENSE](LICENSE) for full terms.
