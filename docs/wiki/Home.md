# SN Assistant ⚡ — Documentation

AI copilot for ServiceNow developers. Explain, comment, refactor, and document scripts directly from your browser.

## Pages

- **[Installation](Installation)** — How to install the extension (Chrome Web Store or developer mode)
- **[Configuration](Configuration)** — How to set up each AI provider
- **[Actions](Actions)** — What each action does and when to use it
- **[FAQ & Troubleshooting](FAQ-and-Troubleshooting)** — Common issues and how to fix them

---

## Quick Start

1. Install the extension (see [Installation](Installation))
2. Open the extension Options and enable at least one AI provider
3. Navigate to any ServiceNow script editor
4. Click the ⚡ trigger button that appears on the right edge of the screen
5. Choose an action — Explain, Comment, Refactor, Ask, or Document

---

## Supported Record Types

| Record type | Table |
|---|---|
| Business Rules | `sys_script` |
| Script Includes | `sys_script_include` |
| Client Scripts | `sys_script_client` |
| Fix Scripts | `sys_script_fix` |
| UI Actions | `sys_ui_action` |
| Scripted REST Resources | `sys_ws_operation` |
| Scheduled Scripts | `sysauto_script` |

---

## Supported AI Providers

Anthropic Claude · OpenAI · Google Gemini · OpenRouter · Custom Endpoint · Local LLM (Ollama)

See [Configuration](Configuration) for setup instructions for each provider.

---

## Feedback

- [Report a bug](https://github.com/Henalu/snow-copilot/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/Henalu/snow-copilot/issues/new?template=feature_request.yml)
