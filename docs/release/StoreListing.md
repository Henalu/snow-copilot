# Store Listing Draft

## Positioning

SN Assistant is an AI copilot for ServiceNow developers. It explains scripts, answers platform questions, improves code, and generates technical documentation directly inside ServiceNow.

## Short description

AI copilot for ServiceNow developers. Explain, ask, refactor, and document scripts or Update Sets in the browser.

## Long description

SN Assistant helps ServiceNow developers work faster without falling back to generic AI advice.

What it does:

- Explain supported ServiceNow scripts with platform-aware guidance
- Ask technical questions about the current script
- Refactor scripts with stronger ServiceNow patterns
- Add comments and JSDoc
- Generate Word documentation for scripts
- Generate Word documentation for Update Sets

Why it is different:

- Built for ServiceNow workflows, not generic browser chat
- Supports multiple providers: Anthropic, OpenAI, Gemini, OpenRouter, Custom Endpoint, and Local LLM
- Includes optional local RAG grounded with Breaking Trail content
- Works directly on supported ServiceNow forms and Update Sets
- Lets users keep control of their provider choice and model routing

Current public support scope:

- Business Rules
- Script Includes
- Client Scripts
- Fix Scripts
- UI Actions
- Scripted REST Resources
- Scheduled Scripts
- Update Sets

Important notes:

- The extension is an assistive tool for developers, not a substitute for testing or peer review.
- In the current public release, users configure their own AI provider or endpoint.
- Some contexts remain experimental and are not part of the public support promise yet.

## Screenshot plan

1. Script explanation in a supported editor
2. Ask action with grounding trace visible
3. Update Set documentation flow
4. Settings page with provider routing
5. Word export result or execution trace

## Store FAQ points

- No account required for the free public release
- Users can choose cloud providers, a custom backend, or a local model
- Provider secrets stay in local browser storage on the device by default
- Update Set documentation is available on `sys_update_set`

## Disclosure notes for store forms

- Basic functionality is free
- Users may need their own third-party AI provider account and API key
- If a future SN Assistant Cloud plan is introduced, mark the Chrome listing as containing in-app purchases

## Public URLs

- Homepage: `https://snow-copilot.vercel.app/`
- Privacy: `https://snow-copilot.vercel.app/privacy/`
- Terms: `https://snow-copilot.vercel.app/terms/`
- Support: `https://snow-copilot.vercel.app/support/`
