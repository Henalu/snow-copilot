# SN Assistant Documentation

SN Assistant is an AI copilot for ServiceNow developers. It can work on script forms and Update Sets directly inside the browser.

## Quick start

1. Install the extension
2. Configure at least one AI provider
3. Choose a preferred response language if needed
4. Optionally enable and tune RAG
5. Open a supported ServiceNow context
6. Launch the assistant from the floating trigger button

## Main capabilities

- Explain scripts
- Comment scripts
- Refactor scripts
- Ask free-form questions about scripts
- Generate script documentation as a Word document
- Generate Update Set documentation as a Word document
- Run Update Set documentation in `List-first` or `Deep` mode

## Pages

- **[Installation](Installation)** - installation and local reload workflow
- **[Configuration](Configuration)** - providers, language, RAG, and Update Set settings
- **[Actions](Actions)** - what each action does and when to use it
- **[FAQ & Troubleshooting](FAQ-and-Troubleshooting)** - common issues and debugging tips

## Supported contexts

| Context | Table | Status |
|---|---|---|
| Business Rules | `sys_script` | Verified |
| Script Includes | `sys_script_include` | Verified |
| Client Scripts | `sys_script_client` | Verified |
| Fix Scripts | `sys_script_fix` | Verified |
| UI Actions | `sys_ui_action` | Verified |
| Scripted REST Resources | `sys_ws_operation` | Verified |
| Scheduled Scripts | `sysauto_script` | Verified |
| Update Sets | `sys_update_set` | Verified |

## Supported providers

Anthropic Claude, OpenAI, Google Gemini, OpenRouter, Custom Endpoint, and Local LLM.
