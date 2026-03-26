# SN Assistant Documentation

SN Assistant is an AI copilot for ServiceNow developers. It works on supported script forms and Update Sets directly inside the browser.

## Quick start

1. Install the extension from the public store listing when available, or use the unpacked workflow for development
2. Configure at least one AI provider
3. Choose a preferred response language if needed
4. Optionally enable and tune RAG
5. Open a supported ServiceNow context
6. Launch the assistant from the floating trigger button or the browser toolbar

## Main capabilities

- Explain scripts
- Comment scripts
- Refactor scripts
- Ask free-form questions about scripts
- Generate script documentation as a Word document
- Generate Update Set documentation as a Word document
- Run Update Set documentation in `List-first` or `Deep` mode

## Pages

- **[Installation](Installation)** - store channels, unpacked install, and toolbar behavior
- **[Configuration](Configuration)** - providers, language, RAG, storage, and Update Set settings
- **[Actions](Actions)** - what each action does and when to use it
- **[FAQ & Troubleshooting](FAQ-and-Troubleshooting)** - common issues and debugging tips

## Trust and support

Public product foundations live at the public product site:

- `https://snow-copilot.vercel.app/`
- `https://snow-copilot.vercel.app/privacy/`
- `https://snow-copilot.vercel.app/terms/`
- `https://snow-copilot.vercel.app/support/`
- `docs/BrandFoundation.md`

Release operations material lives in:

- `docs/release/PublicLaunchChecklist.md`
- `docs/release/StoreListing.md`
- `docs/release/SmokeTestChecklist.md`
- `docs/release/ReleaseAudit.md`
- `docs/release/Monetization.md`

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

Additional contexts are improving over time, but only the verified list above should be treated as committed public support scope.

## Supported providers

Anthropic Claude, OpenAI, Google Gemini, OpenRouter, Custom Endpoint, and Local LLM.
